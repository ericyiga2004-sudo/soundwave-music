import { useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { FaArrowRight, FaPlay } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { MusicPlayerContext } from "../../context/MainPlayerContext";
import { API_BASE_URL as backendUrl } from "../../config/api";
import "./NewRelease.css";

const dateFields = [
  "releaseDate",
  "releasedAt",
  "uploadTime",
  "uploadedAt",
  "createdAt",
  "updatedAt",
];

const getSongDateValue = (song = {}) => {
  for (const field of dateFields) {
    const value = song?.[field];
    if (!value) continue;

    const result = typeof value === "number" ? value : new Date(value).getTime();
    if (!Number.isNaN(result)) return result;
  }

  return 0;
};

const normalizeSongs = (items = []) => {
  const seen = new Set();

  return items.filter((song) => {
    const id = String(song?._id || "");
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

const buildPreferenceScoreMap = (items = [], key = "name") => {
  const map = new Map();

  items.forEach((item) => {
    const value = item?.[key];
    if (value === undefined || value === null || value === "") return;
    map.set(
      String(value).toLowerCase(),
      Number(item?.effectiveScore ?? item?.score ?? 0)
    );
  });

  return map;
};

const sortNewReleasesByTaste = (songs = [], preferences = {}) => {
  const countries = buildPreferenceScoreMap(preferences.countries || []);
  const genres = buildPreferenceScoreMap(preferences.genres || []);
  const languages = buildPreferenceScoreMap(preferences.languages || []);

  return [...songs].sort((a, b) => {
    const score = (song) => {
      const countryScore = Number(
        countries.get(String(song?.country || "").toLowerCase()) || 0
      );
      const genreScore = Number(
        genres.get(String(song?.genre || "").toLowerCase()) || 0
      );
      const languageScore = Number(
        languages.get(String(song?.songLanguage || "").toLowerCase()) || 0
      );

      return (
        countryScore * 120 +
        genreScore * 170 +
        languageScore * 130 +
        Number(song?.recommendationScore || 0) * 30 +
        Math.log1p(Number(song?.plays || 0)) * 5
      );
    };

    const scoreDifference = score(b) - score(a);
    if (scoreDifference !== 0) return scoreDifference;

    return getSongDateValue(b) - getSongDateValue(a);
  });
};

const fetchPublicNewReleases = async () => {
  const candidates = [
    `${backendUrl}/api/songs/new-releases/all?limit=36`,
    `${backendUrl}/api/songs?limit=36&sort=newest`,
    `${backendUrl}/api/songs/filter?limit=36&sort=newest`,
  ];

  let lastError = null;

  for (const url of candidates) {
    try {
      const response = await axios.get(url, { timeout: 15000 });
      const songs = normalizeSongs(response.data?.songs || []);

      if (response.data?.success && songs.length > 0) {
        return songs;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) throw lastError;
  return [];
};

const NewReleaseSkeleton = () => (
  <section className="new-release container-fluid px-3 px-sm-4 px-xl-5">
    <div className="new-release-heading d-flex align-items-end justify-content-between gap-3">
      <div>
        <span className="new-release-eyebrow">Fresh music</span>
        <div className="nr-skeleton nr-skeleton-title" />
      </div>
    </div>

    <div className="row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-xl-6 g-3 g-lg-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <div className="col" key={index}>
          <div className="release-card release-skeleton-card h-100">
            <div className="nr-skeleton nr-skeleton-image" />
            <div className="release-content">
              <div className="nr-skeleton nr-skeleton-line big" />
              <div className="nr-skeleton nr-skeleton-line small" />
            </div>
          </div>
        </div>
      ))}
    </div>
  </section>
);

const NewRelease = () => {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const { playSong } = useContext(MusicPlayerContext);
  const navigate = useNavigate();

  const fetchNewReleases = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const publicSongs = await fetchPublicNewReleases();
      const token = String(localStorage.getItem("token") || "").trim();

      let preferences = {};
      if (token) {
        try {
          const response = await axios.get(
            `${backendUrl}/api/recommend/preferences`,
            {
              headers: { token },
              timeout: 10000,
            }
          );

          if (response.data?.success) {
            preferences = response.data.preferences || {};
          }
        } catch (error) {
          console.log("New release personalization unavailable:", error);
        }
      }

      const sorted = token
        ? sortNewReleasesByTaste(publicSongs, preferences)
        : [...publicSongs].sort((a, b) => {
            const dateDifference = getSongDateValue(b) - getSongDateValue(a);
            if (dateDifference !== 0) return dateDifference;
            return Number(b?.plays || 0) - Number(a?.plays || 0);
          });

      setSongs(sorted);
    } catch (error) {
      console.error("New releases error:", error);
      setSongs([]);
      setErrorMessage("New releases could not be loaded right now.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNewReleases();

    window.addEventListener("music-history-updated", fetchNewReleases);
    window.addEventListener("music-liked-updated", fetchNewReleases);
    window.addEventListener("soundwave-personalization-updated", fetchNewReleases);

    return () => {
      window.removeEventListener("music-history-updated", fetchNewReleases);
      window.removeEventListener("music-liked-updated", fetchNewReleases);
      window.removeEventListener("soundwave-personalization-updated", fetchNewReleases);
    };
  }, []);

  const visibleSongs = useMemo(() => songs.slice(0, 6), [songs]);

  if (loading) return <NewReleaseSkeleton />;

  return (
    <section className="new-release container-fluid px-3 px-sm-4 px-xl-5">
      <div className="new-release-heading d-flex align-items-end justify-content-between gap-3">
        <div>
          <span className="new-release-eyebrow">Fresh music</span>
          <h2>New Releases</h2>
          <p>Recently added songs from the SoundWave catalog.</p>
        </div>

        <button
          type="button"
          className="new-release-view-all"
          onClick={() => navigate("/songs?sort=newest")}
        >
          View All <FaArrowRight />
        </button>
      </div>

      {visibleSongs.length > 0 ? (
        <div className="row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-xl-6 g-3 g-lg-4">
          {visibleSongs.map((song) => (
            <div className="col" key={song._id}>
              <article className="release-card h-100">
                <button
                  type="button"
                  className="release-image-button"
                  onClick={() => {
                    playSong(song, songs);
                  }}
                  aria-label={`Play ${song.title || "song"}`}
                >
                  <span className="release-image">
                    <img
                      src={song.imageUrl || "/fallback-cover.svg"}
                      alt={song.title || "Song cover"}
                      loading="lazy"
                      decoding="async"
                    />
                    <span className="play-btn" aria-hidden="true">
                      <FaPlay />
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  className="release-content"
                  onClick={() => {
                    navigate(`/song/${song._id}`, { state: { playlist: songs } });
                    window.scrollTo(0, 0);
                  }}
                >
                  <h3>{song.title || "Unknown Song"}</h3>
                  <p>{song.artist?.name || "Unknown Artist"}</p>
                </button>
              </article>
            </div>
          ))}
        </div>
      ) : (
        <div className="new-release-empty">
          <span>{errorMessage || "No new releases are available yet."}</span>
          <button type="button" onClick={fetchNewReleases}>Retry</button>
        </div>
      )}
    </section>
  );
};

export default NewRelease;
