import React, { useEffect, useState } from "react";
import axios from "axios";
import SongItem from "../SongItem/SongItem";
import "./ContinueListening.css";

const MIN_HISTORY_SONGS = 1;
const MAX_HISTORY_SONGS = 20;

const ContinueListening = () => {
  const [historySongs, setHistorySongs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      setLoading(true);

      const token = localStorage.getItem("token");

      if (!token) {
        setHistorySongs([]);
        return;
      }

      const res = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/api/history/get`,
        {
          headers: {
            token,
          },
        }
      );

      if (res.data.success) {
        const songs = (res.data.history || [])
          .map((item) => item.song)
          .filter(Boolean);

        setHistorySongs(songs.slice(0, MAX_HISTORY_SONGS));
      } else {
        setHistorySongs([]);
      }
    } catch (error) {
      console.log("Fetch history error:", error);
      setHistorySongs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();

    window.addEventListener("music-history-updated", fetchHistory);

    return () => {
      window.removeEventListener("music-history-updated", fetchHistory);
    };
  }, []);

  if (!loading && historySongs.length < MIN_HISTORY_SONGS) {
    return null;
  }

  return (
    <section className="continue-section">
      <div className="continue-header">
        <div>
          <h2 className="continue-title">Continue Listening</h2>
          <p className="continue-subtitle">
            Jump back into songs you played recently
          </p>
        </div>
      </div>

      {loading ? (
        <div className="continue-slider">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div className="continue-skeleton-card" key={item}>
              <div className="continue-skeleton-cover"></div>
              <div className="continue-skeleton-line continue-skeleton-title"></div>
              <div className="continue-skeleton-line continue-skeleton-text"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="continue-slider">
          {historySongs.map((song) => (
            <div className="continue-slide-item" key={song._id}>
              <SongItem song={song} queue={historySongs} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default ContinueListening;