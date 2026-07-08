import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { FaPlay } from "react-icons/fa";
import { MusicPlayerContext } from "../../context/MainPlayerContext";
import "./NewRelease.css";
import { Link } from "react-router-dom";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

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
    const value = song[field];

    if (!value) continue;

    const dateValue =
      typeof value === "number" ? value : new Date(value).getTime();

    if (!Number.isNaN(dateValue)) {
      return dateValue;
    }
  }

  return 0;
};

const buildRankMap = (items = [], key = "name") => {
  const map = new Map();

  items.forEach((item, index) => {
    const value = item?.[key];

    if (value !== undefined && value !== null && value !== "") {
      map.set(value.toString().toLowerCase(), index);
    }
  });

  return map;
};

const sortNewReleasesByTaste = (songs = [], preferences = {}) => {
  const countryRank = buildRankMap(preferences.countries || [], "name");
  const genreRank = buildRankMap(preferences.genres || [], "name");

  return [...songs].sort((a, b) => {
    const countryA = a.country?.toString().toLowerCase();
    const countryB = b.country?.toString().toLowerCase();

    const genreA = a.genre?.toString().toLowerCase();
    const genreB = b.genre?.toString().toLowerCase();

    const countryRankA = countryRank.has(countryA)
      ? countryRank.get(countryA)
      : 999;

    const countryRankB = countryRank.has(countryB)
      ? countryRank.get(countryB)
      : 999;

    if (countryRankA !== countryRankB) {
      return countryRankA - countryRankB;
    }

    const genreRankA = genreRank.has(genreA) ? genreRank.get(genreA) : 999;
    const genreRankB = genreRank.has(genreB) ? genreRank.get(genreB) : 999;

    if (genreRankA !== genreRankB) {
      return genreRankA - genreRankB;
    }

    const playsA = Number(a.plays || 0);
    const playsB = Number(b.plays || 0);

    if (playsB !== playsA) {
      return playsB - playsA;
    }

    const scoreA = Number(a.recommendationScore || 0);
    const scoreB = Number(b.recommendationScore || 0);

    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }

    return getSongDateValue(b) - getSongDateValue(a);
  });
};

const NewReleaseSkeleton = () => {
  return (
    <section className="new-release">
      <div className="section-header">
        <div className="nr-skeleton nr-skeleton-title"></div>
      </div>

      <div className="release-grid">
        {Array.from({ length: 8 }).map((_, index) => (
          <div className="release-card release-skeleton-card" key={index}>
            <div className="nr-skeleton nr-skeleton-image"></div>

            <div className="release-content">
              <div className="nr-skeleton nr-skeleton-line big"></div>
              <div className="nr-skeleton nr-skeleton-line small"></div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

const NewRelease = () => {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { playSong } = useContext(MusicPlayerContext);

  useEffect(() => {
    const fetchNewReleases = async () => {
      try {
        setLoading(true);

        const token = localStorage.getItem("token");

        if (token) {
          const [songsRes, preferencesRes] = await Promise.all([
            axios.get(`${backendUrl}/api/recommend/new-releases?limit=30`, {
              headers: {
                token,
              },
            }),

            axios.get(`${backendUrl}/api/recommend/preferences`, {
              headers: {
                token,
              },
            }),
          ]);

          if (songsRes.data.success) {
            const fetchedSongs = songsRes.data.songs || [];
            const preferences = preferencesRes.data?.preferences || {};

            const sortedSongs = sortNewReleasesByTaste(
              fetchedSongs,
              preferences
            );

            setSongs(sortedSongs);
          } else {
            setSongs([]);
          }

          return;
        }

        // Fallback for users who are not logged in
        const res = await axios.get(`${backendUrl}/api/songs/new-releases/all`);

        if (res.data.success) {
          const sortedSongs = [...(res.data.songs || [])].sort((a, b) => {
            const playsA = Number(a.plays || 0);
            const playsB = Number(b.plays || 0);

            if (playsB !== playsA) {
              return playsB - playsA;
            }

            return getSongDateValue(b) - getSongDateValue(a);
          });

          setSongs(sortedSongs);
        } else {
          setSongs([]);
        }
      } catch (error) {
        console.error("New releases error:", error);
        setSongs([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNewReleases();

    window.addEventListener("music-history-updated", fetchNewReleases);
    window.addEventListener("music-liked-updated", fetchNewReleases);

    return () => {
      window.removeEventListener("music-history-updated", fetchNewReleases);
      window.removeEventListener("music-liked-updated", fetchNewReleases);
    };
  }, []);

  if (loading) {
    return <NewReleaseSkeleton />;
  }

  if (!loading && songs.length === 0) {
    return null;
  }

  return (
    <section className="new-release">
      <div className="section-header">
        <h2>New Releases</h2>
      </div>

      <div className="release-grid">
        {songs.map((song) => (
          <div
            className="release-card"
            key={song._id}
            onClick={() => {
              playSong(song, songs);
              window.scrollTo(0, 0);
            }}
          >
            <Link
              className="release-link text-decoration-none"
              to={`/song/${song._id}`}
              state={{ playlist: songs }}
            >
              <div className="release-image">
                <img
                  src={song.imageUrl || "/fallback-cover.png"}
                  alt={song.title || "Song cover"}
                  loading="lazy"
                />

                <div className="play-btn">
                  <FaPlay />
                </div>
              </div>

              <div className="release-content">
                <h3 className="text-white">{song.title || "Unknown Song"}</h3>
                <p>{song.artist?.name || "Unknown Artist"}</p>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
};

export default NewRelease;