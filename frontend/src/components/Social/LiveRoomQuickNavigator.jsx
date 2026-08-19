import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ACTIVE_ROOM_SESSION_EVENT,
  readActiveLiveRoomSession,
} from "../../utils/liveRoomSession";
import "../../pages/CSS/LiveRoomQuickNavigator.css";

const normalizeCode = (value = "") => String(value || "").trim().toUpperCase();

const LiveRoomQuickNavigator = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState(() => readActiveLiveRoomSession());

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
      setSession(event?.detail?.session || readActiveLiveRoomSession());
    };

    window.addEventListener(ACTIVE_ROOM_SESSION_EVENT, onSessionChange);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    // Very light fallback in case a browser blocks/discards a custom event.
    // This is only a sessionStorage read; there is NO API/network polling.
    const timer = window.setInterval(refresh, 4000);

    return () => {
      window.removeEventListener(ACTIVE_ROOM_SESSION_EVENT, onSessionChange);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    // Route changes can happen without the live room writing a new snapshot.
    // Re-read once so the button appears immediately when leaving LiveRoom.
    refresh();
  }, [location.pathname]);

  const roomCode = normalizeCode(session?.code);
  const roomPath = roomCode ? `/social/rooms/${roomCode}` : "";
  const alreadyInsideRoom = useMemo(() => {
    if (!roomCode) return false;
    return normalizeCode(location.pathname) === normalizeCode(roomPath);
  }, [location.pathname, roomCode, roomPath]);

  const hasLiveSong = Boolean(session?.currentSongId || session?.currentSong?._id);

  if (!roomCode || !hasLiveSong || alreadyInsideRoom) return null;

  const songTitle =
    String(session?.currentSong?.name || session?.currentSong?.title || "").trim();

  return (
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
  );
};

export default LiveRoomQuickNavigator;
