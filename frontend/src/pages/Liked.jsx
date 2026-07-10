import React, { useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { FaHeart, FaMusic, FaPlay, FaTrash, FaWifi } from "react-icons/fa";

import "./CSS/Liked.css";
import { MusicContext } from "../context/ShopContext";
import { MusicPlayerContext } from "../context/MainPlayerContext";

const Liked = () => {
  const { token, backendUrl } = useContext(MusicContext);
  const { playSong } = useContext(MusicPlayerContext);

  const navigate = useNavigate();

  const [likedSongs, setLikedSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState("");
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const likedQueue = useMemo(() => {
    return likedSongs.filter(Boolean);
  }, [likedSongs]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setLoading(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const fetchLikedSongs = async () => {
    if (!token) {
      setLikedSongs([]);
      setLoading(false);
      return;
    }

    if (!navigator.onLine) {
      setIsOffline(true);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const res = await axios.get(`${backendUrl}/api/likes/songs`, {
        headers: {
          token,
        },
      });

      if (res.data.success) {
        setLikedSongs(res.data.likedSongs || []);
      } else {
        setLikedSongs([]);
      }
    } catch (error) {
      console.log(error);

      if (!navigator.onLine) {
        setIsOffline(true);
      }

      setLikedSongs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOffline) {
      fetchLikedSongs();
    }
  }, [token, isOffline]);

  const handleRetry = () => {
    if (!navigator.onLine) {
      setIsOffline(true);
      return;
    }

    setIsOffline(false);
    fetchLikedSongs();
  };

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
    if (typeof song?.artist === "string") {
      return song.artist;
    }

    return (
      song?.artist?.name ||
      song?.artist?.username ||
      song?.artist?.artistName ||
      "Unknown Artist"
    );
  };

  const getAlbumName = (song) => {
    return song?.album?.title || song?.album?.name || "Single";
  };

  const formatDuration = (seconds) => {
    const safeSeconds = Number.isFinite(Number(seconds))
      ? Math.max(0, Number(seconds))
      : 0;

    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = Math.floor(safeSeconds % 60);

    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const playAllLikedSongs = () => {
    if (!likedQueue.length) return;
    playSong(likedQueue[0], likedQueue);
  };

  const playSingleSong = (song) => {
    playSong(song, likedQueue);
  };

  const openSong = (songId) => {
    navigate(`/song/${songId}`, {
      state: {
        playlist: likedQueue,
      },
    });
  };

  const removeFromLiked = async (songId) => {
    if (!token || !songId) return;

    if (!navigator.onLine) {
      setIsOffline(true);
      return;
    }

    try {
      setRemovingId(songId);

      const res = await axios.post(
        `${backendUrl}/api/likes/toggle/${songId}`,
        {},
        {
          headers: {
            token,
          },
        }
      );

      if (res.data.success) {
        setLikedSongs((songs) => songs.filter((song) => song._id !== songId));
      } else {
        alert(res.data.message || "Could not remove liked song");
      }
    } catch (error) {
      console.log(error);

      if (!navigator.onLine) {
        setIsOffline(true);
      } else {
        alert("Could not remove liked song");
      }
    } finally {
      setRemovingId("");
    }
  };

  if (isOffline) {
    return (
      <main className="liked-network-error">
        <div className="liked-offline-bg">
          <span></span>
          <span></span>
          <span></span>
        </div>

        <div className="liked-note liked-note-one">♪</div>
        <div className="liked-note liked-note-two">♫</div>
        <div className="liked-note liked-note-three">♬</div>
        <div className="liked-note liked-note-four">♪</div>

        <section className="liked-offline-card">
          <div className="liked-offline-character">
            <div className="liked-heart-orbit">
              <span></span>
              <span></span>
              <span></span>
            </div>

            <div className="liked-big-heart">
              <FaHeart />
            </div>

            <div className="liked-broken-wifi">
              <FaWifi />
              <div className="liked-wifi-slash"></div>
            </div>

            <div className="liked-offline-shadow"></div>
          </div>

          <div className="liked-offline-content">
            <span className="liked-offline-badge">Offline Library</span>

            <h1>Your liked songs are taking a pause</h1>

            <p>
              We need internet to sync your favorite tracks. Reconnect and your
              liked songs will come back with all the music you saved.
            </p>

            <button
              type="button"
              onClick={handleRetry}
              className="liked-retry-btn"
            >
              Try again
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="liked-page">
        <div className="container-fluid px-2 px-sm-3 px-lg-4">
          <section className="liked-empty-state mx-auto">
            <div className="liked-empty-icon">
              <FaHeart />
            </div>

            <h1>Login Required</h1>

            <p>
              Login to view your liked songs and keep your favorite tracks saved.
            </p>

            <button type="button" onClick={() => navigate("/account")}>
              Go to Login
            </button>
          </section>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="liked-page">
        <div className="container-fluid px-2 px-sm-3 px-lg-4">
          <div className="liked-loading mx-auto">
            <span></span>
            Loading liked songs...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="liked-page">
      <div className="container-fluid px-2 px-sm-3 px-lg-4">
        <section className="liked-hero row g-3 g-md-4 align-items-center mx-auto">
          <div className="col-12 col-sm-auto text-center text-sm-start">
            <div className="liked-hero-cover mx-auto mx-sm-0">
              <FaHeart />
            </div>
          </div>

          <div className="liked-hero-copy col-12 col-sm text-center text-sm-start">
            <span>Your Library</span>

            <h1>Liked Songs</h1>

            <p>
              {likedSongs.length} {likedSongs.length === 1 ? "song" : "songs"}{" "}
              saved to your collection.
            </p>
          </div>

          <div className="col-12 col-lg-auto text-center text-lg-end">
            <button
              type="button"
              className="liked-play-all-btn"
              onClick={playAllLikedSongs}
              disabled={likedSongs.length === 0}
            >
              <FaPlay />
              Play All
            </button>
          </div>
        </section>

        {likedSongs.length > 0 ? (
          <section className="liked-table-card mx-auto">
            <div className="liked-table-head d-none d-xl-grid">
              <span>#</span>
              <span>Title</span>
              <span>Album</span>
              <span>Genre</span>
              <span>Time</span>
              <span></span>
            </div>

            <div className="liked-list">
              {likedSongs.map((song, index) => (
                <article className="liked-row" key={song._id}>
                  <span className="liked-index d-none d-md-flex">
                    {index + 1}
                  </span>

                  <div
                    className="liked-song-main"
                    onClick={() => openSong(song._id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") openSong(song._id);
                    }}
                  >
                    <img
                      src={getSongImage(song)}
                      alt={song.title || "Song cover"}
                    />

                    <div className="liked-song-text">
                      <h3>{song.title || "Unknown Song"}</h3>
                      <p>{getArtistName(song)}</p>

                      <div className="liked-mobile-meta d-xl-none">
                        <span>{getAlbumName(song)}</span>
                        <span>{song.genre || "Unknown"}</span>
                        <span>{formatDuration(song.duration)}</span>
                      </div>
                    </div>
                  </div>

                  <span className="liked-album d-none d-xl-inline">
                    {getAlbumName(song)}
                  </span>

                  <span className="liked-genre d-none d-xl-inline">
                    {song.genre || "Unknown"}
                  </span>

                  <span className="liked-duration d-none d-xl-inline">
                    {formatDuration(song.duration)}
                  </span>

                  <div className="liked-actions">
                    <button
                      type="button"
                      className="liked-row-play"
                      onClick={() => playSingleSong(song)}
                      title="Play song"
                    >
                      <FaPlay />
                    </button>

                    <button
                      type="button"
                      className="liked-row-remove"
                      onClick={() => removeFromLiked(song._id)}
                      disabled={removingId === song._id}
                      title="Remove from liked"
                    >
                      {removingId === song._id ? "..." : <FaTrash />}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <section className="liked-empty-state mx-auto">
            <div className="liked-empty-icon">
              <FaMusic />
            </div>

            <h1>No Liked Songs Yet</h1>

            <p>Tap the heart button on any song and it will appear here.</p>

            <button type="button" onClick={() => navigate("/")}>
              Discover Music
            </button>
          </section>
        )}
      </div>
    </main>
  );
};

export default Liked;