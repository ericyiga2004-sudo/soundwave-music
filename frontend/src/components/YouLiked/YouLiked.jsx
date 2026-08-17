import React, { useEffect, useState } from "react";
import axios from "axios";
import SongItem from "../SongItem/SongItem";
import "./YouLiked.css";
import { API_BASE_URL } from "../../config/api";

const YouLiked = () => {
  const [songs, setSongs] = useState([]);
  const [basedOn, setBasedOn] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchBecauseYouLiked = async () => {
    try {
      setLoading(true);

      const token = localStorage.getItem("token");

      if (!token) {
        setSongs([]);
        setBasedOn(null);
        return;
      }

      const [likedRes, recommendRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/likes/songs`, {
          headers: {
            token,
          },
        }),

        axios.get(
          `${API_BASE_URL}/api/recommend/liked?limit=20`,
          {
            headers: {
              token,
            },
          }
        ),
      ]);

      if (!likedRes.data.success || !recommendRes.data.success) {
        setSongs([]);
        setBasedOn(null);
        return;
      }

      const likedSongs = likedRes.data.likedSongs || [];
      const recommendedSongs = recommendRes.data.songs || [];

      const seedSong = likedSongs[0] || null;

      setBasedOn(seedSong);

      const filteredSongs = seedSong
        ? recommendedSongs.filter((song) => song._id !== seedSong._id)
        : recommendedSongs;

      setSongs(filteredSongs);
    } catch (error) {
      console.log("Because you liked error:", error);
      setSongs([]);
      setBasedOn(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBecauseYouLiked();

    window.addEventListener("music-liked-updated", fetchBecauseYouLiked);

    return () => {
      window.removeEventListener("music-liked-updated", fetchBecauseYouLiked);
    };
  }, []);

  if (!loading && (!basedOn || songs.length === 0)) {
    return null;
  }

  return (
    <section className="you-liked-section">
      <div className="you-liked-glow"></div>

      <div className="you-liked-header">
        <div>
          <span className="you-liked-badge">Personal Mix</span>

          <h2 className="you-liked-title">
            {basedOn?.title
              ? `Because You Liked ${basedOn.title}`
              : "Because You Liked"}
          </h2>

          <p className="you-liked-subtitle">
            {basedOn?.artist?.name
              ? `More songs with a similar feel to ${basedOn.artist.name}`
              : "More songs matched from your liked music"}
          </p>
        </div>

        {basedOn?.imageUrl && (
          <div className="you-liked-seed">
            <img src={basedOn.imageUrl} alt={basedOn.title || "Liked song"}  loading="lazy" decoding="async" />

            <div>
              <small>Based on</small>
              <strong>{basedOn.title}</strong>

              {basedOn?.artist?.name && <span>{basedOn.artist.name}</span>}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="you-liked-slider">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div className="you-liked-skeleton-card" key={item}>
              <div className="you-liked-skeleton-cover"></div>
              <div className="you-liked-skeleton-line you-liked-skeleton-title"></div>
              <div className="you-liked-skeleton-line you-liked-skeleton-text"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="you-liked-slider">
          {songs.map((song) => (
            <div className="you-liked-slide-item" key={song._id}>
              <SongItem song={song} queue={songs} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default YouLiked;