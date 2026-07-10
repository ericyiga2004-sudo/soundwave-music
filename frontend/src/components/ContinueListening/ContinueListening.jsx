import React, { useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { FaClock, FaPlay } from "react-icons/fa";

import { MusicContext } from "../../context/ShopContext";
import { MusicPlayerContext } from "../../context/MainPlayerContext";
import "./ContinueListening.css";

const MAX_HISTORY_ITEMS = 20;

const getValidToken = (token, getAuthToken) => {
  const value =
    getAuthToken?.() || String(token || localStorage.getItem("token") || "");

  const cleanValue = value.trim();

  if (
    !cleanValue ||
    cleanValue === "false" ||
    cleanValue === "null" ||
    cleanValue === "undefined"
  ) {
    return "";
  }

  return cleanValue;
};

const ContinueListening = () => {
  const { token, getAuthToken, backendUrl } = useContext(MusicContext);
  const { playSong } = useContext(MusicPlayerContext);

  const navigate = useNavigate();

  const [historySongs, setHistorySongs] = useState([]);
  const [loading, setLoading] = useState(true);

  const authToken = useMemo(() => {
    return getValidToken(token, getAuthToken);
  }, [token, getAuthToken]);

  const cleanHistorySongs = useMemo(() => {
    const seen = new Set();

    return historySongs
      .filter(Boolean)
      .filter((item) => {
        const song = item.song || item;
        const songId = song?._id;

        if (!songId || seen.has(songId)) return false;

        seen.add(songId);
        return true;
      })
      .slice(0, MAX_HISTORY_ITEMS);
  }, [historySongs]);

  const playQueue = useMemo(() => {
    return cleanHistorySongs.map((item) => item.song || item).filter(Boolean);
  }, [cleanHistorySongs]);

  const fetchHistory = async () => {
    if (!authToken || !backendUrl) {
      setHistorySongs([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const res = await axios.get(`${backendUrl}/api/history/get`, {
        headers: {
          token: authToken,
        },
      });

      if (res.data?.success) {
        const historyData =
          res.data.history ||
          res.data.recentSongs ||
          res.data.songs ||
          res.data.data ||
          [];

        setHistorySongs(Array.isArray(historyData) ? historyData : []);
      } else {
        setHistorySongs([]);
      }
    } catch (error) {
      console.log("Fetch continue listening error:", error);
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
  }, [authToken, backendUrl]);

  const getSongImage = (song) => {
    return (
      song?.imageUrl ||
      song?.image ||
      song?.coverImage ||
      song?.thumbnail ||
      song?.album?.coverImage ||
      song?.album?.imageUrl ||
      song?.album?.image ||
      "/fallback-cover.png"
    );
  };

  const getArtistName = (song) => {
    if (typeof song?.artist === "string") return song.artist;

    return (
      song?.artist?.name ||
      song?.artist?.username ||
      song?.artist?.artistName ||
      song?.artistName ||
      "Unknown Artist"
    );
  };

  const formatPlayedAt = (date) => {
    if (!date) return "Recently";

    const playedDate = new Date(date);

    if (Number.isNaN(playedDate.getTime())) return "Recently";

    const diffMs = Date.now() - playedDate.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return playedDate.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  const openSong = (song) => {
    if (!song?._id) return;

    navigate(`/song/${song._id}`, {
      state: {
        playlist: playQueue,
      },
    });

    window.scrollTo(0, 0);
  };

  const playSingleSong = (song) => {
    if (!song?._id) return;

    playSong?.(song, playQueue);
  };

  const playAll = () => {
    if (!playQueue.length) return;

    playSong?.(playQueue[0], playQueue);
  };

  if (!authToken) {
    return null;
  }

  if (loading) {
    return (
      <section className="continue-section">
        <div className="continue-loading">
          <span></span>
          Loading continue listening...
        </div>
      </section>
    );
  }

  if (!cleanHistorySongs.length) {
    return null;
  }

  return (
    <section className="continue-section">
      <div className="continue-header">
        <div>
          <span>YOUR RECENT MUSIC</span>
          <h2>Continue Listening</h2>
        </div>

        <button type="button" onClick={playAll}>
          <FaPlay />
          Play All
        </button>
      </div>

      <div className="continue-scroll-wrapper">
        <div className="continue-grid">
          {cleanHistorySongs.map((item) => {
            const song = item.song || item;
            const playedAt = item.playedAt || item.createdAt || song.playedAt;

            return (
              <article className="continue-card" key={song._id}>
                <div
                  className="continue-cover"
                  onClick={() => openSong(song)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") openSong(song);
                  }}
                >
                  <img src={getSongImage(song)} alt={song.title} />

                  <button
                    type="button"
                    className="continue-play-floating"
                    onClick={(event) => {
                      event.stopPropagation();
                      playSingleSong(song);
                    }}
                    aria-label="Play song"
                  >
                    <FaPlay />
                  </button>
                </div>

                <div className="continue-body">
                  <h3 onClick={() => openSong(song)}>
                    {song.title || "Unknown Song"}
                  </h3>

                  <p>{getArtistName(song)}</p>

                  <small>
                    <FaClock />
                    {formatPlayedAt(playedAt)}
                  </small>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ContinueListening;