import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiClient, authHeaders } from "../config/apiClient";
import {
  clearActiveLiveRoomSession,
  readActiveLiveRoomSession,
  writeActiveLiveRoomSession,
} from "../utils/liveRoomSession";

const idOf = (value) => String(value?._id || value?.id || value || "");

const roomFromStoredSession = (session) => {
  if (!session?.code) return null;
  return {
    code: session.code,
    currentSong: session.currentSong || null,
    playbackState: session.playbackState || "paused",
    playbackPosition: Math.max(0, Number(session.playbackPosition || 0)),
    playbackStartedAt: session.playbackStartedAt || null,
    playbackVersion: Number(session.playbackVersion || 0),
    _expectedPosition: Math.max(0, Number(session.expectedPosition ?? session.playbackPosition ?? 0)),
    _snapshotReceivedAt: Number(session.savedAt || Date.now()),
    _serverTime: session.serverTime || null,
    _serverClockOffsetMs: Number(session.serverClockOffsetMs || 0),
    _isHost: Boolean(session.isHost),
    _viewerId: String(session.viewerId || ""),
  };
};

const saveRoomSession = (room, listenerPaused = false) => {
  if (!room?.code) return;
  writeActiveLiveRoomSession({
    code: room.code,
    isHost: Boolean(room._isHost),
    viewerId: String(room._viewerId || ""),
    currentSong: room.currentSong || null,
    currentSongId: idOf(room.currentSong),
    playbackState: room.playbackState || "paused",
    playbackPosition: Math.max(0, Number(room.playbackPosition || 0)),
    playbackStartedAt: room.playbackStartedAt || null,
    playbackVersion: Number(room.playbackVersion || 0),
    expectedPosition: Math.max(0, Number(room._expectedPosition ?? room.playbackPosition ?? 0)),
    serverTime: room._serverTime || null,
    serverClockOffsetMs: Number(room._serverClockOffsetMs || 0),
    listenerPaused: Boolean(listenerPaused),
  });
};

const useSongDetailsLiveRoomSync = ({
  songId = "",
  player,
  authToken = "",
  socket = null,
  connected = false,
  onStatus,
} = {}) => {
  const initialSessionRef = useRef(null);
  if (initialSessionRef.current === null) initialSessionRef.current = readActiveLiveRoomSession() || false;
  const initialSession = initialSessionRef.current || null;

  const [roomCode, setRoomCode] = useState(() => String(initialSession?.code || "").toUpperCase());
  const [room, setRoom] = useState(() => roomFromStoredSession(initialSession));
  const [listenerPaused, setListenerPaused] = useState(() => Boolean(initialSession?.listenerPaused));
  const [livePosition, setLivePosition] = useState(() => Math.max(0, Number(initialSession?.expectedPosition ?? initialSession?.playbackPosition ?? 0)));
  const [ready, setReady] = useState(false);

  const headers = useMemo(() => authHeaders(authToken), [authToken]);
  const roomRef = useRef(room);
  const playerRef = useRef(player);
  const listenerPausedRef = useRef(listenerPaused);
  const serverClockOffsetRef = useRef(Number(initialSession?.serverClockOffsetMs || 0));
  const syncInFlightRef = useRef(false);
  const lastHardSyncAtRef = useRef(0);
  const driftBreachSinceRef = useRef(0);
  const driftDirectionRef = useRef(0);
  const seekTimerRef = useRef(null);
  const pendingSeekRef = useRef(null);

  roomRef.current = room;
  playerRef.current = player;
  listenerPausedRef.current = listenerPaused;

  const setMessage = useCallback((message = "") => {
    if (message && typeof onStatus === "function") onStatus(message);
  }, [onStatus]);

  const normalizeRoomResponse = useCallback((data, requestStartedAt = Date.now()) => {
    const raw = data?.room || {};
    const receivedAt = Date.now();
    const serverTimeMs = Date.parse(data?.serverTime || "");
    if (Number.isFinite(serverTimeMs)) {
      const midpoint = (Number(requestStartedAt || receivedAt) + receivedAt) / 2;
      serverClockOffsetRef.current = serverTimeMs - midpoint;
    }
    return {
      ...raw,
      _isHost: Boolean(data?.isHost),
      _viewerId: String(data?.viewerId || ""),
      _expectedPosition: Math.max(0, Number(data?.expectedPosition || raw.playbackPosition || 0)),
      _snapshotReceivedAt: receivedAt,
      _serverTime: data?.serverTime || null,
      _serverClockOffsetMs: Number.isFinite(serverClockOffsetRef.current) ? serverClockOffsetRef.current : 0,
    };
  }, []);

  const loadRoom = useCallback(async ({ quiet = true } = {}) => {
    if (!authToken || !roomCode) {
      setReady(true);
      return null;
    }
    try {
      const requestStartedAt = Date.now();
      const { data } = await apiClient.get(`/api/social/rooms/${roomCode}`, { headers });
      if (!data?.success) throw new Error(data?.message || "Could not load live room");
      const nextRoom = normalizeRoomResponse(data, requestStartedAt);
      setRoom(nextRoom);
      saveRoomSession(nextRoom, listenerPausedRef.current && !nextRoom._isHost);
      setReady(true);
      return nextRoom;
    } catch (error) {
      if ([401, 403, 404].includes(Number(error?.response?.status || 0))) {
        clearActiveLiveRoomSession(roomCode);
        setRoom(null);
        setRoomCode("");
      } else if (!quiet) {
        setMessage("Live room connection is temporarily unavailable.");
      }
      setReady(true);
      return null;
    }
  }, [authToken, headers, normalizeRoomResponse, roomCode, setMessage]);

  const expectedPosition = useCallback((snapshot = roomRef.current) => {
    if (!snapshot?.currentSong?._id) return 0;
    const base = Math.max(0, Number(snapshot._expectedPosition ?? snapshot.playbackPosition ?? 0));
    if (snapshot.playbackState !== "playing") return base;

    const offset = Number.isFinite(snapshot?._serverClockOffsetMs)
      ? Number(snapshot._serverClockOffsetMs)
      : Number.isFinite(serverClockOffsetRef.current)
        ? Number(serverClockOffsetRef.current)
        : 0;
    const serverNowMs = Date.now() + offset;
    const startedAtMs = Date.parse(snapshot.playbackStartedAt || "");
    const storedBase = Math.max(0, Number(snapshot.playbackPosition || 0));

    if (Number.isFinite(startedAtMs)) {
      return Math.max(0, storedBase + Math.max(0, serverNowMs - startedAtMs) / 1000);
    }

    const packetServerMs = Date.parse(snapshot._serverTime || "");
    if (Number.isFinite(packetServerMs)) {
      return Math.max(0, base + Math.max(0, serverNowMs - packetServerMs) / 1000);
    }

    const receivedAt = Number(snapshot._snapshotReceivedAt || Date.now());
    return Math.max(0, base + Math.max(0, Date.now() - receivedAt) / 1000);
  }, []);

  const syncFromRoom = useCallback(async ({ force = false, ignoreLocalPause = false } = {}) => {
    if (syncInFlightRef.current) return false;
    const snapshot = roomRef.current;
    const activePlayer = playerRef.current;
    const current = snapshot?.currentSong;
    if (!current?._id || !activePlayer) return false;

    if (!snapshot?._isHost && listenerPausedRef.current && !ignoreLocalPause) return false;

    syncInFlightRef.current = true;
    try {
      const wantedPosition = expectedPosition(snapshot);
      const sameSong = idOf(activePlayer.currentSong) === idOf(current);
      const audioNode = activePlayer.audioRef?.current || null;

      if (!sameSong) {
        if (!snapshot?._isHost && snapshot.playbackState !== "playing") return false;

        const initialTarget = Math.max(0, wantedPosition - 0.12);
        const started = await activePlayer.playSong?.(current, [current], {
          roomSync: true,
          startAt: snapshot?._isHost ? undefined : initialTarget,
          smoothRoomStart: !snapshot?._isHost,
        });
        const latestSnapshot = roomRef.current || snapshot;
        const liveTarget = Math.max(0, expectedPosition(latestSnapshot) - 0.12);
        if (started !== false) {
          const startedAudio = activePlayer.audioRef?.current || null;
          const startedAt = Number(startedAudio?.currentTime || activePlayer.progress || 0);
          if (
            startedAudio &&
            !startedAudio.paused &&
            !activePlayer.isBuffering &&
            Math.abs(liveTarget - startedAt) > 2.2
          ) {
            activePlayer.seekTo?.(liveTarget, { roomSync: true });
            lastHardSyncAtRef.current = Date.now();
          }
        }
      } else {
        const liveAudio = activePlayer.audioRef?.current || audioNode;
        const actual = Number.isFinite(liveAudio?.currentTime)
          ? Number(liveAudio.currentTime)
          : Number(activePlayer.progress || 0);
        const listenerTarget = Math.max(0, wantedPosition - 0.22);
        const signedDrift = listenerTarget - actual;
        const drift = Math.abs(signedDrift);
        const buffering = Boolean(activePlayer.isBuffering) || Boolean(liveAudio && !liveAudio.paused && liveAudio.readyState < 3);

        if (!snapshot?._isHost && liveAudio && snapshot.playbackState === "playing") {
          try {
            liveAudio.preservesPitch = true;
            liveAudio.webkitPreservesPitch = true;
          } catch {
            // Browser does not expose pitch preservation.
          }

          if (buffering) {
            driftBreachSinceRef.current = 0;
            driftDirectionRef.current = 0;
            if (liveAudio.playbackRate !== 1) liveAudio.playbackRate = 1;
          } else if (force && drift > 3.2 && Date.now() - lastHardSyncAtRef.current > 6500) {
            activePlayer.seekTo?.(listenerTarget, { roomSync: true });
            lastHardSyncAtRef.current = Date.now();
            driftBreachSinceRef.current = 0;
            driftDirectionRef.current = 0;
            if (liveAudio.playbackRate !== 1) liveAudio.playbackRate = 1;
          } else if (drift > 3.8 && Date.now() - lastHardSyncAtRef.current > 8500) {
            activePlayer.seekTo?.(listenerTarget, { roomSync: true });
            lastHardSyncAtRef.current = Date.now();
            driftBreachSinceRef.current = 0;
            driftDirectionRef.current = 0;
            if (liveAudio.playbackRate !== 1) liveAudio.playbackRate = 1;
          } else if (drift > 0.95) {
            const direction = signedDrift > 0 ? 1 : -1;
            if (driftDirectionRef.current !== direction) {
              driftDirectionRef.current = direction;
              driftBreachSinceRef.current = Date.now();
              if (liveAudio.playbackRate !== 1) liveAudio.playbackRate = 1;
            } else if (Date.now() - driftBreachSinceRef.current > 3200) {
              liveAudio.playbackRate = direction > 0 ? 1.008 : 0.992;
            }
          } else if (drift < 0.42) {
            driftBreachSinceRef.current = 0;
            driftDirectionRef.current = 0;
            if (liveAudio.playbackRate !== 1) liveAudio.playbackRate = 1;
          }
        } else if (liveAudio && liveAudio.playbackRate !== 1) {
          liveAudio.playbackRate = 1;
        }
      }

      const latest = roomRef.current || snapshot;
      const latestAudio = activePlayer.audioRef?.current || null;
      if (latest.playbackState === "paused") {
        if (latestAudio && latestAudio.playbackRate !== 1) latestAudio.playbackRate = 1;
        if (activePlayer.isPlaying) activePlayer.pauseSong?.({ roomSync: true });
      } else if (!activePlayer.isPlaying && !activePlayer.isBuffering) {
        await activePlayer.resumeSong?.({ roomSync: true });
        const afterResume = roomRef.current || latest;
        const resumedAudio = activePlayer.audioRef?.current || null;
        if (resumedAudio && !resumedAudio.paused) {
          const liveTarget = expectedPosition(afterResume);
          const actual = Number(resumedAudio.currentTime || 0);
          if (Math.abs(liveTarget - actual) > 3.2 && Date.now() - lastHardSyncAtRef.current > 6500) {
            activePlayer.seekTo?.(Math.max(0, liveTarget - 0.22), { roomSync: true });
            lastHardSyncAtRef.current = Date.now();
          }
        }
      }
      return true;
    } finally {
      syncInFlightRef.current = false;
    }
  }, [expectedPosition]);

  const pauseListenerLocally = useCallback(() => {
    listenerPausedRef.current = true;
    setListenerPaused(true);
    saveRoomSession(roomRef.current, true);
    setMessage("Paused on this device. The live room is still moving with the host.");
  }, [setMessage]);

  const resumeListenerLive = useCallback(async () => {
    const snapshot = roomRef.current;
    const activePlayer = playerRef.current;
    if (!snapshot || snapshot._isHost) return false;
    if (snapshot.playbackState !== "playing") {
      setMessage("The host has paused the live room.");
      await syncFromRoom({ force: true, ignoreLocalPause: true });
      return false;
    }

    listenerPausedRef.current = false;
    setListenerPaused(false);
    saveRoomSession(snapshot, false);

    const target = Math.max(0, expectedPosition(snapshot) - 0.08);
    let startedFromGesture = false;
    if (activePlayer?.resumeLiveRoomFromGesture) {
      startedFromGesture = await activePlayer.resumeLiveRoomFromGesture(target);
    }
    await syncFromRoom({ force: true, ignoreLocalPause: true });
    setMessage(startedFromGesture ? "Live audio connected to the host." : "Back live with the host.");
    return true;
  }, [expectedPosition, setMessage, syncFromRoom]);

  const postPlayback = useCallback(async ({ playbackState, position }) => {
    const snapshot = roomRef.current;
    if (!snapshot?._isHost || !snapshot?.code) return null;
    try {
      const { data } = await apiClient.post(`/api/social/rooms/${snapshot.code}/playback`, {
        playbackState,
        position: Math.max(0, Number(position || 0)),
      }, { headers });
      if (data?.success && data.playback) {
        setRoom((current) => current ? {
          ...current,
          ...data.playback,
          _expectedPosition: Math.max(0, Number(data.playback.playbackPosition || 0)),
          _snapshotReceivedAt: Date.now(),
          _serverTime: data.playback.serverTime || null,
        } : current);
      }
      return data?.playback || null;
    } catch {
      setMessage("Could not update live room playback.");
      return null;
    }
  }, [headers, setMessage]);

  const sendPlaybackChange = useCallback((change = {}) => {
    if (change.reason !== "seek") {
      if (seekTimerRef.current) window.clearTimeout(seekTimerRef.current);
      seekTimerRef.current = null;
      pendingSeekRef.current = null;
      postPlayback(change);
      return;
    }

    pendingSeekRef.current = change;
    if (seekTimerRef.current) window.clearTimeout(seekTimerRef.current);
    seekTimerRef.current = window.setTimeout(() => {
      const pending = pendingSeekRef.current;
      pendingSeekRef.current = null;
      seekTimerRef.current = null;
      if (pending) postPlayback(pending);
    }, 120);
  }, [postPlayback]);

  const advanceRoom = useCallback(async () => {
    const snapshot = roomRef.current;
    const activePlayer = playerRef.current;
    if (!snapshot?._isHost || !snapshot?.code) {
      setMessage("Only the host can change the live room song.");
      await syncFromRoom({ force: true });
      return snapshot?.currentSong || null;
    }
    try {
      const { data } = await apiClient.post(`/api/social/rooms/${snapshot.code}/advance`, {}, { headers });
      if (!data?.success) return null;
      if (data.currentSong) {
        const started = await activePlayer?.playSong?.(data.currentSong, [data.currentSong], { roomSync: true });
        if (started !== false) {
          activePlayer?.seekTo?.(0, { roomSync: true });
          const leaderPosition = Number(activePlayer?.audioRef?.current?.currentTime || activePlayer?.progress || 0);
          await postPlayback({ playbackState: "playing", position: leaderPosition });
        }
      }
      await loadRoom({ quiet: true });
      return data.currentSong || null;
    } catch {
      setMessage("Could not advance the live room.");
      return null;
    }
  }, [headers, loadRoom, postPlayback, setMessage, syncFromRoom]);

  useEffect(() => {
    loadRoom({ quiet: true });
  }, [loadRoom]);

  useEffect(() => {
    if (!socket || !roomCode) return undefined;

    const onRoomPlayback = (event) => {
      if (String(event?.code || "").toUpperCase() !== roomCode) return;
      const eventSongId = String(event?.songId || "");
      const localSongId = idOf(roomRef.current?.currentSong);
      if ((!eventSongId && localSongId) || (eventSongId && eventSongId !== localSongId)) {
        loadRoom({ quiet: true });
        return;
      }

      const receivedAt = Date.now();
      const eventServerMs = Date.parse(event?.serverTime || "");
      if (Number.isFinite(eventServerMs)) serverClockOffsetRef.current = eventServerMs - receivedAt;

      setRoom((current) => current ? {
        ...current,
        playbackState: event.playbackState,
        playbackPosition: Number(event.playbackPosition || 0),
        playbackStartedAt: event.playbackStartedAt || null,
        playbackVersion: Number(event.playbackVersion || 0),
        _expectedPosition: Math.max(0, Number(event.playbackPosition || 0)),
        _snapshotReceivedAt: receivedAt,
        _serverTime: event.serverTime || null,
        _serverClockOffsetMs: Number.isFinite(serverClockOffsetRef.current) ? serverClockOffsetRef.current : 0,
      } : current);
    };

    const onRoomUpdate = (event) => {
      if (String(event?.code || "").toUpperCase() !== roomCode) return;
      if (event?.reason === "playback_changed" || event?.reason === "live_reaction") return;
      loadRoom({ quiet: true });
    };

    socket.on("room:playback", onRoomPlayback);
    socket.on("room:update", onRoomUpdate);
    return () => {
      socket.off("room:playback", onRoomPlayback);
      socket.off("room:update", onRoomUpdate);
    };
  }, [loadRoom, roomCode, socket]);

  useEffect(() => {
    if (!authToken || !roomCode) return undefined;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") loadRoom({ quiet: true });
    }, connected ? 4500 : 1600);
    return () => window.clearInterval(interval);
  }, [authToken, connected, loadRoom, roomCode]);

  useEffect(() => {
    if (!room?.currentSong?._id) return;
    saveRoomSession(room, listenerPausedRef.current && !room._isHost);
    syncFromRoom({ force: true });
  }, [room?.currentSong?._id, room?.playbackState, room?.playbackVersion, room?._isHost, syncFromRoom]);

  useEffect(() => {
    if (!room?.currentSong?._id) return undefined;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") syncFromRoom({ force: false });
    }, 1800);
    return () => window.clearInterval(interval);
  }, [room?.currentSong?._id, syncFromRoom]);

  // Keep the visible LIVE timeline moving even when a listener pauses only
  // their own device. The room clock remains authoritative, so Song Details
  // can show where the live session is NOW while local audio is paused.
  useEffect(() => {
    if (!room?.currentSong?._id) {
      setLivePosition(0);
      return undefined;
    }

    const updateLivePosition = () => {
      const snapshot = roomRef.current || room;
      const rawPosition = Math.max(0, Number(expectedPosition(snapshot) || 0));
      const rawDuration = Number(snapshot?.currentSong?.duration || 0);
      const duration = Number.isFinite(rawDuration) && rawDuration > 0
        ? (rawDuration > 10000 ? rawDuration / 1000 : rawDuration)
        : 0;
      setLivePosition(duration > 0 ? Math.min(rawPosition, duration) : rawPosition);
    };

    updateLivePosition();
    if (room.playbackState !== "playing") return undefined;

    const timer = window.setInterval(updateLivePosition, 500);
    return () => window.clearInterval(timer);
  }, [expectedPosition, room?.currentSong?._id, room?.currentSong?.duration, room?.playbackState, room?.playbackPosition, room?.playbackStartedAt, room?.playbackVersion]);

  useEffect(() => {
    if (!room?.code || !room?.currentSong?._id) return undefined;

    window.dispatchEvent(new CustomEvent("soundwave-room-control", {
      detail: {
        active: true,
        code: room.code,
        isHost: Boolean(room._isHost),
        currentSongId: idOf(room.currentSong),
        onPlaybackChange: sendPlaybackChange,
        onNext: advanceRoom,
        onLocalPause: pauseListenerLocally,
        onListenerResume: resumeListenerLive,
        getExpectedPosition: () => expectedPosition(roomRef.current),
        onBlocked: (reason) => {
          const action = reason === "seek"
            ? "Seeking"
            : reason === "next" || reason === "previous"
              ? "Changing songs"
              : "Starting another song";
          setMessage(`${action} is controlled by the room host. You can pause this device and rejoin live anytime.`);
          if (!listenerPausedRef.current) syncFromRoom({ force: true });
        },
      },
    }));

    return () => {
      window.dispatchEvent(new CustomEvent("soundwave-room-control", { detail: { active: false } }));
    };
  }, [advanceRoom, expectedPosition, pauseListenerLocally, resumeListenerLive, room?.code, room?._isHost, room?.currentSong?._id, sendPlaybackChange, setMessage, syncFromRoom]);

  useEffect(() => () => {
    if (seekTimerRef.current) window.clearTimeout(seekTimerRef.current);
    const audio = playerRef.current?.audioRef?.current;
    if (audio && audio.playbackRate !== 1) audio.playbackRate = 1;
    window.dispatchEvent(new CustomEvent("soundwave-room-control", { detail: { active: false } }));
  }, []);

  const currentRoomSongId = idOf(room?.currentSong);
  const detailSongId = String(songId || "");
  const isLiveSong = Boolean(currentRoomSongId && detailSongId && currentRoomSongId === detailSongId);

  return {
    ready,
    active: Boolean(room?.code && room?.currentSong?._id),
    isLiveSong,
    roomCode: String(room?.code || roomCode || ""),
    isHost: Boolean(room?._isHost),
    viewerId: String(room?._viewerId || ""),
    playbackState: room?.playbackState || "paused",
    listenerPaused: Boolean(listenerPaused),
    currentSong: room?.currentSong || null,
    livePosition,
    expectedPosition: expectedPosition(room),
  };
};

export default useSongDetailsLiveRoomSync;
