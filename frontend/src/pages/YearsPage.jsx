import React, { useContext, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaMusic, FaPlay } from "react-icons/fa";
import { MusicPlayerContext } from "../context/MainPlayerContext";
import "./CSS/YearsPage.css";

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;

const yearCollections = [
  {
    title: "1900s Classics",
    subtitle: "Old-school gems from 1900 to 1999",
    fromYear: 1900,
    toYear: 1999,
    slug: "1900s",
    banner:
      "https://images.unsplash.com/photo-1494232410401-ad00d5433cfa?auto=format&fit=crop&w=1600&q=80",
  },
  {
    title: "2010s Hits",
    subtitle: "Popular songs from 2010 to 2019",
    fromYear: 2010,
    toYear: 2019,
    slug: "2010s",
    banner:
      "https://images.unsplash.com/photo-1507874457470-272b3c8d8ee2?auto=format&fit=crop&w=1600&q=80",
  },
  {
    title: "2020 Collection",
    subtitle: "Songs released in 2020",
    fromYear: 2020,
    toYear: 2020,
    slug: "2020",
    banner:
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1600&q=80",
  },
  {
    title: "2026 Fresh Sounds",
    subtitle: "New music from 2026",
    fromYear: 2026,
    toYear: 2026,
    slug: "2026",
    banner:
      "https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=1600&q=80",
  },
];

const skeletonCards = Array.from({ length: 18 });

const normalizeSongs = (songs = []) => {
  const seen = new Set();

  return songs.filter((song) => {
    if (!song?._id || seen.has(song._id)) return false;

    seen.add(song._id);
    return true;
  });
};

const formatNumber = (value) => {
  const number = Number(value || 0);

  if (number >= 1000000) return `${(number / 1000000).toFixed(1)}M`;
  if (number >= 1000) return `${(number / 1000).toFixed(1)}K`;

  return number;
};

const getArtistName = (song) => {
  return song?.artist?.name || song?.artist?.artistName || "Unknown Artist";
};

const YearSongSkeleton = () => {
  return (
    <div className="col-6 col-md-4 col-lg-3 col-xl-2">
      <div className="years-song-card years-song-skeleton" aria-hidden="true">
        <div className="years-skeleton-img"></div>

        <div className="years-song-info">
          <div className="years-skeleton-line years-skeleton-title"></div>
          <div className="years-skeleton-line years-skeleton-artist"></div>
          <div className="years-skeleton-line years-skeleton-meta"></div>
        </div>
      </div>
    </div>
  );
};

const YearsPage = () => {
  const { yearSlug } = useParams();
  const navigate = useNavigate();
  const { playSong } = useContext(MusicPlayerContext);

  const [songs, setSongs] = useState([]);
  const [sort, setSort] = useState("popular");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const collection = useMemo(() => {
    return yearCollections.find((item) => item.slug === yearSlug);
  }, [yearSlug]);

  const playlist = useMemo(() => normalizeSongs(songs), [songs]);

  useEffect(() => {
    if (!collection) return;

    const controller = new AbortController();

    const fetchSongs = async () => {
      if (!API_BASE_URL) {
        setSongs([]);
        setTotal(0);
        setPage(1);
        setPages(1);
        setLoading(false);
        setError("Backend URL is missing.");
        return;
      }

      try {
        setLoading(true);
        setError("");

        const url = new URL("/api/songs/filter", API_BASE_URL);

        url.searchParams.set("fromYear", collection.fromYear);
        url.searchParams.set("toYear", collection.toYear);
        url.searchParams.set("page", "1");
        url.searchParams.set("limit", "24");
        url.searchParams.set("sort", sort);

        const res = await fetch(url.toString(), {
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }

        const data = await res.json();

        if (!data.success) {
          throw new Error(data.message || "Could not load songs.");
        }

        setSongs(data.songs || []);
        setTotal(data.total || 0);
        setPage(data.page || 1);
        setPages(data.pages || 1);
      } catch (error) {
        if (error.name === "AbortError") return;

        console.error("Failed to fetch year songs:", error);

        setSongs([]);
        setTotal(0);
        setPage(1);
        setPages(1);
        setError("Could not load songs for this collection.");
      } finally {
        setLoading(false);
      }
    };

    fetchSongs();

    return () => controller.abort();
  }, [collection, sort]);

  const handleLoadMore = async () => {
    if (!collection || loadingMore || page >= pages) return;

    try {
      setLoadingMore(true);
      setError("");

      const nextPage = page + 1;
      const url = new URL("/api/songs/filter", API_BASE_URL);

      url.searchParams.set("fromYear", collection.fromYear);
      url.searchParams.set("toYear", collection.toYear);
      url.searchParams.set("page", nextPage);
      url.searchParams.set("limit", "24");
      url.searchParams.set("sort", sort);

      const res = await fetch(url.toString());

      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message || "Could not load more songs.");
      }

      setSongs((prev) => normalizeSongs([...prev, ...(data.songs || [])]));
      setTotal(data.total || total);
      setPage(data.page || nextPage);
      setPages(data.pages || pages);
    } catch (error) {
      console.error("Failed to load more year songs:", error);
      setError("Could not load more songs.");
    } finally {
      setLoadingMore(false);
    }
  };

  const handlePlaySong = (song) => {
    playSong(song, playlist);
  };

  const handlePlayAll = () => {
    if (playlist.length === 0) return;

    playSong(playlist[0], playlist);
  };

  if (!collection) {
    return (
      <main className="years-page">
        <div className="container py-4 py-lg-5">
          <button className="years-back-btn" onClick={() => navigate(-1)}>
            <FaArrowLeft />
            Back
          </button>

          <div className="years-not-found">
            <div className="years-not-found-icon">
              <FaMusic />
            </div>

            <h1>Collection not found</h1>
            <p>The yearly music collection you are looking for does not exist.</p>

            <Link to="/" className="years-primary-btn">
              Go Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="years-page">
      <section
        className="years-hero"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(5, 5, 12, 0.96), rgba(5, 5, 12, 0.58), rgba(5, 5, 12, 0.88)), url(${collection.banner})`,
        }}
      >
        <div className="container py-4 py-lg-5">
          <button className="years-back-btn" onClick={() => navigate(-1)}>
            <FaArrowLeft />
            Back
          </button>

          <div className="years-hero-content">
            <span className="years-kicker">Yearly Collection</span>

            <h1>{collection.title}</h1>

            <p>{collection.subtitle}</p>

            <div className="years-hero-meta">
              <span>
                {collection.fromYear === collection.toYear
                  ? collection.fromYear
                  : `${collection.fromYear} - ${collection.toYear}`}
              </span>

              <span>{loading ? "Loading songs..." : `${total} songs`}</span>
            </div>

            <div className="years-hero-actions">
              <button
                type="button"
                className="years-primary-btn"
                onClick={handlePlayAll}
                disabled={playlist.length === 0}
              >
                <FaPlay />
                Play All
              </button>

              <Link to="/" className="years-secondary-btn">
                Browse Home
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="years-content">
        <div className="container py-4 py-lg-5">
          <div className="years-toolbar">
            <div>
              <span className="years-toolbar-label">Showing</span>
              <h2>All Songs</h2>
            </div>

            <div className="years-sort-wrap">
              <label htmlFor="years-sort">Sort by</label>

              <select
                id="years-sort"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="popular">Popular</option>
                <option value="liked">Most Liked</option>
                <option value="newest">Newest Added</option>
                <option value="oldest">Oldest Added</option>
                <option value="year-desc">Release Year: Newest</option>
                <option value="year-asc">Release Year: Oldest</option>
                <option value="az">Title A-Z</option>
                <option value="za">Title Z-A</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="row g-3">
              {skeletonCards.map((_, index) => (
                <YearSongSkeleton key={`years-skeleton-${index}`} />
              ))}
            </div>
          ) : error && songs.length === 0 ? (
            <div className="years-empty">
              <div className="years-empty-icon">
                <FaMusic />
              </div>
              <h3>{error}</h3>
              <p>Please try again later.</p>
            </div>
          ) : songs.length > 0 ? (
            <>
              <div className="row g-3">
                {songs.map((song) => (
                  <div className="col-6 col-md-4 col-lg-3 col-xl-2" key={song._id}>
                    <div
                      className="years-song-card"
                      onClick={() => handlePlaySong(song)}
                    >
                      <Link
                        to={`/song/${song._id}`}
                        state={{
                          playlist,
                        }}
                        className="years-song-link"
                      >
                        <div className="years-song-img-wrap">
                          <img
                            src={song.imageUrl || "/fallback-cover.png"}
                            alt={song.title || "Song cover"}
                            className="years-song-img"
                            loading="lazy"
                          />

                          <div className="years-play-btn">
                            <FaPlay />
                          </div>
                        </div>

                        <div className="years-song-info">
                          <h3>{song.title || "Unknown Song"}</h3>

                          <p>{getArtistName(song)}</p>

                          <div className="years-song-meta">
                            <span>{song.releaseYear || "Unknown"}</span>
                            <span>{formatNumber(song.plays)} plays</span>
                          </div>
                        </div>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              {error ? <div className="years-inline-error">{error}</div> : null}

              {page < pages ? (
                <div className="years-load-more-wrap">
                  <button
                    type="button"
                    className="years-load-more-btn"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? "Loading..." : "Load More Songs"}
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="years-empty">
              <div className="years-empty-icon">
                <FaMusic />
              </div>
              <h3>No songs found</h3>
              <p>No songs have been added to this yearly collection yet.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
};

export default YearsPage;