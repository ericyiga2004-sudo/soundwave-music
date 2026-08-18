import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowBigUp, Check, Copy, Crown, Heart, LockKeyhole, MessageCircle, Pause, Play, Plus, RadioTower, RefreshCw, Send, SkipForward, Smile, UsersRound, Volume2, VolumeX, X } from "lucide-react";
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
import { SOCIAL_IMAGES } from "../components/Social/socialImages";
import "./CSS/Social.css";
import "./CSS/SocialV20.css";

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
  const [listenerPaused, setListenerPaused] = useState(false);
  const [roomClock, setRoomClock] = useState(0);
  const chatEndRef = useRef(null);
  const roomRef = useRef(null);
  const playerRef = useRef(player);
  const seekTimerRef = useRef(null);
  const pendingSeekRef = useRef(null);
  const listenerPausedRef = useRef(false);
  const roomCode = String(code || "").toUpperCase();

  roomRef.current = room;
  playerRef.current = player;
  listenerPausedRef.current = listenerPaused;

  const normalizeRoomResponse = useCallback((data) => {
    const raw = data?.room || {};
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
      _snapshotReceivedAt: Date.now(),
      _serverTime: data?.serverTime || null,
    };
  }, []);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!authToken || !roomCode) return null;
    if (!quiet) setLoading(true);
    try {
      const { data } = await apiClient.get(`/api/social/rooms/${roomCode}`, { headers });
      if (!data?.success) throw new Error(data?.message || "Could not load room");
      const nextRoom = normalizeRoomResponse(data);
      setRoom(nextRoom);
      setError("");
      return nextRoom;
    } catch (errorValue) {
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
    const receivedAt = Number(snapshot._snapshotReceivedAt || Date.now());
    return Math.max(0, base + Math.max(0, Date.now() - receivedAt) / 1000);
  }, []);

  const syncFromRoom = useCallback(async ({ force = false, ignoreLocalPause = false } = {}) => {
    const snapshot = roomRef.current;
    const activePlayer = playerRef.current;
    const current = snapshot?.currentSong;
    if (!current?._id || !activePlayer) return;

    // A listener's local pause never changes the room clock. Keep their device
    // quiet until they explicitly resume, then jump them to the host's live
    // position. Host pause/play still controls everybody who is following live.
    if (!snapshot?._isHost && listenerPausedRef.current && !ignoreLocalPause) return;

    const wantedPosition = expectedPosition(snapshot);
    const sameSong = String(activePlayer.currentSong?._id || "") === String(current._id);

    if (!sameSong) {
      const started = await activePlayer.playSong?.(current, [current], { roomSync: true });
      if (started !== false) {
        activePlayer.seekTo?.(wantedPosition, { roomSync: true });
      }
    } else {
      const actual = Number(activePlayer.progress || 0);
      const drift = Math.abs(actual - wantedPosition);
      if (force || drift > 1.1) {
        activePlayer.seekTo?.(wantedPosition, { roomSync: true });
      }
    }

    if (snapshot.playbackState === "paused") {
      if (activePlayer.isPlaying) activePlayer.pauseSong?.({ roomSync: true });
    } else if (!activePlayer.isPlaying) {
      await activePlayer.resumeSong?.({ roomSync: true });
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
    await syncFromRoom({ force: true, ignoreLocalPause: true });
    setMessage("Back live with the host.");
    return true;
  }, [syncFromRoom]);

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
          await playerRef.current?.playSong?.(data.currentSong, [data.currentSong], { roomSync: true });
          playerRef.current?.seekTo?.(0, { roomSync: true });
          await playerRef.current?.resumeSong?.({ roomSync: true });
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
  }, [headers, load, roomCode, syncFromRoom]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!socket || !roomCode) return undefined;

    const onRoomUpdate = (event) => {
      if (String(event?.code || "").toUpperCase() !== roomCode) return;
      // room:playback already carries the lightweight playback state. Avoid a
      // full room fetch for every host pause/seek/play command.
      if (event?.reason === "playback_changed") return;
      load({ quiet: true });
    };

    const onRoomPlayback = (event) => {
      if (String(event?.code || "").toUpperCase() !== roomCode) return;

      // A room advance can deliver the lightweight playback packet before the
      // populated room:update fetch finishes. If the song changed, refresh the
      // room first instead of briefly forcing the listener back to the old song.
      const eventSongId = String(event?.songId || "");
      const localSongId = String(roomRef.current?.currentSong?._id || "");
      if (!eventSongId && localSongId) {
        // Queue finished: refresh the populated room so every client clears
        // the old current song instead of trying to resync into it again.
        load({ quiet: true });
        return;
      }
      if (eventSongId && localSongId && eventSongId !== localSongId) {
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
        _snapshotReceivedAt: Date.now(),
        _serverTime: event.serverTime || null,
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
    socket.on("presence:update", onPresence);
    return () => {
      socket.off("room:update", onRoomUpdate);
      socket.off("room:playback", onRoomPlayback);
      socket.off("room:chat", onRoomChat);
      socket.off("room:chat:reaction", onRoomChatReaction);
      socket.off("presence:update", onPresence);
    };
  }, [socket, roomCode, load]);

  useEffect(() => {
    if (!authToken || connected) return undefined;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") load({ quiet: true });
    }, 1500);
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
    }, 1500);
    return () => window.clearInterval(interval);
  }, [room?.currentSong?._id, syncFromRoom]);

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
  }, [advanceRoom, pauseListenerLocally, resumeListenerLive, room?.code, room?._isHost, room?.currentSong?._id, sendPlaybackChange, syncFromRoom]);

  useEffect(() => () => {
    if (seekTimerRef.current) window.clearTimeout(seekTimerRef.current);
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
    if (listenerPausedRef.current) await playerRef.current?.resumeSong?.();
    else playerRef.current?.pauseSong?.();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setMessage("Room code copied.");
    } catch {
      setMessage(`Room code: ${room.code}`);
    }
  };

  const onlineCount = (room.members || []).filter((member) => member.user?.online).length;
  const roomPlaying = room.playbackState === "playing";
  const localLive = room._isHost || !listenerPaused;
  const hostName = nameOf(room.host);
  const roomDuration = Math.max(0, Number(room.currentSong?.duration || player?.duration || 0));
  const displayPosition = roomDuration ? Math.min(roomClock, roomDuration) : roomClock;
  const roomProgress = roomDuration > 0 ? Math.min(100, (displayPosition / roomDuration) * 100) : 0;

  return (
    <div className="sw-social-page sw20-page sw23-live-room-page">
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
            <p><strong>{hostName}</strong> is hosting · {onlineCount} online · {room.members?.length || 1} in room</p>
          </div>
        </div>
        <div className="sw23-room-code-card">
          <span><LockKeyhole size={13} /> Private room code</span>
          <div><code>{room.code}</code><button type="button" onClick={copy}><Copy size={14} /> Copy</button></div>
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
              <span className={`sw23-room-follow-state ${roomPlaying && localLive ? "live" : ""}`}>
                {room._isHost ? <><Crown size={14} /> Host controls</> : listenerPaused ? <><VolumeX size={14} /> Paused on this device</> : roomPlaying ? <><Volume2 size={14} /> Following live</> : <><Pause size={14} /> Host paused</>}
              </span>
            </div>

            {room.currentSong ? (
              <div className="sw23-now-playing-card">
                <img src={getSongCover(room.currentSong)} alt="" />
                <div className="sw23-now-playing-copy">
                  <small>Everyone in this room is synced to</small>
                  <strong>{room.currentSong.title}</strong>
                  <span>{getArtistName(room.currentSong)}</span>
                  <p>{room._isHost ? "Your player controls the room for everyone." : listenerPaused ? "The room keeps moving while your device is paused. Resume to jump back to the host’s current position." : "Your player follows the host’s song, position and host pause state."}</p>
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
                  <button type="button" className="sw23-room-play-btn" onClick={toggleRoomPlayback} aria-label={roomPlaying && !listenerPaused ? "Pause" : "Play"}>
                    {roomPlaying && !listenerPaused ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                  </button>
                  {room._isHost ? (
                    <button type="button" className="sw23-room-next-btn" onClick={advanceRoom}><SkipForward size={16} /> Play top voted</button>
                  ) : (
                    <button type="button" className="sw23-room-sync-btn" onClick={() => resumeListenerLive()} disabled={!listenerPaused && roomPlaying}>
                      <RefreshCw size={15} /> {listenerPaused ? "Rejoin live" : roomPlaying ? "In sync" : "Waiting for host"}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="sw23-room-empty-playing">
                <Play size={22} />
                <div><strong>No song playing yet</strong><span>{queue.length ? "The highest-voted song is ready for the host." : "Add songs below, then vote for what everyone should hear."}</span></div>
                {room._isHost && queue.length ? <button type="button" className="sw23-room-start-btn" onClick={advanceRoom}><Play size={15} fill="currentColor" /> Start top voted</button> : null}
              </div>
            )}
          </section>

          <section className="sw-social-panel sw20-panel sw23-room-queue-panel">
            <div className="sw23-queue-heading">
              <div>
                <span className="sw-social-kicker">Room queue</span>
                <h2>Vote what everyone hears next</h2>
                <p>One vote per listener. Tap again to cancel your vote. Highest votes win; ties go to the earliest add.</p>
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
                      <small>{index === 0 ? "Top voted · plays next" : `Added by ${nameOf(entry.addedBy)}`}</small>
                    </div>
                    <button type="button" className={`sw23-vote-btn ${hasVoted ? "voted" : ""}`} onClick={() => vote(entry._id)} aria-pressed={hasVoted}>
                      {hasVoted ? <X size={15} /> : <ArrowBigUp size={16} />}
                      <span>{hasVoted ? "Cancel vote" : "Vote"}</span>
                      <strong>{entry.votes?.length || 0}</strong>
                    </button>
                  </article>
                );
              }) : (
                <div className="sw23-empty-queue"><ArrowBigUp size={20} /><div><strong>No songs waiting</strong><span>Add a song and cast the first vote.</span></div></div>
              )}
            </div>
          </section>
        </main>

        <aside className="sw23-room-side">
          <section className="sw-social-panel sw20-panel sw23-live-chat-panel">
            <div className="sw23-live-chat-header">
              <div><span className="sw-social-kicker">Live chat</span><h2>Room conversation</h2></div>
              <span><MessageCircle size={15} /> Live</span>
            </div>
            <p className="sw23-live-chat-note">Messages and reactions appear instantly while the music keeps playing.</p>

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
              )) : <div className="sw23-chat-empty"><MessageCircle size={20} /><strong>Chat is live</strong><span>Say hello, react to the song, or drop a heart.</span></div>}
              <span ref={chatEndRef} />
            </div>

            <div className="sw-live-emoji-row sw23-live-emoji-row" aria-label="Quick emojis">
              {["❤️", "🔥", "😂", "👏", "🎵", "🙌"].map((emoji) => <button type="button" key={emoji} onClick={(event) => sendChat(event, emoji)} disabled={chatBusy}>{emoji}</button>)}
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
    </div>
  );
};

export default LiveRoom;
