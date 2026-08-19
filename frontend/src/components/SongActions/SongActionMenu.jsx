import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  CalendarHeart,
  Check,
  ChevronLeft,
  Copy,
  Ellipsis,
  ExternalLink,
  ListMusic,
  ListPlus,
  Play,
  Share2,
  Sparkles,
} from "lucide-react";
import { MusicPlayerContext } from "../../context/MainPlayerContext";
import { MusicContext } from "../../context/ShopContext";
import { apiClient, authHeaders } from "../../config/apiClient";
import "./SongActionsV2324.css";

const compactQueue = (song, queue = []) => {
  const values = [song, ...(Array.isArray(queue) ? queue : [])].filter(Boolean);
  const seen = new Set();
  return values.filter((item) => {
    const key = String(item?._id || "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const SongActionMenu = ({
  song,
  queue = [],
  triggerClassName = "",
  triggerLabel = "More song options",
}) => {
  const navigate = useNavigate();
  const player = useContext(MusicPlayerContext);
  const music = useContext(MusicContext);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [playlistMode, setPlaylistMode] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [busy, setBusy] = useState("");
  const [status, setStatus] = useState("");
  const [position, setPosition] = useState({ top: 70, left: 20 });

  const token = music?.getAuthToken?.() || music?.token || "";
  const headers = useMemo(() => authHeaders(token), [token]);
  const actionQueue = useMemo(() => compactQueue(song, queue), [song, queue]);

  const close = () => {
    setOpen(false);
    setPlaylistMode(false);
    setStatus("");
  };

  const locate = () => {
    const rect = triggerRef.current?.getBoundingClientRect?.();
    if (!rect) return;
    const width = 278;
    const panelHeight = 430;
    const gap = 8;
    const left = Math.max(10, Math.min(window.innerWidth - width - 10, rect.right - width));
    const below = rect.bottom + gap;
    const top = below + panelHeight > window.innerHeight
      ? Math.max(10, rect.top - panelHeight - gap)
      : below;
    setPosition({ top, left });
  };

  const toggle = (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (!song?._id) return;
    if (!open) locate();
    setOpen((current) => !current);
    setPlaylistMode(false);
    setStatus("");
  };

  useEffect(() => {
    if (!open) return undefined;
    const outside = (event) => {
      if (triggerRef.current?.contains(event.target) || panelRef.current?.contains(event.target)) return;
      close();
    };
    const key = (event) => event.key === "Escape" && close();
    const move = () => locate();
    document.addEventListener("pointerdown", outside);
    window.addEventListener("keydown", key);
    window.addEventListener("resize", move);
    window.addEventListener("scroll", move, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("keydown", key);
      window.removeEventListener("resize", move);
      window.removeEventListener("scroll", move, true);
    };
  }, [open]);

  const requireAccount = () => {
    if (token) return true;
    close();
    navigate("/account");
    return false;
  };

  const run = async (key, fn) => {
    if (busy) return;
    setBusy(key);
    setStatus("");
    try {
      await fn();
    } catch (error) {
      setStatus(error?.response?.data?.message || error?.message || "Could not complete that action.");
    } finally {
      setBusy("");
    }
  };

  const openDetails = () => {
    close();
    navigate(`/song/${song._id}`, { state: { song, playlist: actionQueue } });
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const playAndOpen = () => {
    player?.playSong?.(song, actionQueue);
    openDetails();
  };

  const playNext = () => {
    player?.addNextToQueue?.(song);
    setStatus("Playing next.");
  };

  const addQueue = () => {
    player?.addToQueue?.(song);
    setStatus("Added to queue.");
  };

  const openPlaylists = async () => {
    if (!requireAccount()) return;
    setBusy("playlists");
    setStatus("");
    try {
      const values = await music?.fetchPlaylists?.();
      setPlaylists(Array.isArray(values) ? values : (music?.playlists || []));
    } catch {
      setPlaylists(music?.playlists || []);
    } finally {
      setBusy("");
      setPlaylistMode(true);
    }
  };

  const addToPlaylist = (playlistId) => run(`playlist:${playlistId}`, async () => {
    const { data } = await apiClient.post(
      "/api/playlist/add-song",
      { playlistId, songId: song._id },
      { headers }
    );
    if (!data?.success) throw new Error(data?.message || "Could not add song to playlist");
    setStatus("Added to playlist.");
    music?.fetchPlaylists?.();
  });

  const share = () => {
    close();
    navigate("/social/share", { state: { songId: song._id, song } });
  };

  const today = () => {
    if (!requireAccount()) return;
    run("today", async () => {
      const { data } = await apiClient.post(
        "/api/social/daily",
        { songId: song._id, note: "" },
        { headers }
      );
      if (!data?.success) throw new Error(data?.message || "Could not set today's song");
      setStatus("Today's song updated.");
      window.dispatchEvent(
        new CustomEvent("soundwave-social-mutated", {
          detail: { reason: "daily-pick", songId: song._id },
        })
      );
    });
  };

  const copy = async () => {
    const url = `${window.location.origin}/song/${song._id}`;
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Song link copied.");
    } catch {
      setStatus(url);
    }
  };

  const panel = open ? (
    <div
      ref={panelRef}
      className="sw2324-song-menu"
      role="menu"
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="sw2324-song-menu-head">
        {playlistMode ? (
          <button type="button" onClick={() => setPlaylistMode(false)} aria-label="Back">
            <ChevronLeft size={16} />
          </button>
        ) : (
          <span className="sw2324-song-menu-cover">
            <img src={song?.imageUrl || song?.coverImage || song?.image || "/fallback-cover.svg"} alt="" />
          </span>
        )}
        <span>
          <strong>{playlistMode ? "Add to playlist" : (song?.title || "Song")}</strong>
          <small>
            {playlistMode
              ? "Choose a playlist"
              : (song?.artist?.name || song?.artistName || song?.artist || "SoundWave")}
          </small>
        </span>
      </div>

      {status ? <div className="sw2324-song-menu-status"><Check size={13} />{status}</div> : null}

      {playlistMode ? (
        <div className="sw2324-song-menu-playlists">
          {playlists.length ? playlists.map((playlist) => (
            <button
              type="button"
              key={playlist._id}
              disabled={Boolean(busy)}
              onClick={() => addToPlaylist(playlist._id)}
            >
              <span><strong>{playlist.name || "Playlist"}</strong><small>{playlist.songs?.length || 0} songs</small></span>
              <ListPlus size={16} />
            </button>
          )) : (
            <button type="button" onClick={() => { close(); navigate("/playlist"); }}>
              <span><strong>Create a playlist</strong><small>No playlists yet</small></span>
              <ListPlus size={16} />
            </button>
          )}
        </div>
      ) : (
        <div className="sw2324-song-menu-actions">
          <button type="button" onClick={playAndOpen}><Play size={16} fill="currentColor"/><span><strong>Play now</strong><small>Play and open Song Details</small></span></button>
          <button type="button" onClick={playNext}><Sparkles size={16}/><span><strong>Play next</strong><small>Put it immediately after the current song</small></span></button>
          <button type="button" onClick={addQueue}><ListMusic size={16}/><span><strong>Add to queue</strong><small>Keep it for later</small></span></button>
          <button type="button" disabled={busy === "playlists"} onClick={openPlaylists}><ListPlus size={16}/><span><strong>Add to playlist</strong><small>Choose one of your playlists</small></span></button>
          <button type="button" onClick={share}><Share2 size={16}/><span><strong>Share song</strong><small>Open SoundWave Social share</small></span></button>
          <button type="button" disabled={busy === "today"} onClick={today}><CalendarHeart size={16}/><span><strong>Today's song</strong><small>Make it your daily pick</small></span></button>
          <button type="button" onClick={openDetails}><ExternalLink size={16}/><span><strong>Song details</strong><small>Open without changing playback</small></span></button>
          <button type="button" onClick={copy}><Copy size={16}/><span><strong>Copy song link</strong><small>Copy a direct SoundWave link</small></span></button>
        </div>
      )}
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`sw2324-song-more ${triggerClassName}`.trim()}
        onClick={toggle}
        aria-label={triggerLabel}
        aria-expanded={open}
        title="More options"
      >
        <Ellipsis size={18}/>
      </button>
      {open && typeof document !== "undefined" ? createPortal(panel, document.body) : null}
    </>
  );
};

export default SongActionMenu;
