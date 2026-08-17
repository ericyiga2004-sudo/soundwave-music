import { useContext, useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Play, Search, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cachedGet } from "../config/apiClient";
import { MusicPlayerContext } from "../context/MainPlayerContext";
import { formatDuration, getArtistName, getSongCover } from "../utils/catalog";
import CatalogSkeleton from "../components/UI/CatalogSkeleton";
import EmptyState from "../components/UI/EmptyState";
import "./CSS/CatalogPages.css";

const PAGE_SIZE = 36;

const SongsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { playSong } = useContext(MusicPlayerContext);

  const initialQuery = searchParams.get("search") || searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState(searchParams.get("sort") || "popular");
  const [songs, setSongs] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const filters = useMemo(
    () => ({
      genre: searchParams.get("genre") || "",
      mood: searchParams.get("mood") || "",
      country: searchParams.get("country") || "",
      year: searchParams.get("year") || "",
      artist: searchParams.get("artist") || "",
      album: searchParams.get("album") || "",
    }),
    [searchParams]
  );

  const activeFilterEntries = useMemo(
    () => Object.entries(filters).filter(([, value]) => Boolean(value)),
    [filters]
  );

  const load = async ({ append = false, targetPage = 1 } = {}) => {
    setLoading(true);
    setError("");

    try {
      const data = await cachedGet("/api/songs", {
        params: {
          page: targetPage,
          limit: PAGE_SIZE,
          search: query.trim(),
          sort,
          ...filters,
        },
        ttl: 25000,
      });

      if (!data?.success) {
        throw new Error(data?.message || "Could not load songs");
      }

      const nextSongs = data.songs || [];
      setSongs((current) => (append ? [...current, ...nextSongs] : nextSongs));
      setPage(Number(data.page || targetPage));
      setPages(Number(data.pages || 1));
      setTotal(Number(data.total ?? nextSongs.length ?? 0));
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Could not load songs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => load({ targetPage: 1 }), 220);
    return () => window.clearTimeout(timer);
    // `filters` is memoized from the URL, so this intentionally reloads when a URL filter changes.
  }, [query, sort, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearFilter = (key) => {
    const next = new URLSearchParams(searchParams);
    next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const clearAllFilters = () => {
    setQuery("");
    setSort("popular");
    setSearchParams({}, { replace: true });
  };

  const title = activeFilterEntries.length
    ? `Songs for ${activeFilterEntries.map(([, value]) => value).join(" · ")}`
    : "Every song. One clean library.";

  return (
    <div className="sw-catalog-page">
      <header className="sw-catalog-hero">
        <div>
          <span className="sw-catalog-eyebrow">Songs</span>
          <h1>{title}</h1>
          <p>
            Search and play the catalog with lightweight paging instead of loading
            hundreds of tracks into memory.
          </p>
        </div>
        <span className="sw-catalog-count">{total ? `${total} songs` : ""}</span>
      </header>

      <div className="sw-catalog-toolbar">
        <div className="sw-catalog-search-wrap">
          <Search size={16} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search songs or artists"
            aria-label="Search songs or artists"
          />
        </div>

        <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort songs">
          <option value="popular">Popular</option>
          <option value="newest">Newest</option>
          <option value="liked">Most liked</option>
          <option value="az">Title A–Z</option>
        </select>

        <button
          type="button"
          className="sw-primary-btn"
          disabled={!songs.length}
          onClick={() => songs[0] && playSong?.(songs[0], songs)}
        >
          <Play size={15} fill="currentColor" />
          Play loaded songs
        </button>
      </div>

      {activeFilterEntries.length > 0 && (
        <div className="sw-active-filters" aria-label="Active song filters">
          {activeFilterEntries.map(([key, value]) => (
            <button type="button" key={key} onClick={() => clearFilter(key)}>
              <span>{key}: {value}</span>
              <X size={13} aria-hidden="true" />
            </button>
          ))}
          <button type="button" className="clear" onClick={clearAllFilters}>Clear all</button>
        </div>
      )}

      {loading && !songs.length ? (
        <CatalogSkeleton count={8} rows />
      ) : error && !songs.length ? (
        <EmptyState title="Songs could not load" message={error} onRetry={() => load({ targetPage: 1 })} />
      ) : songs.length ? (
        <div className="sw-song-list">
          {songs.map((song) => (
            <div className="sw-song-list-row" key={song._id}>
              <img src={getSongCover(song)} alt="" loading="lazy" decoding="async" />
              <button
                type="button"
                className="sw-song-title"
                onClick={() => navigate(`/song/${song._id}`, { state: { playlist: songs } })}
              >
                <strong>{song.title}</strong>
                <span>{getArtistName(song)}</span>
              </button>
              <span className="sw-song-album">{song.album?.title || "Single"}</span>
              <span className="sw-song-duration">{formatDuration(song.duration)}</span>
              <div className="sw-row-actions">
                <button
                  className="sw-icon-only"
                  type="button"
                  onClick={() => playSong?.(song, songs)}
                  aria-label={`Play ${song.title}`}
                >
                  <Play size={16} fill="currentColor" />
                </button>
                <button
                  className="sw-icon-only"
                  type="button"
                  onClick={() => navigate(`/song/${song._id}`, { state: { playlist: songs } })}
                  aria-label={`Open ${song.title}`}
                >
                  <MoreHorizontal size={17} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No songs found" message="Try a different search or remove a filter." />
      )}

      {page < pages && (
        <div className="sw-load-more">
          <button
            className="sw-secondary-btn"
            disabled={loading}
            type="button"
            onClick={() => load({ append: true, targetPage: page + 1 })}
          >
            {loading ? "Loading…" : "Load more songs"}
          </button>
        </div>
      )}
    </div>
  );
};

export default SongsPage;
