import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Check,
  ChevronLeft,
  Download,
  Heart,
  ListPlus,
  MoreHorizontal,
  Pause,
  Play,
  Share2,
  Trash2,
} from "lucide-react";
import { MusicContext } from "../context/ShopContext";
import { MusicPlayerContext } from "../context/MainPlayerContext";
import { apiClient, authHeaders, cachedGet } from "../config/apiClient";
import { formatCompactNumber, formatDuration, getArtistName, getSongCover } from "../utils/catalog";
import { getBatterySaver } from "../utils/uiPreferences";
import { isSongOfflineAvailable, removeOfflineSong, saveSongForOffline } from "../utils/offlineDownload";
import { trackTasteEvent } from "../utils/personalization";
import CatalogSkeleton from "../components/UI/CatalogSkeleton";
import EmptyState from "../components/UI/EmptyState";
import "./CSS/SongDetails.css";

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

const SongDetails = () => {
  const { songId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { songs: globalSongs = [], getAuthToken, playlists = [], fetchPlaylists } = useContext(MusicContext);
  const player = useContext(MusicPlayerContext);
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

  const [comments, setComments] = useState([]);
  const [commentPage, setCommentPage] = useState(1);
  const [commentTotal, setCommentTotal] = useState(0);
  const [commentsMore, setCommentsMore] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentBody, setCommentBody] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [editBody, setEditBody] = useState("");

  const lyricsRef = useRef(null);
  const lineRefs = useRef([]);

  const routePlaylist = location.state?.playlist;
  const playlistFromRoute = useMemo(
    () => (Array.isArray(routePlaylist) ? routePlaylist : []),
    [routePlaylist]
  );
  const queue = useMemo(() => playlistFromRoute.length ? playlistFromRoute : (globalSongs.length ? globalSongs : song ? [song] : []), [playlistFromRoute, globalSongs, song]);
  const isCurrent = player?.currentSong?._id === song?._id;
  const isPlaying = isCurrent && player?.isPlaying;
  const progress = isCurrent ? Number(player?.progress || 0) : 0;
  const lyrics = useMemo(() => normalizeLyrics(song), [song]);
  const synced = lyrics.some((line) => Number.isFinite(line.start));
  const activeLyricIndex = useMemo(() => {
    if (!synced || !isCurrent) return -1;
    let active = -1;
    lyrics.forEach((line, index) => { if (Number.isFinite(line.start) && progress >= line.start) active = index; });
    return active;
  }, [lyrics, progress, synced, isCurrent]);

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

  const loadComments = useCallback(async ({ page = 1, append = false } = {}) => {
    if (!songId) return;
    setCommentsLoading(true);
    try {
      const { data } = await apiClient.get(`/api/comments/song/${songId}`, { params: { page, limit: 12 }, headers: authHeaders(token) });
      if (data?.success) {
        setComments((current) => append ? [...current, ...(data.comments || [])] : (data.comments || []));
        setCommentPage(page); setCommentTotal(Number(data.total || 0)); setCommentsMore(Boolean(data.hasMore));
      }
    } catch { if (!append) setComments([]); }
    finally { setCommentsLoading(false); }
  }, [songId, token]);
  useEffect(() => { loadComments({page:1}); }, [loadComments]);

  useEffect(() => {
    if (activeLyricIndex < 0 || !lineRefs.current[activeLyricIndex]) return;
    const behavior = getBatterySaver() ? "auto" : "smooth";
    lineRefs.current[activeLyricIndex]?.scrollIntoView({ behavior, block: "center" });
  }, [activeLyricIndex]);

  const handlePlay = () => {
    if (!song) return;
    if (isCurrent) player?.togglePlay?.(); else player?.playSong?.(song, queue.length ? queue : [song]);
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
      const { data } = await apiClient.post(`/api/comments/song/${songId}`, { body }, { headers: authHeaders(token) });
      if (data?.success && data.comment) { setComments((current) => [data.comment, ...current]); setCommentTotal((n)=>n+1); setCommentBody(""); }
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
    try { const {data}=await apiClient.post(`/api/comments/${commentId}/like`,{}, {headers:authHeaders(token)}); if(data?.success)setComments(c=>c.map(item=>item._id===commentId?{...item,liked:data.liked,likes:data.likes}:item)); } catch { setStatus("Could not update comment."); }
  };

  if (loading && !song) return <div className="song-premium-page"><CatalogSkeleton count={8} /></div>;
  if (error && !song) return <div className="song-premium-page"><EmptyState title="Song unavailable" message={error} onRetry={fetchSong} /></div>;
  if (!song) return null;

  const artistId = song.artist?._id;
  const albumId = song.album?._id;

  return (
    <div className="song-premium-page">
      <button type="button" className="song-page-back" onClick={() => navigate(-1)}><ChevronLeft size={17}/> Back</button>

      <section className="song-premium-hero">
        <div className="song-premium-art-column">
          <img className="song-premium-art" src={getSongCover(song)} alt={`${song.title} artwork`} />
          <div className="song-premium-meta-block">
            <span className="song-premium-kicker">Now Playing</span>
            <h1>{song.title}</h1>
            <button className="song-premium-link" type="button" disabled={!artistId} onClick={()=>artistId&&navigate(`/artist/${artistId}`)}>{getArtistName(song)}</button>
            <button className="song-premium-link muted" type="button" disabled={!albumId} onClick={()=>albumId&&navigate(`/album/${albumId}`)}>{song.album?.title || "Single"}</button>
          </div>
          <div className="song-premium-actions">
            <button className="song-main-play" type="button" onClick={handlePlay}>{isPlaying?<Pause size={18} fill="currentColor"/>:<Play size={18} fill="currentColor"/>}<span>{isPlaying?"Pause":"Play"}</span></button>
            <button className={`song-round-action ${liked?"active":""}`} type="button" onClick={toggleLike} disabled={likeBusy} aria-label="Favorite"><Heart size={17} fill={liked?"currentColor":"none"}/></button>
            <button className="song-round-action" type="button" onClick={()=>{if(!token)navigate("/account");else{fetchPlaylists?.();setPlaylistOpen(true);}}} aria-label="Add to playlist"><ListPlus size={17}/></button>
            <button className={`song-round-action ${offlineSaved?"active":""}`} type="button" onClick={toggleOffline} disabled={offlineBusy} aria-label="Save offline">{offlineSaved?<Check size={17}/>:<Download size={17}/>}</button>
            <button className="song-round-action" type="button" onClick={shareSong} aria-label="Share"><Share2 size={17}/></button>
          </div>
          {status?<p className="song-status" role="status">{status}</p>:null}
          <dl className="song-facts">
            <div><dt>Album</dt><dd>{song.album?.title||"Single"}</dd></div>
            <div><dt>Genre</dt><dd>{song.genre||"Unknown"}</dd></div>
            <div><dt>Released</dt><dd>{song.releaseYear || (song.releaseDate ? new Date(song.releaseDate).getFullYear() : "—")}</dd></div>
            <div><dt>Duration</dt><dd>{formatDuration(song.duration || player?.duration)}</dd></div>
            <div><dt>Plays</dt><dd>{formatCompactNumber(song.plays)}</dd></div>
            <div><dt>Likes</dt><dd>{formatCompactNumber(likes)}</dd></div>
          </dl>
        </div>

        <div className="song-lyrics-column" ref={lyricsRef}>
          <div className="song-lyrics-heading"><div><span className="song-premium-kicker">Lyrics</span><h2>{synced ? "Live lyrics" : "Lyrics"}</h2></div><span>{isCurrent ? formatDuration(progress) : ""}</span></div>
          {lyrics.length ? <div className={`song-lyrics-scroll ${synced?"synced":"static"}`}>{lyrics.map((line,index)=><button ref={(el)=>{lineRefs.current[index]=el;}} key={`${line.text}-${index}`} type="button" className={`song-lyric-line ${index===activeLyricIndex?"active":index<activeLyricIndex?"past":""}`} disabled={!Number.isFinite(line.start)} onClick={()=>Number.isFinite(line.start)&&player?.seekTo?.(line.start)}>{line.text}</button>)}</div> : <EmptyState title="Lyrics aren’t available yet" message="This track can still be played normally." />}
        </div>
      </section>

      <section className="song-below-grid">
        <div className="song-comments-section">
          <div className="song-section-title"><div><span className="song-premium-kicker">Community</span><h2>Comments</h2></div><span>{commentTotal}</span></div>
          <form className="song-comment-form" onSubmit={submitComment}><textarea value={commentBody} onChange={(e)=>setCommentBody(e.target.value.slice(0,600))} placeholder={token?"Add a comment…":"Sign in to join the conversation"} disabled={!token||commentBusy}/><div><small>{commentBody.length}/600</small><button className="sw-primary-btn" type="submit" disabled={!token||!commentBody.trim()||commentBusy}>{commentBusy?"Posting…":"Comment"}</button></div></form>
          {commentsLoading&&!comments.length?<CatalogSkeleton count={4} rows/>:comments.length?<div className="song-comments-list">{comments.map((comment)=><article className="song-comment" key={comment._id}><div className="song-comment-avatar">{String(comment.user?.username||"S").slice(0,1).toUpperCase()}</div><div className="song-comment-body"><div className="song-comment-top"><strong>{comment.user?.username||"SoundWave listener"}</strong><span>{new Date(comment.createdAt).toLocaleDateString()}</span>{comment.editedAt?<em>edited</em>:null}</div>{editingId===comment._id?<div className="song-comment-edit"><textarea value={editBody} onChange={e=>setEditBody(e.target.value.slice(0,600))}/><button type="button" onClick={()=>saveEdit(comment._id)}>Save</button><button type="button" onClick={()=>setEditingId("")}>Cancel</button></div>:<p>{comment.body}</p>}<div className="song-comment-actions"><button type="button" className={comment.liked?"active":""} onClick={()=>likeComment(comment._id)}><Heart size={13} fill={comment.liked?"currentColor":"none"}/> {comment.likes||0}</button>{comment.canEdit?<><button type="button" onClick={()=>startEdit(comment)}>Edit</button><button type="button" onClick={()=>deleteComment(comment._id)}><Trash2 size={13}/> Delete</button></>:null}</div></div></article>)}</div>:<EmptyState title="No comments yet" message="Be the first listener to say something."/>}
          {commentsMore?<button className="sw-secondary-btn song-comments-more" type="button" disabled={commentsLoading} onClick={()=>loadComments({page:commentPage+1,append:true})}>Load more comments</button>:null}
        </div>

        <aside className="song-recommendations">
          <div className="song-section-title"><div><span className="song-premium-kicker">Up next</span><h2>More like this</h2></div></div>
          {recommendations.length?<div className="song-recommendation-list">{recommendations.map((item)=><button key={item._id} type="button" onClick={()=>{player?.playSong?.(item,recommendations);navigate(`/song/${item._id}`,{state:{song:item,playlist:recommendations}});}}><img src={getSongCover(item)} alt="" loading="lazy" decoding="async"/><span><strong>{item.title}</strong><small>{getArtistName(item)}</small></span><MoreHorizontal size={16}/></button>)}</div>:<p className="song-muted-copy">Recommendations will appear as the catalog learns this track.</p>}
        </aside>
      </section>

      {playlistOpen?<div className="song-modal-backdrop" onMouseDown={()=>setPlaylistOpen(false)}><div className="song-playlist-sheet" role="dialog" aria-modal="true" aria-label="Add to playlist" onMouseDown={(e)=>e.stopPropagation()}><div className="song-section-title"><div><span className="song-premium-kicker">Library</span><h2>Add to playlist</h2></div><button className="song-round-action" type="button" onClick={()=>setPlaylistOpen(false)}>×</button></div>{playlists.length?<div className="song-playlist-options">{playlists.map((playlist)=><button type="button" key={playlist._id} onClick={()=>addToPlaylist(playlist._id)}><span><strong>{playlist.name}</strong><small>{playlist.songs?.length||0} songs</small></span><ListPlus size={17}/></button>)}</div>:<EmptyState title="No playlists yet" message="Create a playlist first from the Playlists page."/>}</div></div>:null}
    </div>
  );
};

export default SongDetails;
