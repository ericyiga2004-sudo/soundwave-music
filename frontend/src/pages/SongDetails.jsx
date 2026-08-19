import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  Heart,
  ListMusic,
  ListPlus,
  FastForward,
  MessageCircle,
  Reply,
  Clock3,
  Sparkles,
  Pause,
  Play,
  Rewind,
  Share2,
  SkipBack,
  SkipForward,
  Trash2,
} from "lucide-react";
import { MusicContext } from "../context/ShopContext";
import { MusicPlayerContext } from "../context/MainPlayerContext";
import { useRealtime } from "../context/RealtimeContext";
import { apiClient, authHeaders, cachedGet } from "../config/apiClient";
import { formatCompactNumber, formatDuration, getArtistName, getSongCover } from "../utils/catalog";
import { getBatterySaver } from "../utils/uiPreferences";
import { isSongOfflineAvailable, removeOfflineSong, saveSongForOffline } from "../utils/offlineDownload";
import { trackTasteEvent } from "../utils/personalization";
import useSongDetailsLiveRoomSync from "../hooks/useSongDetailsLiveRoomSync";
import CatalogSkeleton from "../components/UI/CatalogSkeleton";
import EmptyState from "../components/UI/EmptyState";
import "./CSS/SongDetails.css";
import "./CSS/SongDetailsLiveV2320.css";

const parseLrc = (value = "") => {
  if (!value || typeof value !== "string") return [];
  const output = [];
  value.split(/\r?\n/).forEach((line) => {
    const matches = [...line.matchAll(/\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g)];
    if (!matches.length) return;
    const text = line.replace(/\[[^\]]+\]/g, "").trim() || "♪";
    matches.forEach((match) => {
      const mins = Number(match[1]); const secs = Number(match[2]);
      const fractionRaw = match[3] || "0";
      const fraction = Number(fractionRaw) / (fractionRaw.length === 1 ? 10 : fractionRaw.length === 2 ? 100 : 1000);
      const start = mins * 60 + secs + fraction;
      if (Number.isFinite(start)) output.push({ start, text });
    });
  });
  return output.sort((a,b)=>a.start-b.start).map((line,index,all)=>({ ...line, end: all[index+1]?.start ?? null }));
};

const normalizeLyrics = (song) => {
  if (Array.isArray(song?.syncedLyrics) && song.syncedLyrics.length) {
    return song.syncedLyrics
      .map((line) => ({ start: Number(line.start || 0), end: line.end == null ? null : Number(line.end), text: String(line.text || "♪") }))
      .filter((line) => Number.isFinite(line.start))
      .sort((a,b)=>a.start-b.start);
  }
  const lrc = parseLrc(song?.lrcLyrics || "");
  if (lrc.length) return lrc;
  if (typeof song?.lyrics === "string" && song.lyrics.trim()) {
    return song.lyrics.split(/\r?\n/).map((text) => text.trim()).filter(Boolean).map((text) => ({ start: null, end: null, text }));
  }
  return [];
};

const commentListSignature = (items = []) => JSON.stringify((items || []).map((item) => [
  item?._id,
  item?.updatedAt || item?.createdAt,
  item?.likes || 0,
  item?.repliesCount || 0,
]));

const momentListSignature = (items = []) => JSON.stringify((items || []).map((item) => [
  item?._id,
  item?.updatedAt || item?.createdAt,
  item?.likes || 0,
  (item?.replies || []).length,
]));

const trailSignature = (items = []) => JSON.stringify((items || []).map((item) => [
  item?._id,
  item?.updatedAt || item?.createdAt,
]));

const SongDetails = () => {
  const { songId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { songs: globalSongs = [], getAuthToken, playlists = [], fetchPlaylists } = useContext(MusicContext);
  const player = useContext(MusicPlayerContext);
  const { socket: realtimeSocket, connected: realtimeConnected, mode: realtimeMode } = useRealtime();
  const token = getAuthToken?.() || "";

  const [song, setSong] = useState(location.state?.song || null);
  const [loading, setLoading] = useState(!location.state?.song);
  const [error, setError] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(Number(location.state?.song?.likes || 0));
  const [likeBusy, setLikeBusy] = useState(false);
  const [offlineSaved, setOfflineSaved] = useState(false);
  const [offlineBusy, setOfflineBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [lyricsExpanded, setLyricsExpanded] = useState(() => {
    if (typeof window === "undefined") return true;
    return !window.matchMedia("(max-width: 767.98px)").matches;
  });

  const [comments, setComments] = useState([]);
  const [commentPage, setCommentPage] = useState(1);
  const [commentTotal, setCommentTotal] = useState(0);
  const [commentsMore, setCommentsMore] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentBody, setCommentBody] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [editBody, setEditBody] = useState("");
  const [commentSort, setCommentSort] = useState("recent");
  const [commentAtTime, setCommentAtTime] = useState(false);
  const [repliesByComment, setRepliesByComment] = useState({});
  const [replyOpen, setReplyOpen] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [replyBusy, setReplyBusy] = useState("");
  const [replyTarget, setReplyTarget] = useState(null);

  const [moments, setMoments] = useState([]);
  const [momentsLoading, setMomentsLoading] = useState(false);
  const [momentBody, setMomentBody] = useState("");
  const [momentEmoji, setMomentEmoji] = useState("🔥");
  const [momentReplyOpen, setMomentReplyOpen] = useState("");
  const [momentReplyBody, setMomentReplyBody] = useState("");
  const [momentReplyTarget, setMomentReplyTarget] = useState("");
  const [trail, setTrail] = useState([]);
  const commentsRef = useRef([]);
  const repliesRef = useRef({});
  commentsRef.current = comments;
  repliesRef.current = repliesByComment;

  const lyricsRef = useRef(null);
  const lyricsScrollRef = useRef(null);
  const lineRefs = useRef([]);
  const mobileSwipeRef = useRef({ active: false, x: 0, y: 0 });

  const liveRoomSync = useSongDetailsLiveRoomSync({
    songId,
    player,
    authToken: token,
    socket: realtimeSocket,
    connected: realtimeConnected,
    onStatus: setStatus,
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mobileQuery = window.matchMedia("(max-width: 767.98px)");
    const syncLyricsMode = (event) => setLyricsExpanded(!event.matches);
    syncLyricsMode(mobileQuery);
    if (mobileQuery.addEventListener) mobileQuery.addEventListener("change", syncLyricsMode);
    else mobileQuery.addListener?.(syncLyricsMode);
    return () => {
      if (mobileQuery.removeEventListener) mobileQuery.removeEventListener("change", syncLyricsMode);
      else mobileQuery.removeListener?.(syncLyricsMode);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767.98px)").matches) {
      setLyricsExpanded(false);
    }
  }, [songId]);

  // React Router keeps this page mounted when only :songId changes. Sync the
  // visible song immediately from the player/navigation state so Next,
  // Previous and Up Next never leave the old song artwork/title on screen.
  useEffect(() => {
    const activeSong = player?.currentSong;
    const routedSong = location.state?.song;
    const immediateSong =
      String(activeSong?._id || "") === String(songId)
        ? activeSong
        : String(routedSong?._id || "") === String(songId)
          ? routedSong
          : null;

    if (!immediateSong) return;
    if (String(song?._id || "") === String(immediateSong._id)) return;

    setSong(immediateSong);
    setLikes(Number(immediateSong.likes || 0));
    setError("");
    setLoading(false);
    setStatus("");
    setPlaylistOpen(false);
  }, [location.state, player?.currentSong, song?._id, songId]);

  const routePlaylist = location.state?.playlist;
  const playlistFromRoute = useMemo(
    () => (Array.isArray(routePlaylist) ? routePlaylist : []),
    [routePlaylist]
  );
  const queue = useMemo(() => playlistFromRoute.length ? playlistFromRoute : (globalSongs.length ? globalSongs : song ? [song] : []), [playlistFromRoute, globalSongs, song]);
  const isCurrent = player?.currentSong?._id === song?._id;
  const isPlaying = isCurrent && player?.isPlaying;
  const playerProgress = isCurrent ? Number(player?.progress || 0) : 0;
  // When this is the song currently playing in a live room, the visible
  // timeline follows the ROOM clock. A listener can pause only their device
  // while this clock keeps advancing, exactly like the Live Room page.
  const progress = liveRoomSync.isLiveSong
    ? Math.max(0, Number(liveRoomSync.livePosition ?? playerProgress ?? 0))
    : playerProgress;
  const lyrics = useMemo(() => normalizeLyrics(song), [song]);
  const synced = lyrics.some((line) => Number.isFinite(line.start));
  const activeLyricIndex = useMemo(() => {
    if (!synced || !isCurrent) return -1;
    let active = -1;
    lyrics.forEach((line, index) => { if (Number.isFinite(line.start) && progress >= line.start) active = index; });
    return active;
  }, [lyrics, progress, synced, isCurrent]);

  const detailDuration = useMemo(() => {
    const liveDuration = Number(player?.duration || 0);
    if (isCurrent && Number.isFinite(liveDuration) && liveDuration > 0) return liveDuration;
    const raw = Number(song?.duration || 0);
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    return raw > 10000 ? raw / 1000 : raw;
  }, [isCurrent, player?.duration, song?.duration]);

  const detailProgress = isCurrent ? Math.min(Math.max(0, Number(progress || 0)), detailDuration || Number(progress || 0)) : 0;
  const compactLyricIndex = activeLyricIndex >= 0 ? activeLyricIndex : 0;
  const compactLyric = lyrics[compactLyricIndex]?.text || lyrics[0]?.text || "Lyrics";
  const compactNextLyric = lyrics[compactLyricIndex + 1]?.text || "";

  const liveRoomStatus = liveRoomSync.isLiveSong
    ? liveRoomSync.isHost
      ? liveRoomSync.playbackState === "playing"
        ? "You control this live room from Song Details."
        : "Live room paused by you. Press Play here to resume everyone."
      : liveRoomSync.listenerPaused
        ? `Paused on this device · room is live at ${formatDuration(liveRoomSync.livePosition)}.`
        : liveRoomSync.playbackState === "playing"
          ? "Synced to the live room host."
          : "The host has paused the live room."
    : "";
  const liveListenerSeekLocked = Boolean(liveRoomSync.isLiveSong && !liveRoomSync.isHost);

  const fetchSong = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await cachedGet(`/api/songs/${songId}`, { ttl: 20000 });
      if (!data?.success || !data.song) throw new Error(data?.message || "Song not found");
      setSong(data.song); setLikes(Number(data.song.likes || 0));
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Could not load this song");
    } finally { setLoading(false); }
  }, [songId]);

  useEffect(() => { if (!song?._id || String(song._id) !== String(songId)) fetchSong(); else { setLoading(false); setLikes(Number(song.likes || 0)); } }, [fetchSong, song, songId]);

  useEffect(() => {
    if (!song?._id) return;
    const controller = new AbortController();
    const genre = song.genre && song.genre !== "Unknown" ? song.genre : "";
    cachedGet("/api/songs/filter", { params: { genre, limit: 8, sort: "popular" }, ttl: 35000, signal: controller.signal })
      .then((data) => setRecommendations((data?.songs || []).filter((item) => item._id !== song._id).slice(0,6)))
      .catch(() => setRecommendations([]));
    return () => controller.abort();
  }, [song?._id, song?.genre]);

  useEffect(() => {
    if (!song?._id) return;
    isSongOfflineAvailable(song).then(setOfflineSaved).catch(() => setOfflineSaved(false));
  }, [song]);

  useEffect(() => {
    if (song?._id) trackTasteEvent("song_view", { songId: song._id }, { cooldownMs: 60000 });
  }, [song?._id]);

  useEffect(() => {
    if (!song?._id || !token) { setLiked(false); return; }
    apiClient.get(`/api/likes/check/${song._id}`, { headers: authHeaders(token) })
      .then(({data}) => { if (data?.success) setLiked(Boolean(data.liked)); })
      .catch(() => {});
  }, [song?._id, token]);

  const loadComments = useCallback(async ({ page = 1, append = false, quiet = false } = {}) => {
    if (!songId) return;
    if (!quiet) setCommentsLoading(true);
    try {
      const { data } = await apiClient.get(`/api/comments/song/${songId}`, { params: { page, limit: 12, sort: commentSort }, headers: authHeaders(token) });
      if (data?.success) {
        const incoming = data.comments || [];
        setComments((current) => {
          if (append) {
            const known = new Set(current.map((item) => String(item?._id)));
            const merged = [...current, ...incoming.filter((item) => !known.has(String(item?._id)))];
            return commentListSignature(merged) === commentListSignature(current) ? current : merged;
          }

          if (quiet && current.length > 12) {
            const incomingIds = new Set(incoming.map((item) => String(item?._id)));
            const loadedTail = current.slice(12).filter((item) => !incomingIds.has(String(item?._id)));
            const merged = [...incoming, ...loadedTail];
            return commentListSignature(merged) === commentListSignature(current) ? current : merged;
          }

          return commentListSignature(incoming) === commentListSignature(current) ? current : incoming;
        });
        if (!quiet || append) setCommentPage(page);
        setCommentTotal(Number(data.total || 0));
        setCommentsMore(Boolean(data.hasMore));
      }
    } catch { if (!append && !quiet) setComments([]); }
    finally { if (!quiet) setCommentsLoading(false); }
  }, [songId, token, commentSort]);
  useEffect(() => {
    setComments([]);
    setCommentPage(1);
    setCommentTotal(0);
    setCommentsMore(false);
    setRepliesByComment({});
    setReplyOpen("");
    loadComments({ page: 1 });
  }, [loadComments]);

  const loadMoments = useCallback(async ({ quiet = false } = {}) => {
    if (!songId) return;
    if (!quiet) setMomentsLoading(true);
    try {
      const { data } = await apiClient.get(`/api/social/moments/song/${songId}`, { headers: authHeaders(token) });
      if (data?.success) {
        const incoming = data.moments || [];
        setMoments((current) => momentListSignature(incoming) === momentListSignature(current) ? current : incoming);
      }
    } catch { if (!quiet) setMoments([]); }
    finally { if (!quiet) setMomentsLoading(false); }
  }, [songId, token]);

  useEffect(() => { loadMoments(); }, [loadMoments]);

  const loadTrail = useCallback(async ({ quiet = false } = {}) => {
    if (!token || !songId) {
      setTrail([]);
      return;
    }
    try {
      const { data } = await apiClient.get(`/api/social/trail/${songId}`, { headers: authHeaders(token) });
      if (data?.success) {
        const incoming = data.trail || [];
        setTrail((current) => trailSignature(incoming) === trailSignature(current) ? current : incoming);
      }
    } catch {
      if (!quiet) setTrail([]);
    }
  }, [songId, token]);

  useEffect(() => { loadTrail(); }, [loadTrail]);

  useEffect(() => {
    if (!realtimeSocket || !token || !songId) return undefined;
    let timer = null;
    const refreshTrail = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (document.visibilityState === "visible") loadTrail({ quiet: true });
      }, 140);
    };
    ["social:refresh", "daily:update", "share:update", "circle:update"].forEach((event) => realtimeSocket.on(event, refreshTrail));
    return () => {
      if (timer) window.clearTimeout(timer);
      ["social:refresh", "daily:update", "share:update", "circle:update"].forEach((event) => realtimeSocket.off(event, refreshTrail));
    };
  }, [realtimeSocket, token, songId, loadTrail]);

  useEffect(() => {
    if (!realtimeSocket || !songId) return undefined;

    const onMoment = (event) => {
      if (String(event?.songId || "") !== String(songId)) return;
      if (event?.reason === "created" && event?.moment?._id) {
        setMoments((current) => [...current.filter((item) => String(item?._id) !== String(event.moment._id)), event.moment]
          .sort((a, b) => Number(a.momentAt || 0) - Number(b.momentAt || 0)));
        return;
      }
      if (event?.reason === "liked" && event?.momentId) {
        setMoments((current) => current.map((item) => String(item?._id) === String(event.momentId)
          ? { ...item, likes: Number(event.likes || 0) } : item));
        return;
      }
      if (event?.reason === "reply_created" && event?.momentId && event?.reply?._id) {
        setMoments((current) => current.map((item) => {
          if (String(item?._id) !== String(event.momentId)) return item;
          const replies = [...(item.replies || []).filter((reply) => String(reply?._id) !== String(event.reply._id)), event.reply];
          return { ...item, replies };
        }));
        return;
      }
      if (event?.reason === "reply_liked" && event?.momentId && event?.replyId) {
        setMoments((current) => current.map((item) => String(item?._id) === String(event.momentId)
          ? { ...item, replies: (item.replies || []).map((reply) => String(reply?._id) === String(event.replyId) ? { ...reply, likes: Number(event.likes || 0) } : reply) }
          : item));
        return;
      }
      loadMoments({ quiet: true });
    };

    const onComment = (event) => {
      if (String(event?.songId || "") !== String(songId)) return;
      const commentId = String(event?.commentId || "");
      const rootId = String(event?.rootCommentId || event?.comment?.rootComment || event?.comment?.parentComment || commentId || "");

      if (event?.reason === "comment_created" && event?.comment?._id) {
        const known = commentsRef.current.some((item) => String(item?._id) === String(event.comment._id));
        const next = [event.comment, ...commentsRef.current.filter((item) => String(item?._id) !== String(event.comment._id))];
        commentsRef.current = next;
        setComments(next);
        if (!known) setCommentTotal((current) => current + 1);
        return;
      }
      if (event?.reason === "reply_created" && event?.comment?._id && rootId) {
        const currentReplies = repliesRef.current[rootId] || [];
        const known = currentReplies.some((item) => String(item?._id) === String(event.comment._id));
        if (repliesRef.current[rootId]) {
          const nextReplies = [...currentReplies.filter((item) => String(item?._id) !== String(event.comment._id)), event.comment];
          repliesRef.current = { ...repliesRef.current, [rootId]: nextReplies };
          setRepliesByComment(repliesRef.current);
        }
        if (!known) setComments((current) => current.map((item) => String(item?._id) === rootId ? { ...item, repliesCount: Number(item.repliesCount || 0) + 1 } : item));
        return;
      }
      if (event?.reason === "comment_liked" && commentId) {
        if (event.parentComment || (rootId && rootId !== commentId)) {
          setRepliesByComment((current) => ({
            ...current,
            [rootId]: (current[rootId] || []).map((item) => String(item?._id) === commentId ? { ...item, likes: Number(event.likes || 0) } : item),
          }));
        } else {
          setComments((current) => current.map((item) => String(item?._id) === commentId ? { ...item, likes: Number(event.likes || 0) } : item));
        }
        return;
      }
      if (event?.reason === "comment_updated" && event?.comment?._id) {
        if (event.comment.parentComment) {
          setRepliesByComment((current) => ({
            ...current,
            [rootId]: (current[rootId] || []).map((item) => String(item?._id) === commentId ? { ...item, ...event.comment } : item),
          }));
        } else {
          setComments((current) => current.map((item) => String(item?._id) === commentId ? { ...item, ...event.comment } : item));
        }
        return;
      }
      if (event?.reason === "comment_deleted" && commentId) {
        if (event.parentComment || (rootId && rootId !== commentId)) {
          setRepliesByComment((current) => ({
            ...current,
            [rootId]: (current[rootId] || []).filter((item) => String(item?._id) !== commentId && String(item?.parentComment || "") !== commentId),
          }));
          setComments((current) => current.map((item) => String(item?._id) === rootId ? { ...item, repliesCount: Math.max(0, Number(item.repliesCount || 0) - 1) } : item));
        } else {
          setComments((current) => current.filter((item) => String(item?._id) !== commentId));
          setCommentTotal((current) => Math.max(0, current - 1));
          setRepliesByComment((current) => { const next = { ...current }; delete next[commentId]; return next; });
        }
        return;
      }
      loadComments({ page: 1, quiet: true });
    };

    realtimeSocket.on("song:moment:update", onMoment);
    realtimeSocket.on("song:comment:update", onComment);
    return () => {
      realtimeSocket.off("song:moment:update", onMoment);
      realtimeSocket.off("song:comment:update", onComment);
    };
  }, [realtimeSocket, songId, loadMoments, loadComments]);

  useEffect(() => {
    if (!songId || realtimeConnected || realtimeMode !== "polling") return undefined;

    const refreshSocialSongData = () => {
      if (document.visibilityState !== "visible") return;
      loadMoments({ quiet: true });
      loadComments({ page: 1, quiet: true });
      loadTrail({ quiet: true });
    };

    // Realtime remains immediate. Polling is only a quiet reconciliation path
    // for deployments where SSE is unavailable, so it must never make the
    // empty comments/moments sections visibly reload every few seconds.
    const interval = window.setInterval(refreshSocialSongData, 30000);
    window.addEventListener("focus", refreshSocialSongData);
    document.addEventListener("visibilitychange", refreshSocialSongData);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshSocialSongData);
      document.removeEventListener("visibilitychange", refreshSocialSongData);
    };
  }, [songId, realtimeConnected, realtimeMode, loadMoments, loadComments, loadTrail]);

  useEffect(() => {
    if (!lyricsExpanded || activeLyricIndex < 0) return;

    const container = lyricsScrollRef.current;
    const activeLine = lineRefs.current[activeLyricIndex];
    if (!container || !activeLine) return;

    // Never use scrollIntoView here: browsers are allowed to scroll every
    // ancestor, including the document. Lyrics must move inside their own
    // viewport without pulling the whole Song Details page up or down.
    const containerRect = container.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const visibleHeight = Math.max(
      0,
      Math.min(containerRect.bottom, viewportHeight) - Math.max(containerRect.top, 0)
    );

    // Only follow lyrics when the listener is actually looking at the lyrics
    // section. Playback can continue elsewhere on the page without hijacking
    // the page scroll position.
    if (visibleHeight < Math.min(120, containerRect.height * 0.18)) return;

    const lineRect = activeLine.getBoundingClientRect();
    const targetTop =
      container.scrollTop +
      (lineRect.top - containerRect.top) -
      (container.clientHeight - lineRect.height) / 2;

    const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
    const nextTop = Math.max(0, Math.min(maxTop, targetTop));
    const behavior = getBatterySaver() ? "auto" : "smooth";

    container.scrollTo({ top: nextTop, behavior });
  }, [activeLyricIndex, lyricsExpanded]);

  const handlePlay = () => {
    if (!song) return;
    if (isCurrent) player?.togglePlay?.(); else player?.playSong?.(song, queue.length ? queue : [song]);
  };

  const handleDetailSeek = (event) => {
    if (!isCurrent) return;
    player?.seekTo?.(Number(event.target.value));
  };

  const skipDetailBackward = () => {
    if (!isCurrent) return;
    player?.skipBackward?.(30);
  };

  const skipDetailForward = () => {
    if (!isCurrent) return;
    player?.skipForward?.(30);
  };

  const goBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) navigate(-1);
    else navigate("/");
  }, [navigate]);

  const handleMobileTouchStart = (event) => {
    const touch = event.touches?.[0];
    if (!touch || touch.clientY > 135) return;
    mobileSwipeRef.current = { active: true, x: touch.clientX, y: touch.clientY };
  };

  const handleMobileTouchEnd = (event) => {
    const start = mobileSwipeRef.current;
    mobileSwipeRef.current = { active: false, x: 0, y: 0 };
    if (!start.active) return;
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (dy > 78 && Math.abs(dy) > Math.abs(dx) * 1.2) goBack();
  };

  const goToPreviousTrack = async () => {
    if (!isCurrent) { handlePlay(); return; }
    const previous = await player?.prevSong?.();
    if (previous?._id && String(previous._id) !== String(songId)) {
      navigate(`/song/${previous._id}`, { state: { song: previous, playlist: player?.playlist || queue }, replace: true });
    }
  };

  const goToNextTrack = async () => {
    if (!isCurrent) { handlePlay(); return; }
    const next = await player?.nextSong?.();
    if (next?._id) {
      navigate(`/song/${next._id}`, { state: { song: next, playlist: player?.playlist || queue }, replace: true });
    }
  };

  const addCurrentToQueue = () => {
    if (!song?._id) return;
    const added = player?.addToQueue?.(song);
    setStatus(added ? "Added to Up Next." : "Already in Up Next.");
  };

  const addRecommendationToQueue = (event, item) => {
    event.stopPropagation();
    const added = player?.addToQueue?.(item);
    setStatus(added ? `${item.title} added to Up Next.` : `${item.title} is already in Up Next.`);
  };

  const openLyrics = () => {
    if (!lyrics.length) return;
    setLyricsExpanded(true);
    window.requestAnimationFrame(() => {
      lyricsRef.current?.scrollIntoView?.({ behavior: getBatterySaver() ? "auto" : "smooth", block: "start" });
    });
  };

  const toggleLike = async () => {
    if (!token) { navigate("/account"); return; }
    if (!song?._id || likeBusy) return;
    setLikeBusy(true);
    try {
      const { data } = await apiClient.post(`/api/likes/toggle/${song._id}`, {}, { headers: authHeaders(token) });
      if (data?.success) { setLiked(Boolean(data.liked)); setLikes(Number(data.likes ?? likes)); }
    } catch { setStatus("Could not update Favorite."); }
    finally { setLikeBusy(false); }
  };

  const toggleOffline = async () => {
    if (!song?._id || offlineBusy) return;
    setOfflineBusy(true); setStatus("");
    try {
      if (offlineSaved) { await removeOfflineSong(song); setOfflineSaved(false); setStatus("Removed offline copy."); }
      else { await saveSongForOffline(song); setOfflineSaved(true); setStatus("Saved for offline listening."); }
    } catch (err) { setStatus(err.message || "Offline save failed."); }
    finally { setOfflineBusy(false); }
  };

  const shareSong = async () => {
    if (!song) return;
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: `${song.title} — ${getArtistName(song)}`, url });
      else { await navigator.clipboard.writeText(url); setStatus("Link copied."); }
    } catch { /* sharing cancelled */ }
  };

  const addToPlaylist = async (playlistId) => {
    if (!token) { navigate("/account"); return; }
    try {
      const { data } = await apiClient.post("/api/playlist/add-song", { playlistId, songId: song._id }, { headers: authHeaders(token) });
      setStatus(data?.message || (data?.success ? "Added to playlist." : "Could not add song."));
      if (data?.success) fetchPlaylists?.();
      setPlaylistOpen(false);
    } catch (err) { setStatus(err?.response?.data?.message || "Could not add song."); }
  };

  const submitComment = async (event) => {
    event.preventDefault();
    if (!token) { navigate("/account"); return; }
    const body = commentBody.trim(); if (!body || commentBusy) return;
    setCommentBusy(true);
    try {
      const { data } = await apiClient.post(`/api/comments/song/${songId}`, { body, momentAt: commentAtTime && isCurrent ? progress : null }, { headers: authHeaders(token) });
      if (data?.success && data.comment) {
        const known = commentsRef.current.some((item) => String(item?._id) === String(data.comment._id));
        commentsRef.current = [data.comment, ...commentsRef.current.filter((item) => String(item?._id) !== String(data.comment._id))];
        setComments(commentsRef.current);
        if (!known) setCommentTotal((n)=>n+1);
        setCommentBody(""); setCommentAtTime(false); window.dispatchEvent(new CustomEvent("notification-updated"));
      }
    } catch (err) { setStatus(err?.response?.data?.message || "Could not post comment."); }
    finally { setCommentBusy(false); }
  };

  const startEdit = (comment) => { setEditingId(comment._id); setEditBody(comment.body); };
  const saveEdit = async (commentId) => {
    const body=editBody.trim(); if(!body)return;
    try { const {data}=await apiClient.patch(`/api/comments/${commentId}`,{body},{headers:authHeaders(token)}); if(data?.success)setComments(c=>c.map(item=>item._id===commentId?data.comment:item)); setEditingId(""); } catch { setStatus("Could not edit comment."); }
  };
  const deleteComment = async (commentId) => {
    try { const {data}=await apiClient.delete(`/api/comments/${commentId}`,{headers:authHeaders(token)}); if(data?.success){setComments(c=>c.filter(item=>item._id!==commentId));setCommentTotal(n=>Math.max(0,n-1));} } catch { setStatus("Could not delete comment."); }
  };
  const likeComment = async (commentId) => {
    if(!token){navigate("/account");return;}
    try { const {data}=await apiClient.post(`/api/comments/${commentId}/like`,{}, {headers:authHeaders(token)}); if(data?.success){setComments(c=>c.map(item=>item._id===commentId?{...item,liked:data.liked,likes:data.likes}:item));window.dispatchEvent(new CustomEvent("notification-updated"));} } catch { setStatus("Could not update comment."); }
  };

  const likeReply = async (parentId, replyId) => {
    if (!token) { navigate("/account"); return; }
    try {
      const { data } = await apiClient.post(`/api/comments/${replyId}/like`, {}, { headers: authHeaders(token) });
      if (data?.success) setRepliesByComment((current) => ({ ...current, [parentId]: (current[parentId] || []).map((item) => item._id === replyId ? { ...item, liked: data.liked, likes: data.likes } : item) }));
    } catch { setStatus("Could not update reply."); }
  };

  const loadReplies = async (commentId) => {
    setReplyTarget({ rootId: commentId, parentId: commentId, username: "" });
    if (repliesByComment[commentId]) { setReplyOpen((value) => value === commentId ? "" : commentId); return; }
    try {
      const { data } = await apiClient.get(`/api/comments/${commentId}/replies`, { headers: authHeaders(token) });
      if (data?.success) { setRepliesByComment((current) => ({ ...current, [commentId]: data.replies || [] })); setReplyOpen(commentId); }
    } catch { setStatus("Could not load replies."); }
  };

  const submitReply = async (commentId) => {
    if (!token) { navigate("/account"); return; }
    const body = replyBody.trim(); if (!body || replyBusy) return;
    const rootId = String(replyTarget?.rootId || commentId);
    const parentId = String(replyTarget?.parentId || commentId);
    setReplyBusy(rootId);
    try {
      const { data } = await apiClient.post(`/api/comments/song/${songId}`, { body, parentComment: parentId }, { headers: authHeaders(token) });
      if (data?.success && data.comment) {
        const currentReplies = repliesRef.current[rootId] || [];
        const known = currentReplies.some((item) => String(item?._id) === String(data.comment._id));
        repliesRef.current = { ...repliesRef.current, [rootId]: [...currentReplies.filter((item) => String(item?._id) !== String(data.comment._id)), data.comment] };
        setRepliesByComment(repliesRef.current);
        if (!known) setComments((current) => current.map((item) => String(item._id) === rootId ? { ...item, repliesCount: Number(item.repliesCount || 0) + 1 } : item));
        setReplyBody("");
        setReplyTarget({ rootId, parentId: rootId, username: "" });
        window.dispatchEvent(new CustomEvent("notification-updated"));
      }
    } catch (err) { setStatus(err?.response?.data?.message || "Could not reply."); }
    finally { setReplyBusy(""); }
  };

  const postMoment = async (event) => {
    event.preventDefault();
    if (!token) { navigate("/account"); return; }
    if (!song?._id) return;
    try {
      const { data } = await apiClient.post(`/api/social/moments/song/${songId}`, { momentAt: isCurrent ? progress : 0, body: momentBody.trim(), emoji: momentEmoji }, { headers: authHeaders(token) });
      if (data?.success) { setMomentBody(""); setMoments((current) => [...current, data.moment].sort((a,b)=>Number(a.momentAt||0)-Number(b.momentAt||0))); }
    } catch (err) { setStatus(err?.response?.data?.message || "Could not post this song moment."); }
  };

  const likeMoment = async (momentId) => {
    if (!token) { navigate("/account"); return; }
    try { const {data}=await apiClient.post(`/api/social/moments/${momentId}/like`,{}, {headers:authHeaders(token)}); if(data?.success){setMoments((current)=>current.map((item)=>item._id===momentId?{...item,liked:data.liked,likes:data.likes}:item));window.dispatchEvent(new CustomEvent("notification-updated"));} } catch { setStatus("Could not react to that moment."); }
  };

  const replyMoment = async (momentId) => {
    if (!token) { navigate("/account"); return; }
    const body = momentReplyBody.trim(); if (!body) return;
    try {
      const { data } = await apiClient.post(`/api/social/moments/${momentId}/replies`, { body, parentReplyId: momentReplyTarget || null }, { headers: authHeaders(token) });
      if (data?.success && data.reply) {
        setMoments((current) => current.map((item) => String(item?._id) === String(momentId)
          ? { ...item, replies: [...(item.replies || []).filter((reply) => String(reply?._id) !== String(data.reply._id)), data.reply] }
          : item));
        setMomentReplyBody("");
        setMomentReplyTarget("");
        window.dispatchEvent(new CustomEvent("notification-updated"));
      }
    } catch { setStatus("Could not reply to that moment."); }
  };

  const likeMomentReply = async (momentId, replyId) => {
    if (!token) { navigate("/account"); return; }
    try {
      const { data } = await apiClient.post(`/api/social/moments/${momentId}/replies/${replyId}/like`, {}, { headers: authHeaders(token) });
      if (data?.success) {
        setMoments((current) => current.map((item) => String(item?._id) === String(momentId)
          ? { ...item, replies: (item.replies || []).map((reply) => String(reply?._id) === String(replyId) ? { ...reply, liked: data.liked, likes: data.likes } : reply) }
          : item));
        window.dispatchEvent(new CustomEvent("notification-updated"));
      }
    } catch { setStatus("Could not react to that reply."); }
  };

  const playNextRecommendation = (event, item) => {
    event.stopPropagation();
    const added = player?.addNextToQueue?.(item);
    setStatus(added ? `${item.title} will play next.` : `${item.title} is already queued.`);
  };

  if (loading && !song) return <div className="song-premium-page"><CatalogSkeleton count={8} /></div>;
  if (error && !song) return <div className="song-premium-page"><EmptyState title="Song unavailable" message={error} onRetry={fetchSong} /></div>;
  if (!song) return null;

  const artistId = song.artist?._id;
  const albumId = song.album?._id;

  return (
    <div className="song-premium-page" onTouchStart={handleMobileTouchStart} onTouchEnd={handleMobileTouchEnd}>
      <div className="song-mobile-topbar d-md-none">
        <button type="button" className="song-mobile-top-action" onClick={goBack} aria-label="Close now playing">
          <ChevronDown size={25} />
        </button>
        <span>Now Playing</span>
        <button type="button" className="song-mobile-top-action" onClick={shareSong} aria-label="Share song">
          <Share2 size={21} />
        </button>
      </div>

      <button type="button" className="song-page-back d-none d-md-inline-flex" onClick={goBack}><ChevronLeft size={17}/> Back</button>

      <section className="song-premium-hero">
        <div className="song-premium-art-column">
          <div className="song-now-playing-stage">
            <img className="song-premium-art" src={getSongCover(song)} alt={`${song.title} artwork`} />

            <div className="song-premium-meta-block">
              <div className="song-v2320-kicker-row">
                <span className="song-premium-kicker">{liveRoomSync.isLiveSong ? "Now Playing · Live room" : "Now Playing"}</span>
                {liveRoomSync.isLiveSong ? (
                  <button
                    type="button"
                    className="song-v2320-live-badge"
                    onClick={() => navigate(`/social/rooms/${liveRoomSync.roomCode}`)}
                    title={`Return to live room ${liveRoomSync.roomCode}`}
                    aria-label={`Live in room ${liveRoomSync.roomCode}. Return to room.`}
                  >
                    <i className="song-v2320-live-dot" aria-hidden="true" />
                    <span>LIVE</span>
                    <small>{liveRoomSync.roomCode}</small>
                  </button>
                ) : null}
              </div>
              <h1>{song.title}</h1>
              <button className="song-premium-link" type="button" disabled={!artistId} onClick={()=>artistId&&navigate(`/artist/${artistId}`)}>{getArtistName(song)}</button>
              <button className="song-premium-link muted" type="button" disabled={!albumId} onClick={()=>albumId&&navigate(`/album/${albumId}`)}>{song.album?.title || "Single"}</button>
              {liveRoomSync.isLiveSong ? (
                <div className={`song-v2320-live-state ${liveRoomSync.listenerPaused ? "is-local-paused" : ""}`}>
                  <span>{liveRoomStatus}</span>
                  <small>{liveRoomSync.isHost ? "Host controls" : "Live sync"}</small>
                </div>
              ) : null}
              {lyrics.length ? (
                <button type="button" className="song-mobile-lyrics-link d-md-none" onClick={openLyrics}>
                  <span>Lyrics</span><strong>View lyrics</strong><ChevronRight size={16}/>
                </button>
              ) : null}
            </div>

            <div className="song-premium-actions">
              <button className="song-main-play d-none d-md-inline-flex" type="button" onClick={handlePlay}>{isPlaying?<Pause size={18} fill="currentColor"/>:<Play size={18} fill="currentColor"/>}<span>{isPlaying?"Pause":"Play"}</span></button>
              <button className={`song-round-action ${liked?"active":""}`} type="button" onClick={toggleLike} disabled={likeBusy} aria-label="Favorite"><Heart size={18} fill={liked?"currentColor":"none"}/></button>
              <button className="song-round-action" type="button" onClick={addCurrentToQueue} aria-label="Add to queue" title="Add to Up Next"><ListMusic size={18}/></button>
              <button className="song-round-action" type="button" onClick={()=>{if(!token)navigate("/account");else{fetchPlaylists?.();setPlaylistOpen(true);}}} aria-label="Add to playlist"><ListPlus size={18}/></button>
              <button className={`song-round-action ${offlineSaved?"active":""}`} type="button" onClick={toggleOffline} disabled={offlineBusy} aria-label="Save offline">{offlineSaved?<Check size={18}/>:<Download size={18}/>}</button>
              <button className="song-round-action song-action-share d-none d-md-grid" type="button" onClick={shareSong} aria-label="Share"><Share2 size={18}/></button>
            </div>

            <div className="song-detail-transport" aria-label="Song position controls">
              <div className="song-detail-seek-row">
                <time>{formatDuration(detailProgress)}</time>
                <input
                  type="range"
                  min="0"
                  max={detailDuration || 0}
                  step="0.01"
                  value={detailProgress}
                  onChange={handleDetailSeek}
                  disabled={!isCurrent || !detailDuration || liveListenerSeekLocked}
                  aria-label={liveListenerSeekLocked ? "Live room position is controlled by the host" : "Precise song position"}
                  style={{ "--song-progress": `${detailDuration ? (detailProgress / detailDuration) * 100 : 0}%` }}
                />
                <time>{formatDuration(detailDuration)}</time>
              </div>
              <div className="song-detail-transport-controls">
                <button type="button" className="song-detail-track-control" onClick={goToPreviousTrack} disabled={liveListenerSeekLocked} aria-label={liveListenerSeekLocked ? "Live room song changes are controlled by the host" : "Previous song"} title={liveListenerSeekLocked ? "Host controls the live song" : "Previous song"}><SkipBack size={19} fill="currentColor" /></button>
                <button type="button" className="song-detail-skip-control" onClick={skipDetailBackward} disabled={!isCurrent || liveListenerSeekLocked} aria-label={liveListenerSeekLocked ? "Live room seeking is controlled by the host" : "Go back 30 seconds"} title="Back 30 seconds"><Rewind size={17}/><span>30</span></button>
                <button type="button" className="song-detail-mini-play" onClick={handlePlay} aria-label={isPlaying ? "Pause" : "Play"}>{isPlaying ? <Pause size={23} fill="currentColor" /> : <Play size={23} fill="currentColor" />}</button>
                <button type="button" className="song-detail-skip-control" onClick={skipDetailForward} disabled={!isCurrent || liveListenerSeekLocked} aria-label={liveListenerSeekLocked ? "Live room seeking is controlled by the host" : "Go forward 30 seconds"} title="Forward 30 seconds"><FastForward size={17}/><span>30</span></button>
                <button type="button" className="song-detail-track-control" onClick={goToNextTrack} disabled={liveListenerSeekLocked} aria-label={liveListenerSeekLocked ? "Live room song changes are controlled by the host" : "Next song"} title={liveListenerSeekLocked ? "Host controls the live song" : "Next song"}><SkipForward size={19} fill="currentColor" /></button>
              </div>
              {!isCurrent ? <small className="song-detail-seek-hint">Tap play to start this song.</small> : liveListenerSeekLocked ? <small className="song-detail-seek-hint song-v2320-live-hint">The live timeline keeps moving even when you pause this device. Press Play to jump back to the room's current position.</small> : null}
            </div>

            {status?<p className="song-status" role="status">{status}</p>:null}
          </div>

          <dl className="song-facts">
            <div><dt>Album</dt><dd>{song.album?.title||"Single"}</dd></div>
            <div><dt>Genre</dt><dd>{song.genre||"Unknown"}</dd></div>
            <div><dt>Released</dt><dd>{song.releaseYear || (song.releaseDate ? new Date(song.releaseDate).getFullYear() : "—")}</dd></div>
            <div><dt>Duration</dt><dd>{formatDuration(song.duration || player?.duration)}</dd></div>
            <div><dt>Plays</dt><dd>{formatCompactNumber(song.plays)}</dd></div>
            <div><dt>Likes</dt><dd>{formatCompactNumber(likes)}</dd></div>
          </dl>

          <div className="song-mobile-relations d-md-none">
            {albumId ? (
              <button type="button" className="song-relation-card" onClick={() => navigate(`/album/${albumId}`)}>
                <img src={song.album?.image || song.album?.coverImage || song.album?.imageUrl || getSongCover(song)} alt="" loading="lazy" decoding="async"/>
                <span><small>Album</small><strong>{song.album?.title || "Album"}</strong><em>{getArtistName(song)}</em></span>
                <ChevronRight size={20}/>
              </button>
            ) : null}
            {artistId ? (
              <button type="button" className="song-relation-card" onClick={() => navigate(`/artist/${artistId}`)}>
                <img className="artist" src={song.artist?.image || song.artist?.avatar || getSongCover(song)} alt="" loading="lazy" decoding="async"/>
                <span><small>Artist</small><strong>{getArtistName(song)}</strong><em>View artist</em></span>
                <ChevronRight size={20}/>
              </button>
            ) : null}
          </div>
        </div>

        <div className={`song-lyrics-column ${lyricsExpanded ? "lyrics-expanded" : "lyrics-collapsed"}`} ref={lyricsRef}>
          <div className="song-lyrics-heading">
            <div><span className="song-premium-kicker">Lyrics</span><h2>{synced ? "Live lyrics" : "Lyrics"}</h2></div>
            <div className="song-lyrics-heading-actions">
              <span>{isCurrent ? formatDuration(progress) : ""}</span>
              {lyrics.length ? (
                <button type="button" className="song-lyrics-collapse d-md-none" onClick={() => setLyricsExpanded((expanded) => !expanded)} aria-expanded={lyricsExpanded} aria-label={lyricsExpanded ? "Collapse lyrics" : "Expand lyrics"} title={lyricsExpanded ? "Collapse lyrics" : "Expand lyrics"}>
                  {lyricsExpanded ? <ChevronUp size={19} /> : <ChevronDown size={19} />}
                </button>
              ) : null}
            </div>
          </div>

          {lyrics.length ? (
            lyricsExpanded ? (
              <div ref={lyricsScrollRef} className={`song-lyrics-scroll ${synced ? "synced" : "static"}`}>
                {lyrics.map((line,index)=><button ref={(el)=>{lineRefs.current[index]=el;}} key={`${line.text}-${index}`} type="button" className={`song-lyric-line ${index===activeLyricIndex?"active":index<activeLyricIndex?"past":""}`} disabled={!Number.isFinite(line.start)} onClick={()=>Number.isFinite(line.start)&&player?.seekTo?.(line.start)}>{line.text}</button>)}
              </div>
            ) : (
              <button type="button" className="song-lyrics-preview" onClick={() => setLyricsExpanded(true)} aria-label="Expand lyrics">
                <strong>{compactLyric}</strong>
                {compactNextLyric ? <span>{compactNextLyric}</span> : null}
                <small>Tap to expand lyrics</small>
              </button>
            )
          ) : <EmptyState title="Lyrics aren’t available yet" message="This track can still be played normally." />}
        </div>
      </section>

      <section className="song-moments-section" aria-label="Song moments">
        <div className="song-section-title">
          <div><span className="song-premium-kicker">At this moment</span><h2>Song moments</h2></div>
          <span>{moments.length}</span>
        </div>
        <p className="song-muted-copy">Reactions are attached to an exact point in the track. Tap a timestamp to jump there.</p>
        <form className="song-moment-form" onSubmit={postMoment}>
          <select value={momentEmoji} onChange={(event) => setMomentEmoji(event.target.value)} aria-label="Reaction"><option>🔥</option><option>❤️</option><option>😭</option><option>✨</option><option>🎧</option><option>🤯</option></select>
          <input value={momentBody} onChange={(event) => setMomentBody(event.target.value.slice(0,320))} placeholder={token ? `React at ${formatDuration(isCurrent ? progress : 0)}…` : "Sign in to leave a song moment"} disabled={!token}/>
          <button type="submit" className="sw-primary-btn" disabled={!token}>{token ? "Post moment" : "Sign in"}</button>
        </form>
        {momentsLoading && !moments.length ? <CatalogSkeleton count={3} rows/> : moments.length ? <div className="song-moment-list">
          {moments.slice(0,24).map((moment) => <article className="song-moment" key={moment._id}>
            <button type="button" className="song-moment-time" onClick={() => { if (!isCurrent) handlePlay(); window.setTimeout(() => player?.seekTo?.(Number(moment.momentAt || 0)), 80); }}><Clock3 size={13}/>{formatDuration(moment.momentAt)}</button>
            <span className="song-moment-emoji">{moment.emoji || "🎵"}</span>
            <div className="song-moment-copy"><strong>{moment.user?.username || moment.user?.name || "Listener"}</strong>{moment.body ? <p>{moment.body}</p> : null}
              <div className="song-moment-actions"><button type="button" className={moment.liked ? "active" : ""} onClick={() => likeMoment(moment._id)}><Heart size={13} fill={moment.liked ? "currentColor" : "none"}/> {moment.likes || 0}</button><button type="button" onClick={() => { if (!token) navigate("/account"); else setMomentReplyOpen((value) => value === moment._id ? "" : moment._id); setMomentReplyTarget(""); }}><Reply size={13}/> Reply</button></div>
              {(moment.replies || []).length ? <div className="song-moment-replies">{moment.replies.slice(-6).map((reply) => <div className={reply.parentReplyId?"song-moment-reply nested":"song-moment-reply"} key={reply._id}><p><strong>{reply.user?.username || reply.user?.name || "Listener"}</strong> {reply.body}</p><div><button type="button" className={reply.liked?"active":""} onClick={()=>likeMomentReply(moment._id,reply._id)}><Heart size={11} fill={reply.liked?"currentColor":"none"}/> {reply.likes||0}</button><button type="button" onClick={()=>{setMomentReplyOpen(moment._id);setMomentReplyTarget(reply._id);setMomentReplyBody(`@${reply.user?.username||"listener"} `);}}><Reply size={11}/> Reply</button></div></div>)}</div> : null}
              {momentReplyOpen === moment._id ? <div className="song-inline-reply"><input value={momentReplyBody} onChange={(event)=>setMomentReplyBody(event.target.value.slice(0,300))} placeholder={momentReplyTarget?"Reply to this reply…":"Reply to this moment…"}/><button type="button" onClick={()=>replyMoment(moment._id)}>Reply</button></div> : null}
            </div>
          </article>)}
        </div> : <p className="song-muted-copy">No moments yet. Play the song and leave the first reaction.</p>}
      </section>

      <section className="song-below-grid">
        <div className="song-comments-section">
          <div className="song-section-title"><div><span className="song-premium-kicker">Community</span><h2>Comments</h2></div><div className="song-comment-heading-actions"><span>{commentTotal}</span><select value={commentSort} onChange={(event)=>setCommentSort(event.target.value)} aria-label="Sort comments"><option value="recent">Recent</option><option value="top">Top</option></select></div></div>
          <form className="song-comment-form" onSubmit={submitComment}>
            <textarea value={commentBody} onChange={(e)=>setCommentBody(e.target.value.slice(0,600))} placeholder={token?"Add a comment… use @username to mention someone":"Sign in to join the conversation"} disabled={!token||commentBusy}/>
            <div className="song-comment-form-footer"><label className={isCurrent ? "song-time-toggle" : "song-time-toggle disabled"}><input type="checkbox" checked={commentAtTime} onChange={(e)=>setCommentAtTime(e.target.checked)} disabled={!isCurrent||!token}/><Clock3 size={13}/> Attach {isCurrent ? formatDuration(progress) : "playback time"}</label><span className="song-comment-count">{commentBody.length}/600</span><button className="sw-primary-btn" type="submit" disabled={!token||!commentBody.trim()||commentBusy}>{commentBusy?"Posting…":"Comment"}</button></div>
          </form>
          {commentsLoading&&!comments.length?<CatalogSkeleton count={4} rows/>:comments.length?<div className="song-comments-list">{comments.map((comment)=><article id={`comment-${comment._id}`} className="song-comment" key={comment._id}>
            <div className="song-comment-avatar">{comment.user?.image?<img src={comment.user.image} alt=""/>:String(comment.user?.username||"S").slice(0,1).toUpperCase()}</div>
            <div className="song-comment-body"><div className="song-comment-top"><strong>{comment.user?.username||"SoundWave listener"}</strong><span>{new Date(comment.createdAt).toLocaleDateString()}</span>{comment.editedAt?<em>edited</em>:null}</div>
              {Number.isFinite(Number(comment.momentAt)) ? <button type="button" className="song-comment-time" onClick={()=>{if(!isCurrent)handlePlay();window.setTimeout(()=>player?.seekTo?.(Number(comment.momentAt)),80);}}><Clock3 size={12}/>{formatDuration(comment.momentAt)}</button> : null}
              {editingId===comment._id?<div className="song-comment-edit"><textarea value={editBody} onChange={e=>setEditBody(e.target.value.slice(0,600))}/><button type="button" onClick={()=>saveEdit(comment._id)}>Save</button><button type="button" onClick={()=>setEditingId("")}>Cancel</button></div>:<p>{comment.body}</p>}
              <div className="song-comment-actions"><button type="button" className={comment.liked?"active":""} onClick={()=>likeComment(comment._id)}><Heart size={13} fill={comment.liked?"currentColor":"none"}/> {comment.likes||0}</button><button type="button" onClick={()=>loadReplies(comment._id)}><MessageCircle size={13}/> {comment.repliesCount||0} {comment.repliesCount===1?"reply":"replies"}</button><button type="button" onClick={()=>{if(!token)navigate("/account");else{setReplyOpen(comment._id);setReplyTarget({rootId:comment._id,parentId:comment._id,username:comment.user?.username||"listener"});setReplyBody(`@${comment.user?.username || "listener"} `);}}}><Reply size={13}/> Reply</button>{comment.canEdit?<><button type="button" onClick={()=>startEdit(comment)}>Edit</button><button type="button" onClick={()=>deleteComment(comment._id)}><Trash2 size={13}/> Delete</button></>:null}</div>
              {replyOpen===comment._id?<div className="song-replies-wrap">
                {(repliesByComment[comment._id]||[]).map((reply)=><div className={reply.parentComment && String(reply.parentComment)!==String(comment._id)?"song-comment-reply nested":"song-comment-reply"} key={reply._id}><div className="song-comment-avatar small">{reply.user?.image?<img src={reply.user.image} alt=""/>:String(reply.user?.username||"S").slice(0,1).toUpperCase()}</div><div><strong>{reply.user?.username||"Listener"}</strong><p>{reply.body}</p><div className="song-reply-actions"><button type="button" className={reply.liked?"active":""} onClick={()=>likeReply(comment._id,reply._id)}><Heart size={12} fill={reply.liked?"currentColor":"none"}/> {reply.likes||0}</button><button type="button" onClick={()=>{setReplyOpen(comment._id);setReplyTarget({rootId:comment._id,parentId:reply._id,username:reply.user?.username||"listener"});setReplyBody(`@${reply.user?.username||"listener"} `);}}><Reply size={12}/> Reply</button></div></div></div>)}
                <div className="song-inline-reply"><input value={replyBody} onChange={(event)=>setReplyBody(event.target.value.slice(0,600))} placeholder={token?(replyTarget?.parentId&&String(replyTarget.parentId)!==String(comment._id)?`Reply to @${replyTarget.username || "listener"}…`:"Write a reply…"):"Sign in to reply"} disabled={!token}/><button type="button" disabled={!token||!replyBody.trim()||replyBusy===comment._id} onClick={()=>submitReply(comment._id)}>{replyBusy===comment._id?"Posting…":"Reply"}</button></div>
              </div>:null}
            </div>
          </article>)}</div>:<EmptyState title="No comments yet" message="Be the first listener to say something."/>}
          {commentsMore?<button className="sw-secondary-btn song-comments-more" type="button" disabled={commentsLoading} onClick={()=>loadComments({page:commentPage+1,append:true})}>Load more comments</button>:null}
        </div>

        <aside className="song-recommendations">
          <div className="song-section-title"><div><span className="song-premium-kicker">Up next</span><h2>More like this</h2></div></div>
          {recommendations.length?<div className="song-recommendation-list">{recommendations.map((item)=><div className="song-recommendation-row" key={item._id}><button className="song-recommendation-main" type="button" onClick={()=>{player?.playSong?.(item,recommendations);navigate(`/song/${item._id}`,{state:{song:item,playlist:recommendations}});}}><img src={getSongCover(item)} alt="" loading="lazy" decoding="async"/><span><strong>{item.title}</strong><small>{getArtistName(item)}</small></span></button><div className="song-recommendation-actions"><button className="song-recommendation-queue" type="button" onClick={(event)=>playNextRecommendation(event,item)} aria-label={`Play ${item.title} next`} title="Play next"><Sparkles size={15}/><span>Next</span></button><button className="song-recommendation-queue" type="button" onClick={(event)=>addRecommendationToQueue(event,item)} aria-label={`Add ${item.title} to queue`} title="Add later"><ListMusic size={15}/><span>+</span></button></div></div>)}</div>:<p className="song-muted-copy">Recommendations will appear as the catalog learns this track.</p>}

          <div className="song-discovery-trail">
            <div className="song-section-title compact"><div><span className="song-premium-kicker">Friends</span><h2>Discovery trail</h2></div></div>
            {!token?<button className="song-signin-social" type="button" onClick={()=>navigate("/account")}>Sign in to see how friends discovered this song</button>:trail.length?<div className="song-trail-list">{trail.map((item)=><div key={item._id}><span className="song-trail-dot"/><span><strong>{item.actor?.username||item.actor?.name||"A friend"}</strong><small>{item.type==="daily_pick"?"picked this today":item.type==="song_moment"?`reacted at ${formatDuration(item.momentAt)}`:item.type==="circle_song"?`shared it in ${item.circle?.name||"a Circle"}`:"shared this song"}</small></span></div>)}</div>:<p className="song-muted-copy">No friend trail yet. Share it and start one.</p>}
          </div>
        </aside>
      </section>

      {playlistOpen?<div className="song-modal-backdrop" onMouseDown={()=>setPlaylistOpen(false)}><div className="song-playlist-sheet" role="dialog" aria-modal="true" aria-label="Add to playlist" onMouseDown={(e)=>e.stopPropagation()}><div className="song-section-title"><div><span className="song-premium-kicker">Library</span><h2>Add to playlist</h2></div><button className="song-round-action" type="button" onClick={()=>setPlaylistOpen(false)}>×</button></div>{playlists.length?<div className="song-playlist-options">{playlists.map((playlist)=><button type="button" key={playlist._id} onClick={()=>addToPlaylist(playlist._id)}><span><strong>{playlist.name}</strong><small>{playlist.songs?.length||0} songs</small></span><ListPlus size={17}/></button>)}</div>:<EmptyState title="No playlists yet" message="Create a playlist first from the Playlists page."/>}</div></div>:null}
    </div>
  );
};

export default SongDetails;
