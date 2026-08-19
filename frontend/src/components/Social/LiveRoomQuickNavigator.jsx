import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { useRealtime } from "../../context/RealtimeContext";
import {
  ACTIVE_ROOM_SESSION_EVENT,
  clearActiveLiveRoomSession,
  readActiveLiveRoomSession,
} from "../../utils/liveRoomSession";
import "../../pages/CSS/LiveRoomQuickNavigator.css";
import "../../pages/CSS/LiveRoomLifecycleV2322.css";

const normalizeCode = (value = "") => String(value || "").trim().toUpperCase();
const DISMISSED_KEY = "soundwave:live-quick-nav-dismissed-room";

const readDismissedCode = () => {
  if (typeof window === "undefined") return "";
  try {
    return normalizeCode(window.sessionStorage.getItem(DISMISSED_KEY) || "");
  } catch {
    return "";
  }
};

const LiveRoomQuickNavigator = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { socket } = useRealtime();
  const [session, setSession] = useState(() => readActiveLiveRoomSession());
  const [dismissedCode, setDismissedCode] = useState(() => readDismissedCode());

  const refresh = () => {
    const next = readActiveLiveRoomSession();
    setSession((current) => {
      const currentKey = `${current?.code || ""}|${current?.currentSongId || ""}|${current?.savedAt || 0}`;
      const nextKey = `${next?.code || ""}|${next?.currentSongId || ""}|${next?.savedAt || 0}`;
      return currentKey === nextKey ? current : next;
    });
  };

  useEffect(() => {
    refresh();

    const onSessionChange = (event) => {
      const next = event?.detail?.session || readActiveLiveRoomSession();
      setSession(next);
      const nextCode = normalizeCode(next?.code);
      if (nextCode && dismissedCode && nextCode !== dismissedCode) {
        try {
          window.sessionStorage.removeItem(DISMISSED_KEY);
        } catch {}
        setDismissedCode("");
      }
    };

    window.addEventListener(ACTIVE_ROOM_SESSION_EVENT, onSessionChange);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(refresh, 4000);

    return () => {
      window.removeEventListener(ACTIVE_ROOM_SESSION_EVENT, onSessionChange);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.clearInterval(timer);
    };
  }, [dismissedCode]);

  useEffect(() => {
    refresh();
  }, [location.pathname]);

  const roomCode = normalizeCode(session?.code);
  const roomPath = roomCode ? `/social/rooms/${roomCode}` : "";
  const alreadyInsideRoom = useMemo(() => {
    if (!roomCode) return false;
    return normalizeCode(location.pathname) === normalizeCode(roomPath);
  }, [location.pathname, roomCode, roomPath]);

  useEffect(() => {
    if (!alreadyInsideRoom || !roomCode || dismissedCode !== roomCode) return;
    try {
      window.sessionStorage.removeItem(DISMISSED_KEY);
    } catch {}
    setDismissedCode("");
  }, [alreadyInsideRoom, dismissedCode, roomCode]);

  useEffect(() => {
    if (!socket || !roomCode) return undefined;

    const onRoomUpdate = (event) => {
      if (normalizeCode(event?.code) !== roomCode) return;
      if (event?.reason !== "room_deleted") return;
      clearActiveLiveRoomSession(roomCode);
      setSession(null);
      setDismissedCode("");
      try {
        window.sessionStorage.removeItem(DISMISSED_KEY);
      } catch {}
    };

    socket.on("room:update", onRoomUpdate);
    return () => socket.off("room:update", onRoomUpdate);
  }, [roomCode, socket]);

  const hasLiveSong = Boolean(session?.currentSongId || session?.currentSong?._id);

  if (!roomCode || !hasLiveSong || alreadyInsideRoom || dismissedCode === roomCode) {
    return null;
  }

  const songTitle = String(session?.currentSong?.name || session?.currentSong?.title || "").trim();

  const dismiss = () => {
    try {
      window.sessionStorage.setItem(DISMISSED_KEY, roomCode);
    } catch {}
    setDismissedCode(roomCode);
  };

  return (
    <div className="sw2322-live-jump-wrap">
      <button
        type="button"
        className="sw2321-live-jump"
        onClick={() => navigate(roomPath)}
        aria-label={`Go to live room ${roomCode}`}
        title={songTitle ? `Back to live: ${songTitle}` : `Back to live room ${roomCode}`}
      >
        <span className="sw2321-live-jump__signal" aria-hidden="true">
          <span className="sw2321-live-jump__dot" />
          <span className="sw2321-live-jump__live">LIVE</span>
        </span>
        <span className="sw2321-live-jump__copy">
          <strong>Go to Live</strong>
          <small>{roomCode}</small>
        </span>
        <span className="sw2321-live-jump__arrow" aria-hidden="true">→</span>
      </button>

      <button
        type="button"
        className="sw2322-live-jump-close"
        onClick={dismiss}
        aria-label="Dismiss live room shortcut"
        title="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default LiveRoomQuickNavigator;
