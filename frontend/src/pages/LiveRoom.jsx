import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowBigUp, Check, ChevronDown, Copy, Crown, Heart, LockKeyhole, MessageCircle, Pause, Play, Plus, RadioTower, RefreshCw, Send, SkipForward, Smile, ThumbsUp, UsersRound, Volume2, VolumeX, X } from "lucide-react";
import { MusicContext } from "../context/ShopContext";
import { MusicPlayerContext } from "../context/MainPlayerContext";
import { useRealtime } from "../context/RealtimeContext";
import { apiClient, authHeaders } from "../config/apiClient";
import { getArtistName, getSongCover } from "../utils/catalog";
import AccountRequired from "../components/UI/AccountRequired";
import CatalogSkeleton from "../components/UI/CatalogSkeleton";
import EmptyState from "../components/UI/EmptyState";
import SocialSongPicker from "../components/Social/SocialSongPicker";
import SocialNav from "../components/Social/SocialNav";
import RoomReactionSharedLedger from "../components/Social/RoomReactionSharedLedger";
import { SOCIAL_IMAGES } from "../components/Social/socialImages";
import "./CSS/Social.css";
import "./CSS/SocialV20.css";
import "./CSS/LiveRoomPremiumV2318.css";

const nameOf = (user) => user?.username || user?.name || "Listener";
const formatClock = (seconds = 0) => {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
};

const chatTime = (value) => {
  if (!value) return "now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "now";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const LiveRoom = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { token, getAuthToken, songs = [] } = useContext(MusicContext);
  const player = useContext(MusicPlayerContext);
  const { socket, connected, mode } = useRealtime();
  const authToken = getAuthToken?.() || token || "";
  const headers = useMemo(() => authHeaders(authToken), [authToken]);
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(Boolean(authToken));
  const [error, setError] = useState("");
  const [songId, setSongId] = useState("");
  const [message, setMessage] = useState("");
  const [chatBody, setChatBody] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [hostPlayBusy, setHostPlayBusy] = useState("");
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [roomPanel, setRoomPanel] = useState("queue");
  const [chatOpen, setChatOpen] = useState(false);
  const [listenerPaused, setListenerPaused] = useState(false);
  const [roomClock, setRoomClock] = useState(0);
  const chatEndRef = useRef(null);
  const roomRef = useRef(null);
  const playerRef = useRef(player);
  const seekTimerRef = useRef(null);
  const pendingSeekRef = useRef(null);
  const listenerPausedRef = useRef(false);
  const joinAttemptRef = useRef(false);
  const gestureUnlockInFlightRef = useRef(false);
  const previousHostQueueCountRef = useRef(0);
  const seenRoomReactionIdsRef = useRef(new Set());
  const reactionTimersRef = useRef(new Map());
  const reactionChannelRef = useRef(null);
  const reactionSequenceRef = useRef(0);
  const serverClockOffsetRef = useRef(null);
  const syncInFlightRef = useRef(false);
  const lastHardSyncAtRef = useRef(0);
  const wasBufferingRef = useRef(false);
  const driftBreachSinceRef = useRef(0);
  const driftDirectionRef = useRef(0);
  const roomCode = String(code || "").toUpperCase();
  const pendingHostQueueCount = useMemo(() => (room?.queue || []).filter((entry) => !entry.played).length, [room?.queue]);

  roomRef.current = room;
  playerRef.current = player;
  listenerPausedRef.current = listenerPaused;

  const normalizeRoomResponse = useCallback((data, requestStartedAt = Date.now()) => {
    const raw = data?.room || {};
    const receivedAt = Date.now();
    const serverTimeMs = Date.parse(data?.serverTime || "");
    if (Number.isFinite(serverTimeMs)) {
      // Estimate the server clock from the midpoint of the request. This lets
      // listeners account for network travel time instead of starting every
      // room clock only when the response happens to arrive on their device.
      const midpoint = (Number(requestStartedAt || receivedAt) + receivedAt) / 2;
      serverClockOffsetRef.current = serverTimeMs - midpoint;
    }
    return {
      ...raw,
      chat: (raw.chat || []).map((item) => ({
        ...item,
        reactions: (item.reactions || []).map((reaction) => ({
          emoji: reaction.emoji,
          count: Number(reaction.count ?? reaction.users?.length ?? 0),
        })),
      })),
      _isHost: Boolean(data?.isHost),
      _viewerId: String(data?.viewerId || ""),
      _expectedPosition: Math.max(0, Number(data?.expectedPosition || raw.playbackPosition || 0)),
      _snapshotReceivedAt: receivedAt,
      _serverTime: data?.serverTime || null,
      _serverClockOffsetMs: Number.isFinite(serverClockOffsetRef.current) ? serverClockOffsetRef.current : 0,
    };
  }, []);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!authToken || !roomCode) return null;
    if (!quiet) setLoading(true);
    try {
      const requestStartedAt = Date.now();
      const { data } = await apiClient.get(`/api/social/rooms/${roomCode}`, { headers });
      if (!data?.success) throw new Error(data?.message || "Could not load room");
      const nextRoom = normalizeRoomResponse(data, requestStartedAt);
      setRoom(nextRoom);
      setError("");
      return nextRoom;
    } catch (errorValue) {
      // V23.4: a private room link is also a join link. If a logged-in user
      // opens the host's exact /social/rooms/:code URL but is not a member yet,
      // join that room once and immediately reload it. This avoids accidentally
      // creating a second room when friends are trying to listen together.
      if (errorValue?.response?.status === 404 && !joinAttemptRef.current) {
        joinAttemptRef.current = true;
        try {
          const { data: joined } = await apiClient.post("/api/social/rooms/join", { code: roomCode }, { headers });
          if (joined?.success) {
            const retryStartedAt = Date.now();
            const { data } = await apiClient.get(`/api/social/rooms/${roomCode}`, { headers });
            if (data?.success) {
              const nextRoom = normalizeRoomResponse(data, retryStartedAt);
              setRoom(nextRoom);
              setError("");
              return nextRoom;
            }
          }
        } catch {
          // Fall through to the original room-unavailable message.
        }
      }
      if (!quiet) setError(errorValue?.response?.data?.message || errorValue.message || "Could not load room");
      return null;
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [authToken, headers, normalizeRoomResponse, roomCode]);

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

    // playbackStartedAt is the authoritative leader clock origin. Using it
    // means a slow listener catches up to where the host is NOW, not to the
    // stale timestamp at which the SSE packet reached that listener.
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
    if (syncInFlightRef.current) return;
    const snapshot = roomRef.current;
    const activePlayer = playerRef.current;
    const current = snapshot?.currentSong;
    if (!current?._id || !activePlayer) return;

    // A listener's local pause never changes the leader's room clock.
    if (!snapshot?._isHost && listenerPausedRef.current && !ignoreLocalPause) return;

    syncInFlightRef.current = true;
    try {
      const wantedPosition = expectedPosition(snapshot);
      const sameSong = String(activePlayer.currentSong?._id || "") === String(current._id);
      const audioNode = activePlayer.audioRef?.current || null;

      if (!sameSong) {
        // If the leader has selected the next song but their own media is still
        // preparing, keep listeners silent. The first PLAYING packet starts
        // everybody together from the leader's real media clock.
        if (!snapshot?._isHost && snapshot.playbackState !== "playing") return;

        // Start/load the exact song chosen by the leader. playSong may wait on
        // the network, so calculate the target AGAIN after it resolves. That
        // prevents slow listeners from beginning several seconds behind.
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
          // Only perform the post-start correction after the browser is
          // genuinely playing. Seeking a still-buffering range request can
          // restart that request and is a major cause of slow live joins.
          if (
            startedAudio &&
            !startedAudio.paused &&
            !activePlayer.isBuffering &&
            Math.abs(liveTarget - startedAt) > 2.2
          ) {
            activePlayer.seekTo?.(liveTarget, { roomSync: true });
            lastHardSyncAtRef.current = Date.now();
          }
        } else if (!latestSnapshot?._isHost && latestSnapshot.playbackState === "playing") {
          setMessage("Live audio is waiting for this device. SoundWave will catch up to the leader as soon as audio can start.");
        }
      } else {
        const liveAudio = activePlayer.audioRef?.current || audioNode;
        const actual = Number.isFinite(liveAudio?.currentTime)
          ? Number(liveAudio.currentTime)
          : Number(activePlayer.progress || 0);
        // V23.8 smooth-room sync: prioritize uninterrupted audio over chasing
        // sub-second clock differences. Frequent seeks and large playback-rate
        // swings can sound like stutter on remote/mobile streams.
        const listenerTarget = Math.max(0, wantedPosition - 0.22);
        const signedDrift = listenerTarget - actual;
        const drift = Math.abs(signedDrift);
        const buffering = Boolean(activePlayer.isBuffering) || Boolean(liveAudio && !liveAudio.paused && liveAudio.readyState < 3);

        if (!snapshot?._isHost && liveAudio && snapshot.playbackState === "playing") {
          try {
            liveAudio.preservesPitch = true;
            liveAudio.webkitPreservesPitch = true;
          } catch {
            // Older browsers may not expose pitch-preservation controls.
          }

          if (buffering) {
            // Never seek or speed-change while the browser is filling its
            // buffer. Let the current range request finish instead of
            // repeatedly invalidating it.
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
            // Only a large, sustained desync earns a hard seek. This is rare
            // enough that it corrects a truly late listener without making
            // normal playback choppy.
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
              // An inaudibly small correction is applied only after drift has
              // stayed in the same direction for several seconds. Hysteresis
              // prevents rate oscillation around the threshold.
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
        // resumeSong itself can spend time buffering. Recalculate from the
        // leader clock after it returns and immediately catch up again.
        const afterResume = roomRef.current || latest;
        const resumedAudio = activePlayer.audioRef?.current || null;
        if (resumedAudio && !resumedAudio.paused) {
          const liveTarget = expectedPosition(afterResume);
          const actual = Number(resumedAudio.currentTime || 0);
          if (Math.abs(liveTarget - actual) > 3.2 && Date.now() - lastHardSyncAtRef.current > 6500) {
            activePlayer.seekTo?.(Math.max(0, liveTarget - 0.22), { roomSync: true });
            lastHardSyncAtRef.current = Date.now();
          }
        } else if (!afterResume?._isHost) {
          setMessage("Tap Join live audio once if your browser asks for permission. After that, buffering listeners automatically catch up to the leader.");
        }
      }
    } finally {
      syncInFlightRef.current = false;
    }
  }, [expectedPosition]);

  const pauseListenerLocally = useCallback(() => {
    listenerPausedRef.current = true;
    setListenerPaused(true);
    setMessage("Paused on this device. The live room is still moving with the host.");
  }, []);

  const resumeListenerLive = useCallback(async () => {
    listenerPausedRef.current = false;
    setListenerPaused(false);

    const snapshot = roomRef.current;
    const activePlayer = playerRef.current;
    const target = Math.max(0, expectedPosition(snapshot) - 0.08);

    // If this came from a click/tap, start the HTML media element immediately
    // inside that gesture. This avoids losing browser audio permission while
    // asynchronous room sync/network work is still happening.
    let startedFromGesture = false;
    if (!snapshot?._isHost && snapshot?.playbackState === "playing" && activePlayer?.resumeLiveRoomFromGesture) {
      startedFromGesture = await activePlayer.resumeLiveRoomFromGesture(target);
    }

    await syncFromRoom({ force: true, ignoreLocalPause: true });
    setMessage(startedFromGesture ? "Live audio connected to the host." : "Back live with the host.");
    return true;
  }, [expectedPosition, syncFromRoom]);

  const unlockListenerAudioFromAnyGesture = useCallback(() => {
    if (gestureUnlockInFlightRef.current) return;
    const snapshot = roomRef.current;
    const activePlayer = playerRef.current;

    if (
      !snapshot ||
      snapshot._isHost ||
      snapshot.playbackState !== "playing" ||
      !snapshot.currentSong?._id ||
      listenerPausedRef.current ||
      activePlayer?.isPlaying
    ) {
      return;
    }

    // Do not interfere with ordinary network buffering. Only convert a normal
    // room click/tap into the one browser permission gesture when autoplay was
    // actually rejected.
    const needsGesture = /tap|enable live|permission|notallowed/i.test(String(activePlayer?.playbackError || ""));
    if (!needsGesture) return;

    gestureUnlockInFlightRef.current = true;
    const target = Math.max(0, expectedPosition(snapshot) - 0.08);

    Promise.resolve(activePlayer?.resumeLiveRoomFromGesture?.(target))
      .then(() => syncFromRoom({ force: true, ignoreLocalPause: true }))
      .finally(() => {
        window.setTimeout(() => {
          gestureUnlockInFlightRef.current = false;
        }, 350);
      });
  }, [expectedPosition, syncFromRoom]);


  const spawnRoomReaction = useCallback((payload = {}) => {
    const emoji = String(payload?.emoji || "❤️");
    const reactionId = String(payload?.reactionId || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
    if (seenRoomReactionIdsRef.current.has(reactionId)) return;
    seenRoomReactionIdsRef.current.add(reactionId);

    // V23.13: motion is generated once by the sender and shared with the room.
    const duration = Math.max(2400, Math.min(6200, Number(payload?.duration || (3000 + Math.floor(Math.random() * 1800)))));
    const startedAt = Number(payload?.startedAt || Date.now());
    const elapsed = Math.max(0, Math.min(duration - 20, Date.now() - startedAt));
    const bubble = {
      id: reactionId,
      emoji,
      left: Math.max(4, Math.min(94, Number(payload?.left ?? (6 + Math.random() * 88)))),
      drift: Math.max(-220, Math.min(220, Number(payload?.drift ?? (-105 + Math.random() * 210)))),
      scale: Math.max(0.72, Math.min(1.65, Number(payload?.scale ?? (0.86 + Math.random() * 0.48)))),
      duration,
      delay: -elapsed,
    };

    setFloatingReactions((current) => [...current.slice(-139), bubble]);
    const timer = window.setTimeout(() => {
      setFloatingReactions((current) => current.filter((item) => item.id !== reactionId));
      reactionTimersRef.current.delete(reactionId);
      window.setTimeout(() => seenRoomReactionIdsRef.current.delete(reactionId), 15000);
    }, duration + 500);
    reactionTimersRef.current.set(reactionId, timer);
  }, []);

  // Same-device rooms (for example two localhost browser windows) get a
  // zero-latency cross-tab path in addition to the server SSE path. Remote
  // devices still receive the exact same packet through room:reaction.
  useEffect(() => {
    // Legacy V1 reaction transport intentionally disabled.
    return undefined;

    let channel = null;
    if ("BroadcastChannel" in window) {
      channel = new BroadcastChannel("soundwave-live-room-reactions-v1");
      reactionChannelRef.current = channel;
      channel.onmessage = (event) => {
        const packet = event?.data;
        if (String(packet?.code || "").toUpperCase() !== roomCode || !packet?.emoji) return;
        spawnRoomReaction(packet);
      };
    }

    const onStorage = (event) => {
      if (event.key !== "soundwave:live-room-reaction" || !event.newValue) return;
      try {
        const packet = JSON.parse(event.newValue);
        if (String(packet?.code || "").toUpperCase() !== roomCode || !packet?.emoji) return;
        spawnRoomReaction(packet);
      } catch {
        // Ignore malformed ephemeral reaction packets.
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("storage", onStorage);
      try { channel?.close?.(); } catch {}
      if (reactionChannelRef.current === channel) reactionChannelRef.current = null;
    };
  }, [roomCode, spawnRoomReaction]);

  const broadcastReactionToLocalTabs = useCallback((packet) => {
    try {
      reactionChannelRef.current?.postMessage?.(packet);
    } catch {
      // BroadcastChannel is only a local fast path; SSE remains authoritative.
    }
    try {
      localStorage.setItem("soundwave:live-room-reaction", JSON.stringify({ ...packet, localAt: Date.now() }));
      localStorage.removeItem("soundwave:live-room-reaction");
    } catch {
      // Private browsing/storage restrictions should not block room reactions.
    }
  }, []);

  const sendRoomReaction = useCallback(async (emoji = "❤️") => {
    const snapshot = roomRef.current;
    if (!snapshot?.code) return;

    reactionSequenceRef.current += 1;
    const reactionId = `${snapshot._viewerId || "room"}-${Date.now()}-${reactionSequenceRef.current}-${Math.random().toString(36).slice(2, 7)}`;
    const packet = {
      code: String(snapshot.code).toUpperCase(),
      reactionId,
      emoji,
      actorId: snapshot._viewerId || "",
      startedAt: Date.now(),
      left: 6 + Math.random() * 88,
      drift: -105 + Math.random() * 210,
      scale: 0.86 + Math.random() * 0.48,
      duration: 3000 + Math.floor(Math.random() * 1800),
      at: new Date().toISOString(),
    };

    // 1) The person who tapped sees the bubble immediately.
    spawnRoomReaction(packet);
    // 2) Other tabs/windows on the same device see it immediately too.
    broadcastReactionToLocalTabs(packet);
    // 3) The backend broadcasts it to every authenticated member of this room,
    //    including the leader and the sender's other devices.
    const post = () => apiClient.post(`/api/social/rooms/${snapshot.code}/reactions`, {
      emoji, reactionId, startedAt: packet.startedAt, left: packet.left,
      drift: packet.drift, scale: packet.scale, duration: packet.duration,
    }, { headers });
    try {
      await post();
    } catch {
      // Retry once. If the first request actually reached the server but only
      // its response was lost, the repeated reactionId is harmless because all
      // clients de-duplicate by reactionId.
      window.setTimeout(() => {
        post().catch(() => {});
      }, 220);
    }
  }, [broadcastReactionToLocalTabs, headers, spawnRoomReaction]);

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
    } catch (errorValue) {
      setMessage(errorValue?.response?.data?.message || "Could not update room playback.");
      return null;
    }
  }, [headers]);

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
    if (!snapshot?._isHost || !snapshot?.code) {
      setMessage("Only the host can change the room song.");
      await syncFromRoom({ force: true });
      return snapshot?.currentSong || null;
    }

    try {
      const { data } = await apiClient.post(`/api/social/rooms/${snapshot.code}/advance`, {}, { headers });
      if (data?.success) {
        if (data.currentSong) {
          const started = await playerRef.current?.playSong?.(data.currentSong, [data.currentSong], { roomSync: true });
          if (started !== false) {
            playerRef.current?.seekTo?.(0, { roomSync: true });
            const leaderPosition = Number(playerRef.current?.audioRef?.current?.currentTime || playerRef.current?.progress || 0);
            await postPlayback({ playbackState: "playing", position: leaderPosition });
          }
        }
        window.dispatchEvent(new CustomEvent("soundwave-social-mutated", {
          detail: { reason: "room-advance", code: roomCode, songId: data.currentSong?._id || "" },
        }));
        await load({ quiet: true });
        return data.currentSong || null;
      }
      return null;
    } catch (errorValue) {
      setMessage(errorValue?.response?.data?.message || "Only the host can advance the room.");
      return null;
    }
  }, [headers, load, postPlayback, roomCode, syncFromRoom]);

  useEffect(() => {
    load();
  }, [load]);

  // V23.6: when the first votable song arrives, reveal the host-only player
  // automatically. Members never see this tab. If the waiting queue becomes
  // empty, return the host to the shared queue view.
  useEffect(() => {
    const previousCount = previousHostQueueCountRef.current;
    if (room?._isHost && pendingHostQueueCount > 0 && previousCount === 0) {
      setRoomPanel("leader");
    } else if (pendingHostQueueCount === 0 && roomPanel === "leader") {
      setRoomPanel("queue");
    }
    previousHostQueueCountRef.current = pendingHostQueueCount;
  }, [pendingHostQueueCount, room?._isHost, roomPanel]);

  useEffect(() => {
    if (!socket || !roomCode) return undefined;

    const onRoomUpdate = (event) => {
      if (String(event?.code || "").toUpperCase() !== roomCode) return;
      if (event?.reason === "live_reaction" && event?.reaction?.emoji) {
        spawnRoomReaction(event.reaction);
        return;
      }
      // room:playback already carries the lightweight playback state. Avoid a
      // full room fetch for every host pause/seek/play command.
      if (event?.reason === "playback_changed") return;
      load({ quiet: true });
    };

    const onRoomPlayback = (event) => {
      if (String(event?.code || "").toUpperCase() !== roomCode) return;

      const receivedAt = Date.now();
      const eventServerMs = Date.parse(event?.serverTime || "");
      if (!Number.isFinite(serverClockOffsetRef.current) && Number.isFinite(eventServerMs)) {
        serverClockOffsetRef.current = eventServerMs - receivedAt;
      }

      // The playback packet is the wake-up signal for a newly selected song.
      // Always fetch the populated song when its id differs, including the
      // first song when the listener currently has no room song at all.
      const eventSongId = String(event?.songId || "");
      const localSongId = String(roomRef.current?.currentSong?._id || "");
      if ((!eventSongId && localSongId) || (eventSongId && eventSongId !== localSongId)) {
        load({ quiet: true });
        return;
      }

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

    const onRoomChat = (event) => {
      if (String(event?.code || "").toUpperCase() !== roomCode || !event?.message?._id) return;
      setRoom((current) => current ? {
        ...current,
        chat: [...(current.chat || []).filter((item) => String(item?._id) !== String(event.message._id)), event.message].slice(-120),
      } : current);
    };

    const onRoomChatReaction = (event) => {
      if (String(event?.code || "").toUpperCase() !== roomCode || !event?.messageId) return;
      setRoom((current) => current ? {
        ...current,
        chat: (current.chat || []).map((item) => String(item?._id) === String(event.messageId)
          ? { ...item, reactions: event.reactions || [] }
          : item),
      } : current);
    };

    const onRoomReaction = (event) => {
      if (String(event?.code || "").toUpperCase() !== roomCode || !event?.emoji) return;
      spawnRoomReaction(event);
    };

    const onPresence = (event) => {
      const userId = String(event?.userId || "");
      if (!userId) return;
      setRoom((current) => current ? {
        ...current,
        host: String(current.host?._id || current.host || "") === userId ? { ...current.host, online: Boolean(event.online) } : current.host,
        members: (current.members || []).map((member) => String(member.user?._id || member.user || "") === userId
          ? { ...member, user: { ...member.user, online: Boolean(event.online) } }
          : member),
      } : current);
    };

    socket.on("room:update", onRoomUpdate);
    socket.on("room:playback", onRoomPlayback);
    socket.on("room:chat", onRoomChat);
    socket.on("room:chat:reaction", onRoomChatReaction);
    // Legacy room:reaction disabled by V23.14.
    socket.on("presence:update", onPresence);
    return () => {
      socket.off("room:update", onRoomUpdate);
      socket.off("room:playback", onRoomPlayback);
      socket.off("room:chat", onRoomChat);
      socket.off("room:chat:reaction", onRoomChatReaction);
      socket.off("presence:update", onPresence);
    };
  }, [socket, roomCode, load, spawnRoomReaction]);

  useEffect(() => {
    if (!authToken) return undefined;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") load({ quiet: true });
    }, connected ? 4500 : 1500);
    return () => window.clearInterval(interval);
  }, [authToken, connected, load]);

  useEffect(() => {
    if (!authToken) return undefined;
    const refresh = () => {
      if (document.visibilityState === "visible") load({ quiet: true });
    };
    const onMutation = (event) => {
      const eventCode = String(event?.detail?.code || "").toUpperCase();
      if (!eventCode || eventCode === roomCode) refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("soundwave-social-mutated", onMutation);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("soundwave-social-mutated", onMutation);
    };
  }, [authToken, load, roomCode]);

  useEffect(() => {
    if (!room?.currentSong?._id) return;
    syncFromRoom({ force: true });
  }, [room?.currentSong?._id, room?.playbackVersion, room?.playbackState, syncFromRoom]);

  useEffect(() => {
    if (!room?.currentSong?._id) return undefined;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") syncFromRoom({ force: false });
    }, 1800);
    return () => window.clearInterval(interval);
  }, [room?.currentSong?._id, syncFromRoom]);

  useEffect(() => {
    const bufferingNow = Boolean(player?.isBuffering);
    const wasBuffering = wasBufferingRef.current;
    wasBufferingRef.current = bufferingNow;

    if (
      room?.currentSong?._id &&
      !room?._isHost &&
      room?.playbackState === "playing" &&
      !listenerPausedRef.current &&
      !bufferingNow &&
      player?.isPlaying &&
      wasBuffering
    ) {
      // Give the browser a short stability window after a stall. Seeking the
      // instant `playing` fires can throw away the buffer it just recovered.
      const timer = window.setTimeout(() => syncFromRoom({ force: true }), 650);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [player?.isBuffering, player?.isPlaying, room?.currentSong?._id, room?._isHost, room?.playbackState, syncFromRoom]);

  useEffect(() => {
    const updateClock = () => setRoomClock(expectedPosition(roomRef.current));
    updateClock();
    if (!room?.currentSong?._id) return undefined;
    const interval = window.setInterval(updateClock, 500);
    return () => window.clearInterval(interval);
  }, [expectedPosition, room?.currentSong?._id, room?.playbackState, room?.playbackVersion]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [room?.chat?.length]);

  useEffect(() => {
    if (!chatOpen) return;
    const frame = window.requestAnimationFrame(() => {
      chatEndRef.current?.scrollIntoView?.({ block: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [chatOpen]);

  useEffect(() => {
    if (!room?.code || !room?.currentSong?._id) return undefined;

    window.dispatchEvent(new CustomEvent("soundwave-room-control", {
      detail: {
        active: true,
        code: room.code,
        isHost: Boolean(room._isHost),
        currentSongId: String(room.currentSong._id),
        onPlaybackChange: sendPlaybackChange,
        onNext: advanceRoom,
        onLocalPause: pauseListenerLocally,
        onListenerResume: resumeListenerLive,
        getExpectedPosition: () => expectedPosition(roomRef.current),
        onBlocked: (reason) => {
          const action = reason === "seek" ? "Seeking" : reason === "next" || reason === "previous" ? "Changing songs" : "Starting another song";
          setMessage(`${action} is controlled by the host. You can locally pause and rejoin live anytime.`);
          if (!listenerPausedRef.current) syncFromRoom({ force: true });
        },
      },
    }));

    return () => {
      window.dispatchEvent(new CustomEvent("soundwave-room-control", { detail: { active: false } }));
    };
  }, [advanceRoom, expectedPosition, pauseListenerLocally, resumeListenerLive, room?.code, room?._isHost, room?.currentSong?._id, sendPlaybackChange, syncFromRoom]);

  useEffect(() => () => {
    if (seekTimerRef.current) window.clearTimeout(seekTimerRef.current);
    reactionTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    reactionTimersRef.current.clear();
    window.dispatchEvent(new CustomEvent("soundwave-room-control", { detail: { active: false } }));
  }, []);

  if (!authToken) return <div className="sw-social-page"><AccountRequired title="Sign in to join Pass the Aux" /></div>;
  if (loading && !room) return <div className="sw-social-page"><CatalogSkeleton count={8} /></div>;
  if (error && !room) return <div className="sw-social-page"><EmptyState title="Room unavailable" message={error} onRetry={() => load()} /></div>;
  if (!room) return null;

  const queue = [...(room.queue || [])]
    .filter((entry) => !entry.played)
    .sort((a, b) => (b.votes?.length || 0) - (a.votes?.length || 0) || new Date(a.createdAt) - new Date(b.createdAt));

  const addSong = async (event) => {
    event.preventDefault();
    if (!songId) return;
    try {
      const { data } = await apiClient.post(`/api/social/rooms/${room.code}/queue`, { songId }, { headers });
      if (data?.success) {
        setSongId("");
        setMessage("Added to the room queue. Everyone connected sees it live.");
        window.dispatchEvent(new CustomEvent("soundwave-social-mutated", { detail: { reason: "room-queue", code: roomCode, songId } }));
        load({ quiet: true });
      }
    } catch (errorValue) {
      setMessage(errorValue?.response?.data?.message || "Could not add song.");
    }
  };

  const vote = async (entryId) => {
    try {
      const { data } = await apiClient.post(`/api/social/rooms/${room.code}/queue/${entryId}/vote`, {}, { headers });
      if (data?.success) {
        setRoom((current) => current ? {
          ...current,
          queue: (current.queue || []).map((entry) => {
            if (String(entry._id) !== String(entryId)) return entry;
            const viewerId = String(current._viewerId || "");
            const existing = (entry.votes || []).map((item) => String(item?._id || item));
            const nextIds = data.voted
              ? [...new Set([...existing, viewerId].filter(Boolean))]
              : existing.filter((item) => item !== viewerId);
            return { ...entry, votes: nextIds };
          }),
        } : current);
      }
      window.dispatchEvent(new CustomEvent("soundwave-social-mutated", { detail: { reason: "room-vote", code: roomCode, entryId } }));
    } catch {
      setMessage("Could not update your vote.");
    }
  };

  const sendChat = async (event, quickBody = "") => {
    event?.preventDefault?.();
    const body = String(quickBody || chatBody || "").trim().slice(0, 280);
    if (!body || chatBusy || !room?.code) return;
    setChatBusy(true);
    try {
      const { data } = await apiClient.post(`/api/social/rooms/${room.code}/chat`, { body }, { headers });
      if (!data?.success) throw new Error(data?.message || "Could not send message");
      if (data.message?._id) {
        setRoom((current) => current ? {
          ...current,
          chat: [...(current.chat || []).filter((item) => String(item?._id) !== String(data.message._id)), data.message].slice(-120),
        } : current);
      }
      setChatBody("");
    } catch (errorValue) {
      setMessage(errorValue?.response?.data?.message || errorValue.message || "Could not send live message.");
    } finally {
      setChatBusy(false);
    }
  };

  const reactChat = async (messageId, emoji = "❤️") => {
    if (!messageId || !room?.code) return;
    try {
      const { data } = await apiClient.post(`/api/social/rooms/${room.code}/chat/${messageId}/react`, { emoji }, { headers });
      if (data?.success) {
        setRoom((current) => current ? {
          ...current,
          chat: (current.chat || []).map((item) => String(item?._id) === String(messageId)
            ? { ...item, reactions: data.reactions || [] }
            : item),
        } : current);
      }
    } catch {
      setMessage("Could not react to that message.");
    }
  };


  const hostPlayQueuedSong = async (entryId) => {
    if (!room?._isHost || !room?.code || !entryId || hostPlayBusy) return;
    setHostPlayBusy(String(entryId));
    try {
      const { data } = await apiClient.post(`/api/social/rooms/${room.code}/queue/${entryId}/play`, {}, { headers });
      if (!data?.success || !data.currentSong) throw new Error(data?.message || "Could not play that song");

      listenerPausedRef.current = false;
      setListenerPaused(false);
      const started = await playerRef.current?.playSong?.(data.currentSong, [data.currentSong], { roomSync: true });
      if (started === false) {
        await load({ quiet: true });
        setMessage("The voted song is selected, but the leader audio is still loading. Press Play when it is ready; listeners will start from your exact live position.");
        return;
      }
      playerRef.current?.seekTo?.(0, { roomSync: true });
      const leaderPosition = Number(playerRef.current?.audioRef?.current?.currentTime || playerRef.current?.progress || 0);
      await postPlayback({ playbackState: "playing", position: leaderPosition });

      setMessage(`${data.currentSong.title || "Voted song"} is now live for the whole room.`);
      window.dispatchEvent(new CustomEvent("soundwave-social-mutated", {
        detail: { reason: "room-host-play", code: roomCode, songId: data.currentSong?._id || "" },
      }));
      await load({ quiet: true });
    } catch (errorValue) {
      setMessage(errorValue?.response?.data?.message || errorValue.message || "Could not play that voted song.");
    } finally {
      setHostPlayBusy("");
    }
  };

  const toggleRoomPlayback = async () => {
    if (!room?.currentSong?._id) {
      if (room?._isHost && queue.length) await advanceRoom();
      return;
    }
    if (room._isHost) {
      if (room.playbackState === "playing") playerRef.current?.pauseSong?.();
      else {
        await syncFromRoom({ force: true, ignoreLocalPause: true });
        playerRef.current?.resumeSong?.();
      }
      return;
    }

    if (room.playbackState !== "playing") {
      setMessage("The host has paused the room. Playback resumes for everyone when the host presses Play.");
      return;
    }
    if (listenerPausedRef.current || !playerRef.current?.isPlaying) await resumeListenerLive();
    else playerRef.current?.pauseSong?.();
  };

  const copy = async () => {
    const inviteUrl = `${window.location.origin}/social/rooms/${room.code}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setMessage(`Invite copied for room ${room.code}. Everyone must join this exact room to share votes, chat and playback.`);
    } catch {
      setMessage(`Share room code ${room.code}. Everyone must join the same code to listen together.`);
    }
  };

  const onlineCount = (room.members || []).filter((member) => member.user?.online).length;
  const chatMessageCount = (room.chat || []).length;
  const roomPlaying = room.playbackState === "playing";
  const hostName = nameOf(room.host);
  const roomDuration = Math.max(0, Number(room.currentSong?.duration || player?.duration || 0));
  const displayPosition = roomDuration ? Math.min(roomClock, roomDuration) : roomClock;
  const roomProgress = roomDuration > 0 ? Math.min(100, (displayPosition / roomDuration) * 100) : 0;
  const nextQueued = queue[0] || null;
  const localAudioFollowing = Boolean(room._isHost ? (roomPlaying && player?.isPlaying) : (roomPlaying && !listenerPaused && player?.isPlaying));

  return (
    <div className="sw-social-page sw20-page sw23-live-room-page sw2318-premium-room" onPointerDownCapture={unlockListenerAudioFromAnyGesture} onKeyDownCapture={unlockListenerAudioFromAnyGesture}>
      <SocialNav />

      <header className="sw23-room-header">
        <div className="sw23-room-title">
          <span className="sw23-room-broadcast"><RadioTower size={19} /></span>
          <div>
            <div className="sw20-detail-kicker">
              <span className="sw-social-kicker">Pass the Aux</span>
              <span className={connected ? "sw20-realtime-pill online" : mode === "polling" ? "sw20-realtime-pill fallback" : "sw20-realtime-pill"}>
                {connected ? "Live now" : mode === "polling" ? "Live fallback" : "Connecting"}
              </span>
            </div>
            <h1>{room.name}</h1>
            <p><strong>{hostName}</strong> is hosting · {onlineCount} online · {room.members?.length || 1} in room · everyone must use code <strong>{room.code}</strong></p>
          </div>
        </div>
        <div className="sw23-room-code-card">
          <span><LockKeyhole size={13} /> Private room code</span>
          <div><code>{room.code}</code><button type="button" onClick={copy}><Copy size={14} /> Copy invite</button></div>
        </div>
      </header>

      {message ? <div className="sw-social-message sw23-room-message">{message}</div> : null}

      <div className="sw23-live-room-grid">
        <main className="sw23-room-main">
          <section className="sw-social-panel sw20-panel sw23-now-playing">
            <div className="sw23-now-playing-topline">
              <div>
                <span className="sw-social-kicker">Now playing</span>
                <h2>{roomPlaying ? "Live with the host" : "Room paused"}</h2>
              </div>
              <span className={`sw23-room-follow-state ${localAudioFollowing ? "live" : ""}`}>
                {room._isHost ? <><Crown size={14} /> Host controls</> : listenerPaused ? <><VolumeX size={14} /> Paused on this device</> : player?.playbackError?.toLowerCase?.().includes("tap play") ? <><Play size={14} /> Enable live audio</> : player?.isBuffering && roomPlaying ? <><RefreshCw size={14} /> Joining live…</> : roomPlaying && player?.isPlaying ? <><Volume2 size={14} /> Following live</> : roomPlaying ? <><RefreshCw size={14} /> Tap to join audio</> : <><Pause size={14} /> Host paused</>}
              </span>
            </div>

            {room.currentSong ? (
              <div className="sw23-now-playing-card">
                <img src={getSongCover(room.currentSong)} alt="" />
                <div className="sw23-now-playing-copy">
                  <small>Everyone in this room is synced to</small>
                  <strong>{room.currentSong.title}</strong>
                  <span>{getArtistName(room.currentSong)}</span>
                  <p>{room._isHost ? "Your player is the room clock. Play, pause, seek and Next are sent to every joined member." : listenerPaused ? "Only this device is paused. The live room keeps moving; press Play to catch up to the host’s current position." : player?.playbackError?.toLowerCase?.().includes("tap play") ? "Your browser needs one audio permission gesture. Tap anywhere in the room or press Start live audio once; after that SoundWave follows the host automatically." : player?.isBuffering ? "Joining the host’s current position. SoundWave now starts from a small playable buffer instead of waiting for a long full-buffer check." : player?.isPlaying ? "Your media follows the leader’s song, position and pause state automatically." : "The room is live. Tap Play once if your browser requires permission to start audio."}</p>
                  <div className="sw24-vote-lock">
                    <strong>Current song stays locked.</strong>
                    <span>{nextQueued ? `${nextQueued.song?.title || "The leading song"} is currently next with ${nextQueued.votes?.length || 0} vote${(nextQueued.votes?.length || 0) === 1 ? "" : "s"}. New votes can reorder the waiting queue without interrupting this song.` : "Votes can keep changing while this song plays. The current song will not be interrupted."}</span>
                  </div>
                  <div className="sw23-room-progress-wrap">
                    <div className="sw23-room-progress-time"><span>{formatClock(displayPosition)}</span><span>{roomDuration ? formatClock(roomDuration) : "Live"}</span></div>
                    <input
                      className="sw23-room-progress"
                      type="range"
                      min="0"
                      max={roomDuration || Math.max(1, displayPosition)}
                      step="0.25"
                      value={roomDuration ? Math.min(displayPosition, roomDuration) : 0}
                      style={{ "--sw-room-progress": `${roomProgress}%` }}
                      disabled={!room._isHost || !roomDuration}
                      onChange={(event) => room._isHost && playerRef.current?.seekTo?.(Number(event.target.value))}
                      aria-label={room._isHost ? "Seek room playback" : "Host playback position"}
                    />
                  </div>
                </div>
                <div className="sw23-room-player-actions">
                  <button type="button" className="sw23-room-play-btn" onClick={toggleRoomPlayback} aria-label={localAudioFollowing ? "Pause" : "Play"}>
                    {localAudioFollowing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                  </button>
                  {room._isHost ? (
                    <button type="button" className="sw23-room-next-btn" onClick={advanceRoom}><SkipForward size={16} /> Next · top voted</button>
                  ) : (
                    <button type="button" className="sw23-room-sync-btn" onClick={() => resumeListenerLive()} disabled={!listenerPaused && roomPlaying && player?.isPlaying}>
                      <RefreshCw size={15} /> {listenerPaused ? "Rejoin live" : roomPlaying && player?.isPlaying ? "In sync" : roomPlaying ? "Start live audio" : "Waiting for host"}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="sw23-room-empty-playing">
                <Play size={22} />
                <div><strong>No song playing yet</strong><span>{queue.length ? "The highest-voted song is ready for the host." : "Add songs below, then vote for what everyone should hear."}</span></div>
                {room._isHost && queue.length ? <button type="button" className="sw23-room-start-btn" onClick={advanceRoom}><Play size={15} fill="currentColor" /> Start voted queue</button> : null}
              </div>
            )}
          </section>

          {room._isHost && queue.length ? (
            <div className="sw26-room-tabs" role="tablist" aria-label="Host room controls">
              <button
                type="button"
                role="tab"
                aria-selected={roomPanel === "queue"}
                className={roomPanel === "queue" ? "active" : ""}
                onClick={() => setRoomPanel("queue")}
              >
                <ArrowBigUp size={15} />
                <span>Room Queue</span>
                <strong>{queue.length}</strong>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={roomPanel === "leader"}
                className={`sw26-leader-tab ${roomPanel === "leader" ? "active" : ""}`}
                onClick={() => setRoomPanel("leader")}
              >
                <Crown size={15} />
                <span>Leader Player</span>
                <strong>{queue.length} ready</strong>
              </button>
            </div>
          ) : null}

          {room._isHost && queue.length && roomPanel === "leader" ? (
            <section className="sw-social-panel sw20-panel sw25-leader-player sw26-leader-player-tab">
              <div className="sw25-leader-player-head">
                <div>
                  <span className="sw-social-kicker">Leader only · voted queue</span>
                  <h2>Voted Songs Player</h2>
                  <p>Only you can start a queued song. Members keep voting while music plays; their votes reorder this waiting list but never interrupt the current track.</p>
                </div>
                <span className="sw25-leader-badge"><Crown size={14} /> Host player</span>
              </div>

              <form className="sw2310-host-add-song" onSubmit={addSong}>
                <div>
                  <span>Host participation</span>
                  <strong>Add another song</strong>
                  <small>You are part of the room too — add tracks and vote exactly like every listener.</small>
                </div>
                <div className="sw2310-host-picker">
                  <SocialSongPicker songs={songs} value={songId} onChange={setSongId} label="Add a song as host" maxVisible={5} compact />
                  <button className="sw-primary-btn" type="submit" disabled={!songId}><Plus size={15} /> Add</button>
                </div>
              </form>

              {queue.length ? (
                <>
                  <div className="sw25-leader-top">
                    <img src={getSongCover(queue[0].song)} alt="" />
                    <div>
                      <small>#1 by live votes</small>
                      <strong>{queue[0].song?.title || "Top voted song"}</strong>
                      <span>{getArtistName(queue[0].song)} · {queue[0].votes?.length || 0} vote{(queue[0].votes?.length || 0) === 1 ? "" : "s"}</span>
                    </div>
                    <button type="button" onClick={() => hostPlayQueuedSong(queue[0]._id)} disabled={Boolean(hostPlayBusy)}>
                      <Play size={16} fill="currentColor" />
                      {hostPlayBusy === String(queue[0]._id) ? "Starting…" : room.currentSong ? "Play top voted now" : "Start top voted"}
                    </button>
                  </div>

                  <div className="sw25-leader-list">
                    {queue.slice(0, 8).map((entry, index) => (
                      <article key={`leader-${entry._id}`}>
                        <span className="sw25-leader-rank">{index + 1}</span>
                        <img src={getSongCover(entry.song)} alt="" />
                        <div>
                          <strong>{entry.song?.title}</strong>
                          <span>{getArtistName(entry.song)}</span>
                        </div>
                        <span className="sw25-leader-votes"><ThumbsUp size={14} fill="currentColor" /> {entry.votes?.length || 0}</span>
                        {(() => {
                          const viewerId = String(room._viewerId || "");
                          const hasVoted = (entry.votes || []).some((item) => String(item?._id || item) === viewerId);
                          return (
                            <button
                              type="button"
                              className={`sw2310-leader-vote ${hasVoted ? "voted" : ""}`}
                              onClick={() => vote(entry._id)}
                              aria-pressed={hasVoted}
                              title={hasVoted ? "Remove your vote" : "Vote for this song"}
                            >
                              <ThumbsUp size={14} fill={hasVoted ? "currentColor" : "none"} />
                              <span>{hasVoted ? "Voted" : "Vote"}</span>
                            </button>
                          );
                        })()}
                        <button
                          type="button"
                          className="sw25-leader-play"
                          onClick={() => hostPlayQueuedSong(entry._id)}
                          disabled={Boolean(hostPlayBusy)}
                          aria-label={`Play ${entry.song?.title || "voted song"} for the room`}
                        >
                          <Play size={14} fill="currentColor" />
                          {hostPlayBusy === String(entry._id) ? "Starting…" : "Play"}
                        </button>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <div className="sw25-leader-empty">
                  <Play size={20} />
                  <div><strong>No voted songs ready</strong><span>Members can add songs below. As soon as songs are queued, your leader player will appear here.</span></div>
                </div>
              )}
            </section>
          ) : null}

          {(!room._isHost || !queue.length || roomPanel === "queue") ? (
          <section className="sw-social-panel sw20-panel sw23-room-queue-panel">
            <div className="sw23-queue-heading">
              <div>
                <span className="sw-social-kicker">Room queue</span>
                <h2>Live Queue</h2>
                <p>Waiting songs reorder live from highest votes to lowest. One vote per member; tap again to cancel. Ties go to the earliest add. Vote changes never interrupt the song already playing.</p>
              </div>
              <span className="sw23-queue-count">{queue.length} queued</span>
            </div>

            <form className="sw23-room-add-song" onSubmit={addSong}>
              <SocialSongPicker songs={songs} value={songId} onChange={setSongId} label="Add a song to this live room" maxVisible={8} compact />
              <button className="sw-primary-btn" type="submit" disabled={!songId}><Plus size={15} /> Add to live queue</button>
            </form>

            <div className="sw23-room-queue-list">
              {queue.length ? queue.map((entry, index) => {
                const viewerId = String(room._viewerId || "");
                const hasVoted = (entry.votes || []).some((item) => String(item?._id || item) === viewerId);
                return (
                  <article className={index === 0 ? "is-leading" : ""} key={entry._id}>
                    <span className="sw23-queue-rank">{index + 1}</span>
                    <img src={getSongCover(entry.song)} alt="" />
                    <div className="sw23-queue-copy">
                      <strong>{entry.song?.title}</strong>
                      <span>{getArtistName(entry.song)}</span>
                      <small>{index === 0 ? "Top voted · plays next when current song finishes" : `Added by ${nameOf(entry.addedBy)}`}</small>
                    </div>
                    <button type="button" className={`sw23-vote-btn ${hasVoted ? "voted" : ""}`} onClick={() => vote(entry._id)} aria-pressed={hasVoted}>
                      <ThumbsUp size={16} fill={hasVoted ? "currentColor" : "none"} />
                      <span>{hasVoted ? "Voted" : "Vote"}</span>
                      <strong>{entry.votes?.length || 0}</strong>
                    </button>
                  </article>
                );
              }) : (
                <div className="sw23-empty-queue"><ThumbsUp size={20} /><div><strong>No songs waiting</strong><span>Add a song and cast the first vote.</span></div></div>
              )}
            </div>
          </section>
          ) : null}
        </main>

        <aside className="sw23-room-side">
          <section className={`sw-social-panel sw20-panel sw23-live-chat-panel sw2318-chat-sheet ${chatOpen ? "is-open" : ""}`} aria-hidden={!chatOpen}>
            <div className="sw23-live-chat-header sw2318-chat-sheet-header">
              <div><span className="sw-social-kicker">Live chat</span><h2>Room Chat</h2></div>
              <div className="sw2318-chat-sheet-actions">
                <span><MessageCircle size={15} /> {chatMessageCount} messages</span>
                <button type="button" className="sw2318-chat-collapse" onClick={() => setChatOpen(false)} aria-label="Collapse live chat" title="Collapse chat">
                  <ChevronDown size={18} />
                </button>
              </div>
            </div>
            <p className="sw23-live-chat-note">Live conversation while the room keeps playing.</p>

            <div className="sw-live-chat-list sw23-live-chat-list" aria-live="polite">
              {(room.chat || []).length ? (room.chat || []).map((item) => (
                <article className="sw-live-chat-message sw23-live-chat-message" key={item._id}>
                  <span className="sw-social-avatar small">{item.user?.image ? <img src={item.user.image} alt="" /> : nameOf(item.user).slice(0, 1).toUpperCase()}</span>
                  <div>
                    <div className="sw23-chat-author"><strong>{nameOf(item.user)}</strong>{item.user?.online ? <i className="sw-online-dot" title="Online" /> : null}<time>{chatTime(item.createdAt)}</time></div>
                    <p>{item.body}</p>
                    <div className="sw-live-chat-reactions">
                      {(item.reactions || []).map((reaction) => <button type="button" key={`${item._id}-${reaction.emoji}`} onClick={() => reactChat(item._id, reaction.emoji)}>{reaction.emoji} {reaction.count || 0}</button>)}
                      <button type="button" className="sw-live-heart" onClick={() => reactChat(item._id, "❤️")} title="Heart"><Heart size={12} /> Heart</button>
                    </div>
                  </div>
                </article>
              )) : <div className="sw23-chat-empty"><MessageCircle size={20} /><strong>Chat is live</strong><span>Say hello here. Use the heart button for live room reactions.</span></div>}
              <span ref={chatEndRef} />
            </div>

            <form className="sw-live-chat-form sw23-live-chat-form" onSubmit={sendChat}>
              <Smile size={16} />
              <input value={chatBody} onChange={(event) => setChatBody(event.target.value.slice(0, 280))} placeholder="Message everyone listening…" />
              <button type="submit" disabled={!chatBody.trim() || chatBusy} aria-label="Send live message"><Send size={15} /></button>
            </form>
          </section>

          <section className="sw-social-panel sw20-panel sw23-room-members-panel">
            <div className="sw23-members-heading">
              <div><span className="sw-social-kicker">People</span><h2>In the room</h2></div>
              <span><UsersRound size={15} /> {onlineCount} online</span>
            </div>
            <div className="sw23-members-list">
              {(room.members || []).map((member) => {
                const isHostMember = String(room.host?._id || room.host) === String(member.user?._id || member.user);
                return (
                  <button type="button" key={member.user?._id || member._id} onClick={() => member.user?._id && navigate(`/u/${member.user._id}`)}>
                    <span className="sw23-member-avatar-wrap">
                      <span className="sw-social-avatar small">{member.user?.image ? <img src={member.user.image} alt="" /> : nameOf(member.user).slice(0, 1).toUpperCase()}</span>
                      {member.user?.online ? <i className="sw-online-dot" title="Online" aria-label="Online" /> : null}
                    </span>
                    <span><strong>{nameOf(member.user)}</strong><small>{isHostMember ? "Host" : member.user?.online ? "Listening now" : "In room"}</small></span>
                    {isHostMember ? <Crown size={14} /> : member.user?.online ? <Check size={14} /> : null}
                  </button>
                );
              })}
            </div>
          </section>
        </aside>
      </div>

      {chatOpen ? (
        <button
          type="button"
          className="sw2318-chat-backdrop"
          onClick={() => setChatOpen(false)}
          aria-label="Close live chat"
        />
      ) : null}

      <button
        type="button"
        className={`sw2318-chat-launcher ${chatOpen ? "is-open" : ""}`}
        onClick={() => setChatOpen((current) => !current)}
        aria-expanded={chatOpen}
        aria-label={`Live chat, ${chatMessageCount} message${chatMessageCount === 1 ? "" : "s"}`}
        title="Live chat"
      >
        <MessageCircle size={21} strokeWidth={2.15} />
        <span className="sw2318-chat-count">{chatMessageCount > 99 ? "99+" : chatMessageCount}</span>
      </button>

      <RoomReactionSharedLedger roomCode={roomCode} viewerId={room?._viewerId || ""} />
    </div>
  );
};

export default LiveRoom;
