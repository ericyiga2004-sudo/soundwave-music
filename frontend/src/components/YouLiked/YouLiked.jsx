import React, { useEffect, useState } from "react";
import axios from "axios";
import SongItem from "../SongItem/SongItem";
import "./YouLiked.css";

const YouLiked = () => {
  const [songs, setSongs] = useState([]);
  const [title, setTitle] = useState("Because You Liked");
  const [basedOn, setBasedOn] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchBecauseYouLiked = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        setSongs([]);
        setLoading(false);
        return;
      }

      const res = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/api/user/because-you-liked`,
        {
          headers: {
            token,
          },
        }
      );

      if (res.data.success) {
        setTitle(res.data.title || "Because You Liked");
        setBasedOn(res.data.basedOn || null);
        setSongs(res.data.songs || []);
      } else {
        setSongs([]);
      }
    } catch (error) {
      console.log("Because you liked error:", error);
      setSongs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBecauseYouLiked();
  }, []);

  if (!loading && songs.length === 0) {
    return null;
  }

  return (
    <section className="you-liked-section">
      <div className="you-liked-glow"></div>

      <div className="you-liked-header">
        <div>
          <span className="you-liked-badge">Personal Mix</span>
          <h2 className="you-liked-title">{title}</h2>

          <p className="you-liked-subtitle">
            {basedOn?.artist?.name
              ? `More songs with a similar feel to ${basedOn.artist.name}`
              : "Songs matched from your favorite music taste"}
          </p>
        </div>

        {basedOn?.imageUrl && (
          <div className="you-liked-seed">
            <img src={basedOn.imageUrl} alt={basedOn.title || "Liked song"} />
            <div>
              <small>Based on</small>
              <strong>{basedOn.title}</strong>
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