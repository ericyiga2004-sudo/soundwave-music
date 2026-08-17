import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Edit3, ListMusic, Play, Save, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { MusicContext } from "../context/ShopContext";
import { MusicPlayerContext } from "../context/MainPlayerContext";
import { apiClient, authHeaders } from "../config/apiClient";
import { getArtistName, getSongCover } from "../utils/catalog";
import CatalogSkeleton from "../components/UI/CatalogSkeleton";
import EmptyState from "../components/UI/EmptyState";
import "./CSS/CatalogPages.css";

const PlaylistDetails = () => {
  const { playlistId } = useParams();
  const navigate = useNavigate();
  const { getAuthToken, fetchPlaylists } = useContext(MusicContext);
  const { playSong } = useContext(MusicPlayerContext);
  const token = getAuthToken?.() || "";

  const [playlist, setPlaylist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      navigate("/account");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data } = await apiClient.get(`/api/playlist/${playlistId}`, {
        headers: authHeaders(token),
      });
      if (!data?.success) throw new Error(data?.message || "Playlist not found");

      setPlaylist(data.playlist);
      setName(data.playlist?.name || "");
      setDescription(data.playlist?.description || "");
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Could not load playlist");
    } finally {
      setLoading(false);
    }
  }, [navigate, playlistId, token]);

  useEffect(() => {
    load();
  }, [load]);

  const songs = useMemo(() => playlist?.songs || [], [playlist?.songs]);
  const covers = useMemo(() => songs.slice(0, 4).map(getSongCover), [songs]);

  const playAll = async () => {
    if (!songs.length) return;
    playSong?.(songs[0], songs);
    apiClient
      .post(`/api/playlist/${playlistId}/play`, {}, { headers: authHeaders(token) })
      .catch(() => {});
  };

  const save = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await apiClient.patch(
        `/api/playlist/${playlistId}`,
        { name, description },
        { headers: authHeaders(token) }
      );
      if (!data?.success) throw new Error(data?.message || "Could not save playlist");
      setPlaylist(data.playlist);
      setEditing(false);
      await fetchPlaylists?.();
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Could not save playlist");
    } finally {
      setBusy(false);
    }
  };

  const removeSong = async (songId) => {
    if (!songId || busy) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await apiClient.post(
        "/api/playlist/remove-song",
        { playlistId, songId },
        { headers: authHeaders(token) }
      );
      if (!data?.success) throw new Error(data?.message || "Could not remove song");
      await load();
      await fetchPlaylists?.();
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Could not remove song");
    } finally {
      setBusy(false);
    }
  };

  const deletePlaylist = async () => {
    if (busy || !playlist) return;
    if (!window.confirm(`Delete "${playlist.name}"? This cannot be undone.`)) return;

    setBusy(true);
    setError("");
    try {
      const { data } = await apiClient.post(
        "/api/playlist/delete",
        { playlistId },
        { headers: authHeaders(token) }
      );
      if (!data?.success) throw new Error(data?.message || "Could not delete playlist");
      await fetchPlaylists?.();
      navigate("/playlist", { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Could not delete playlist");
    } finally {
      setBusy(false);
    }
  };

  if (loading && !playlist) {
    return <div className="sw-catalog-page"><CatalogSkeleton count={7} rows /></div>;
  }

  if (error && !playlist) {
    return <div className="sw-catalog-page"><EmptyState title="Playlist unavailable" message={error} onRetry={load} /></div>;
  }

  return (
    <div className="sw-catalog-page">
      <section className="sw-playlist-detail-hero">
        <div className={`sw-playlist-collage ${covers.length <= 1 ? "one" : ""}`}>
          {covers.length
            ? covers.map((cover, index) => <img key={`${cover}-${index}`} src={cover} alt="" loading="lazy" decoding="async" />)
            : <img src="/fallback-cover.svg" alt="" />}
        </div>

        <div className="sw-playlist-detail-copy">
          <span className="sw-catalog-eyebrow">Playlist</span>
          <h1>{playlist?.name || "Untitled playlist"}</h1>
          <p>{playlist?.description || "A personal SoundWave playlist."}</p>
          <small className="sw-catalog-count">{songs.length} songs · {playlist?.plays || 0} plays</small>

          <div className="sw-playlist-actions">
            <button className="sw-primary-btn" type="button" disabled={!songs.length} onClick={playAll}>
              <Play size={15} fill="currentColor" /> Play
            </button>
            <button className="sw-secondary-btn" type="button" onClick={() => setEditing((value) => !value)}>
              <Edit3 size={14} /> Edit
            </button>
            <button className="sw-secondary-btn" type="button" onClick={() => navigate("/playlist")}>
              <ListMusic size={14} /> Manage & share
            </button>
            <button className="sw-secondary-btn danger" type="button" disabled={busy} onClick={deletePlaylist}>
              <Trash2 size={14} /> Delete
            </button>
          </div>

          {editing ? (
            <div className="sw-playlist-edit">
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="Playlist name" />
              <input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} placeholder="Description" />
              <button className="sw-primary-btn" type="button" disabled={busy || !name.trim()} onClick={save}>
                <Save size={14} /> Save
              </button>
            </div>
          ) : null}

          {error ? <p className="sw-inline-error" role="alert">{error}</p> : null}
        </div>
      </section>

      <section className="sw-playlist-tracks">
        {songs.length ? (
          <div className="sw-song-list">
            {songs.map((song) => (
              <div className="sw-song-list-row" key={song._id}>
                <img src={getSongCover(song)} alt="" loading="lazy" decoding="async" />
                <button type="button" className="sw-song-title" onClick={() => navigate(`/song/${song._id}`, { state: { playlist: songs } })}>
                  <strong>{song.title}</strong>
                  <span>{getArtistName(song)}</span>
                </button>
                <span className="sw-song-album">{song.album?.title || "Single"}</span>
                <span className="sw-song-duration">{song.genre || ""}</span>
                <div className="sw-row-actions">
                  <button className="sw-icon-only" type="button" onClick={() => playSong?.(song, songs)} aria-label={`Play ${song.title}`}>
                    <Play size={16} fill="currentColor" />
                  </button>
                  <button className="sw-icon-only" type="button" disabled={busy} onClick={() => removeSong(song._id)} aria-label={`Remove ${song.title} from playlist`}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="This playlist is empty" message="Open Playlists to add songs." />
        )}
      </section>
    </div>
  );
};

export default PlaylistDetails;
