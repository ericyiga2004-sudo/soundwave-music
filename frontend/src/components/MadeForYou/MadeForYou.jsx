import React, { useEffect, useState } from "react";
import axios from "axios";
import SongItem from "../SongItem/SongItem";
import "./MadeForYou.css";

const MadeForYou = () => {
  const [madeForYouSongs, setMadeForYouSongs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMadeForYou = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        setLoading(false);
        return;
      }

      const res = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/api/user/recommendations`,
        {
          headers: {
            token,
          },
        }
      );

      if (res.data.success) {
        setMadeForYouSongs(res.data.songs || []);
      }
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMadeForYou();
  }, []);

  return (
    <section className="made-section">
      <div className="made-header">
        <div>
          <h2 className="made-title">Made For You</h2>
          <p className="made-subtitle">Songs picked from taste.</p>
        </div>
      </div>

      {loading ? (
        <div className="made-slider">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div className="made-skeleton-card" key={item}>
              <div className="made-skeleton-cover"></div>
              <div className="made-skeleton-line made-skeleton-title"></div>
              <div className="made-skeleton-line made-skeleton-text"></div>
            </div>
          ))}
        </div>
      ) : madeForYouSongs.length === 0 ? (
        <p className="made-empty">
          Like a few songs first so we can learn your music taste.
        </p>
      ) : (
        <div className="made-slider">
          {madeForYouSongs.map((song) => (
            <div className="made-slide-item" key={song._id}>
              <SongItem song={song} queue={madeForYouSongs} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default MadeForYou;