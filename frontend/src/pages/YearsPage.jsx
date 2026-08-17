import { useContext, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaMusic, FaPlay } from "react-icons/fa";
import { MusicPlayerContext } from "../context/MainPlayerContext";
import "./CSS/YearsPage.css";

import { API_BASE_URL } from "../config/api";

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
    title: "2000s Hits",
    subtitle: "Popular songs from 2000 to 2009",
    fromYear: 2000,
    toYear: 2009,
    slug: "2000s",
    banner:
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1600&q=80",
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
    title: "2020s Hits",
    subtitle: "Popular songs from 2020 to 2026",
    fromYear: 2020,
    toYear: 2026,
    slug: "2020s",
    banner:
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1600&q=80",
  },
];

const normalizeText = (value) => {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

const normalizeSongs = (songs = []) => {
  const seen = new Set();

  return songs.filter((song) => {
    if (!song?._id || seen.has(song._id)) return false;

    seen.add(song._id);
    return true;
  });
};

const getSongCountry = (song) => {
  return (
    song?.country ||
    song?.artist?.country ||
    song?.album?.country ||
    ""
  );
};

const getDateValue = (song = {}) => {
  const value =
    song.releaseDate ||
    song.createdAt ||
    song.updatedAt ||
    song.uploadedAt ||
    song.uploadTime;

  if (!value) return 0;

  const dateValue =
    typeof value === "number" ? value : new Date(value).getTime();

  return Number.isNaN(dateValue) ? 0 : dateValue;
};

const buildRankMap = (items = [], key = "name") => {
  const map = new Map();

  items.forEach((item, index) => {
    const value = item?.[key];

    if (value !== undefined && value !== null && value !== "") {
      map.set(normalizeText(value), index);
    }
  });

  return map;
};

const sortYearSongsByCountryAndPlays = (songs = [], preferences = {}) => {
  const countryRank = buildRankMap(preferences.countries || [], "name");
  const genreRank = buildRankMap(preferences.genres || [], "name");
  const moodRank = buildRankMap(preferences.moods || [], "name");

  return normalizeSongs(songs).sort((a, b) => {
    const countryA = normalizeText(getSongCountry(a));
    const countryB = normalizeText(getSongCountry(b));

    const genreA = normalizeText(a.genre);
    const genreB = normalizeText(b.genre);

    const moodA = normalizeText(a.mood);
    const moodB = normalizeText(b.mood);

    const countryRankA = countryRank.has(countryA)
      ? countryRank.get(countryA)
      : 999;

    const countryRankB = countryRank.has(countryB)
      ? countryRank.get(countryB)
      : 999;

    // 1. User preferred country first
    if (countryRankA !== countryRankB) {
      return countryRankA - countryRankB;
    }

    // 2. Most listened songs in that country first
    const playsA = Number(a.plays || 0);
    const playsB = Number(b.plays || 0);

    if (playsB !== playsA) {
      return playsB - playsA;
    }

    // 3. Preferred genre
    const genreRankA = genreRank.has(genreA) ? genreRank.get(genreA) : 999;
    const genreRankB = genreRank.has(genreB) ? genreRank.get(genreB) : 999;

    if (genreRankA !== genreRankB) {
      return genreRankA - genreRankB;
    }

    // 4. Preferred mood
    const moodRankA = moodRank.has(moodA) ? moodRank.get(moodA) : 999;
    const moodRankB = moodRank.has(moodB) ? moodRank.get(moodB) : 999;

    if (moodRankA !== moodRankB) {
      return moodRankA - moodRankB;
    }

    // 5. Most liked
    const likesA = Number(a.likes || 0);
    const likesB = Number(b.likes || 0);

    if (likesB !== likesA) {
      return likesB - likesA;
    }

    // 6. Backend recommendation score
    const scoreA = Number(a.recommendationScore || 0);
    const scoreB = Number(b.recommendationScore || 0);

    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }

    // 7. Newest last tie-breaker
    return getDateValue(b) - getDateValue(a);
  });
};

const YearsPage = () => {
  const { yearSlug } = useParams();
  const navigate = useNavigate();
  const { playSong } = useContext(MusicPlayerContext);

  const collection = useMemo(() => {
    return yearCollections.find((item) => item.slug === yearSlug);
  }, [yearSlug]);

  const [songs, setSongs] = useState([]);
  const [preferences, setPreferences] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchSongs = async () => {
      if (!collection) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const token = localStorage.getItem("token");

        if (token) {
          const [songsRes, preferencesRes] = await Promise.all([
            fetch(
              `${API_BASE_URL}/api/recommend/years?fromYear=${collection.fromYear}&toYear=${collection.toYear}&limit=100`,
              {
                headers: {
                  token,
                },
              }
            ),

            fetch(`${API_BASE_URL}/api/recommend/preferences`, {
              headers: {
                token,
              },
            }),
          ]);

          if (!songsRes.ok) {
            throw new Error(`Request failed with status ${songsRes.status}`);
          }

          const songsData = await songsRes.json();

          const preferencesData = preferencesRes.ok
            ? await preferencesRes.json()
            : {
                success: false,
                preferences: {},
              };

          const fetchedSongs = songsData.success ? songsData.songs || [] : [];
          const fetchedPreferences = preferencesData.success
            ? preferencesData.preferences || {}
            : {};

          setPreferences(fetchedPreferences);
          setSongs(
            sortYearSongsByCountryAndPlays(fetchedSongs, fetchedPreferences)
          );

          setError(
            songsData.success ? "" : songsData.message || "Failed to load songs"
          );

          return;
        }

        const url = new URL("/api/songs/filter", API_BASE_URL);

        url.searchParams.set("fromYear", String(collection.fromYear));
        url.searchParams.set("toYear", String(collection.toYear));
        url.searchParams.set("limit", "100");
        url.searchParams.set("sort", "popular");

        const res = await fetch(url.toString());

        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }

        const data = await res.json();

        const fetchedSongs = data.success ? data.songs || [] : [];

        setPreferences({});
        setSongs(
          normalizeSongs(fetchedSongs).sort((a, b) => {
            const playsA = Number(a.plays || 0);
            const playsB = Number(b.plays || 0);

            if (playsB !== playsA) {
              return playsB - playsA;
            }

            const likesA = Number(a.likes || 0);
            const likesB = Number(b.likes || 0);

            if (likesB !== likesA) {
              return likesB - likesA;
            }

            return getDateValue(b) - getDateValue(a);
          })
        );

        setError(data.success ? "" : data.message || "Failed to load songs");
      } catch (error) {
        console.error("Failed to fetch yearly collection songs:", error);
        setError("Could not load songs for this collection.");
        setSongs([]);
        setPreferences({});
      } finally {
        setLoading(false);
      }
    };

    fetchSongs();

    window.addEventListener("music-history-updated", fetchSongs);
    window.addEventListener("music-liked-updated", fetchSongs);
    window.addEventListener("artist-follow-updated", fetchSongs);

    return () => {
      window.removeEventListener("music-history-updated", fetchSongs);
      window.removeEventListener("music-liked-updated", fetchSongs);
      window.removeEventListener("artist-follow-updated", fetchSongs);
    };
  }, [collection]);

  const playlist = useMemo(() => {
    return sortYearSongsByCountryAndPlays(songs, preferences);
  }, [songs, preferences]);

  const handlePlaySong = (event, song) => {
    event.preventDefault();
    event.stopPropagation();

    playSong(song, playlist);
  };

  if (!collection) {
    return (
      <main className="years-page">
        <div className="container py-5">
          <button
            type="button"
            className="btn btn-light mb-4"
            onClick={() => navigate(-1)}
          >
            <FaArrowLeft className="me-2" />
            Back
          </button>

          <div className="years-empty">
            <FaMusic />
            <h2>Collection not found</h2>
            <p>The yearly music collection you are looking for does not exist.</p>

            <Link to="/" className="btn btn-light">
              Go Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="years-page">
      <div className="years-hero">
        <div className="container">
          <button type="button" className="years-back-btn" onClick={() => navigate(-1)}>
            <FaArrowLeft />
            Back
          </button>
          <div className="years-hero-grid">
            <img className="years-hero-art" src={collection.banner} alt="" />
            <div className="years-hero-content">
              <span className="years-range">
                {collection.fromYear === collection.toYear ? collection.fromYear : `${collection.fromYear} - ${collection.toYear}`}
              </span>
              <h1>{collection.title}</h1>
              <p>{collection.subtitle}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-4 py-lg-5">
        {loading ? (
          <div className="years-loading">Loading songs...</div>
        ) : error ? (
          <div className="years-empty">
            <FaMusic />
            <h2>Unable to load songs</h2>
            <p>{error}</p>
          </div>
        ) : playlist.length > 0 ? (
          <div className="row g-3 g-md-4">
            {playlist.map((song) => (
              <div className="col-6 col-md-4 col-lg-3 col-xl-2" key={song._id}>
                <div className="years-song-card">
                  <Link
                    to={`/song/${song._id}`}
                    state={{
                      playlist,
                    }}
                    className="years-song-link text-decoration-none"
                    onClick={() => window.scrollTo(0, 0)}
                  >
                    <div className="years-song-img-wrap">
                      <img
                        src={song.imageUrl || "/fallback-cover.svg"}
                        alt={song.title || "Song cover"}
                        className="years-song-img"
                        loading="lazy"
                      />

                      <button
                        type="button"
                        className="years-play-btn"
                        aria-label={`Play ${song.title || "this song"}`}
                        onClick={(event) => handlePlaySong(event, song)}
                      >
                        <FaPlay />
                      </button>
                    </div>

                    <div className="years-song-info">
                      <h3>{song.title || "Unknown Song"}</h3>

                      <p>
                        {song.artist?.name ||
                          song.artist?.artistName ||
                          "Unknown Artist"}
                      </p>

                      <span>
                        {song.releaseYear || "Unknown year"}
                        {getSongCountry(song) ? ` • ${getSongCountry(song)}` : ""}
                      </span>
                    </div>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="years-empty">
            <FaMusic />
            <h2>No songs found</h2>
            <p>No songs have been added to this yearly collection yet.</p>
          </div>
        )}
      </div>
    </main>
  );
};

export default YearsPage;