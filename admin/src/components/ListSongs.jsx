import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ADMIN_API_BASE_URL } from "../config/api";

const ListSongs = () => {
  const [songs, setSongs] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.get(`${ADMIN_API_BASE_URL}/api/songs`, {
        params: { limit: 60, sort: "newest" },
      });
      if (!data?.success) throw new Error(data?.message || "Could not load songs");
      setSongs(data.songs || []);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Could not load songs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return songs;
    return songs.filter((song) =>
      [song.title, song.artist?.name, song.album?.title, song.genre, song.country]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [query, songs]);

  const remove = async (song) => {
    if (!song?._id || busyId) return;
    if (!window.confirm(`Delete "${song.title}" from SoundWave?`)) return;
    setBusyId(song._id);
    try {
      const { data } = await axios.delete(`${ADMIN_API_BASE_URL}/api/songs/${song._id}`);
      if (!data?.success) throw new Error(data?.message || "Delete failed");
      setSongs((current) => current.filter((item) => item._id !== song._id));
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Could not delete song");
    } finally {
      setBusyId("");
    }
  };

  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <div>
          <span>Catalog</span>
          <h2>Manage songs</h2>
          <p>Recent tracks are loaded in one compact page to keep the admin light.</p>
        </div>
        <button type="button" className="admin-secondary" onClick={load} disabled={loading}>Refresh</button>
      </div>

      <input
        className="admin-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search title, artist, album, genre…"
      />

      {error ? <p className="admin-message error">{error}</p> : null}
      {loading && !songs.length ? <p className="admin-muted">Loading songs…</p> : null}
      {!loading && !filtered.length ? <p className="admin-muted">No matching songs.</p> : null}

      <div className="admin-song-list">
        {filtered.map((song) => (
          <article key={song._id} className="admin-song-row">
            <img src={song.imageUrl || "/favicon.svg"} alt="" loading="lazy" decoding="async" />
            <div>
              <strong>{song.title}</strong>
              <span>{song.artist?.name || "Unknown artist"}</span>
            </div>
            <small>{song.genre || "—"}</small>
            <small>{song.status || "published"}</small>
            <button type="button" className="admin-danger" disabled={busyId === song._id} onClick={() => remove(song)}>
              {busyId === song._id ? "Deleting…" : "Delete"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
};

export default ListSongs;
