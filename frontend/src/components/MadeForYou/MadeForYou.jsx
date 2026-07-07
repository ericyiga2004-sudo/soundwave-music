import React, { useEffect, useState } from "react";
import axios from "axios";
import SongItem from "../SongItem/SongItem";
import "./MadeForYou.css";

const MadeForYou = () => {
  const [madeForYouSongs, setMadeForYouSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const fetchMadeForYou = async () => {
    try {
      setLoading(true);

      const token = localStorage.getItem("token");

      if (!token) {
        setMadeForYouSongs([]);
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
      } else {
        setMadeForYouSongs([]);
      }
    } catch (error) {
      console.log("Made For You error:", error);
      setMadeForYouSongs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    if (navigator.onLine) {
      setIsOffline(false);
      fetchMadeForYou();
    } else {
      setIsOffline(true);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      fetchMadeForYou();
    };

    const handleOffline = () => {
      setIsOffline(true);
      setLoading(false);
      setMadeForYouSongs([]);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (navigator.onLine) {
      fetchMadeForYou();
    } else {
      setLoading(false);
      setIsOffline(true);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!loading && !isOffline && madeForYouSongs.length === 0) {
    return null;
  }

  return (
    <section className="made-section">
      <div className="made-header">
        <div>
          <h2 className="made-title">Made For You</h2>
          <p className="made-subtitle">Songs picked from your taste.</p>
        </div>
      </div>

      {isOffline ? (
        <div className="made-offline-card">
          <div className="made-offline-bg">
            <span></span>
            <span></span>
            <span></span>
          </div>

          <div className="made-music-note note-1">♪</div>
          <div className="made-music-note note-2">♫</div>
          <div className="made-music-note note-3">♬</div>
          <div className="made-music-note note-4">♪</div>

          <div className="made-sparkle sparkle-1"></div>
          <div className="made-sparkle sparkle-2"></div>
          <div className="made-sparkle sparkle-3"></div>

          <div className="made-offline-character">
            <div className="made-offline-antenna">
              <span></span>
            </div>

            <div className="made-offline-head">
              <div className="made-offline-ear left"></div>
              <div className="made-offline-ear right"></div>

              <div className="made-offline-face">
                <div className="made-offline-eye left"></div>
                <div className="made-offline-eye right"></div>
                <div className="made-offline-mouth"></div>
              </div>
            </div>

            <div className="made-offline-body">
              <div className="made-offline-arm left"></div>
              <div className="made-offline-arm right"></div>

              <div className="made-offline-wifi">
                <span></span>
                <span></span>
                <span></span>
                <div className="made-wifi-slash"></div>
              </div>
            </div>

            <div className="made-offline-feet">
              <span></span>
              <span></span>
            </div>

            <div className="made-offline-shadow"></div>
          </div>

          <div className="made-offline-content">
            <div className="made-offline-badge">No Signal</div>
            <h3>Oops, the music flew away!</h3>
            <p>
              You are offline right now. Connect to the internet and your
              personalized songs will come dancing back.
            </p>

            <button className="made-retry-btn" onClick={handleRetry}>
              Try reconnecting
            </button>
          </div>
        </div>
      ) : loading ? (
        <div className="made-slider">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div className="made-skeleton-card" key={item}>
              <div className="made-skeleton-cover"></div>
              <div className="made-skeleton-line made-skeleton-title"></div>
              <div className="made-skeleton-line made-skeleton-text"></div>
            </div>
          ))}
        </div>
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