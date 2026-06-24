import React, {
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocation, useParams } from "react-router-dom";
import axios from "axios";
import {
  FaPause,
  FaPlay,
} from "react-icons/fa";
import { MusicPlayerContext } from "../context/MainPlayerContext";
import "./CSS/Album.css";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

const normalizeSongs = (songs = []) => {
  const seen = new Set();

  return songs.filter((song) => {
    if (!song?._id || seen.has(song._id)) return false;
    seen.add(song._id);
    return true;
  });
};

const formatTime = (seconds = 0) => {
  const safeSeconds = Number.isFinite(Number(seconds))
    ? Math.max(0, Number(seconds))
    : 0;

  const mins = Math.floor(safeSeconds / 60);
  const secs = Math.floor(safeSeconds % 60);

  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const Album = () => {
  const { albumId } = useParams();
  const location = useLocation();

  const {
    currentSong,
    isPlaying,
    playSong,
    togglePlay,
  } = useContext(MusicPlayerContext);

  const [album, setAlbum] = useState(location.state?.album || null);
  const [loading, setLoading] = useState(!location.state?.album);

  useEffect(() => {
    const fetchAlbum = async () => {
      try {
        setLoading(true);

        const res = await axios.get(
          `${backendUrl}/api/albums/${albumId}`
        );

        if (res.data.success) {
          setAlbum(res.data.album);
        }
      } catch (err) {
        console.log(err);
        setAlbum(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAlbum();
  }, [albumId]);

  const albumQueue = useMemo(() => {
    if (!album?.songs?.length) return [];

    const albumArtistId = album.artist?._id;

    const songsFromThisAlbumArtist = album.songs.filter((song) => {
      if (!song?._id) return false;

      if (!albumArtistId) return true;

      return song.artist?._id === albumArtistId;
    });

    return normalizeSongs(songsFromThisAlbumArtist);
  }, [album]);

  const playAlbum = () => {
    if (!albumQueue.length) {
      alert("No songs found in this album");
      return;
    }

    playSong(albumQueue[0], albumQueue);
  };

  const playTrack = (song) => {
    const isActiveSong = currentSong?._id === song._id;

    if (isActiveSong) {
      togglePlay();
      return;
    }

    playSong(song, albumQueue);
  };

  if (loading) {
    return <div className="album-loading">Loading album...</div>;
  }

  if (!album) {
    return <div className="album-loading">Album not found</div>;
  }

  return (
    <div className="album-page">
      <div className="album-hero">
        <img
          src={album.coverImage || "/fallback-cover.png"}
          alt={album.title}
          className="album-hero-img"
        />

        <div className="album-hero-overlay">
          <span className="label">ALBUM</span>

          <h1>{album.title}</h1>

          <p className="artist-name">
            {album.artist?.name || "Unknown Artist"}
          </p>

          <p className="desc">
            {album.description || "No description available."}
          </p>

          <div className="meta">
            <span>{albumQueue.length} Songs</span>
            <span>
              {album.createdAt
                ? new Date(album.createdAt).getFullYear()
                : "Unknown Year"}
            </span>
          </div>

          <button
            type="button"
            className="play-all"
            onClick={playAlbum}
            disabled={albumQueue.length === 0}
          >
            <FaPlay /> Play Album
          </button>
        </div>
      </div>

      <div className="album-tracks">
        <h2>Tracks</h2>

        {albumQueue.length === 0 ? (
          <p>No songs in this album yet</p>
        ) : (
          albumQueue.map((song, index) => {
            const active = currentSong?._id === song._id;
            const playingNow = active && isPlaying;

            return (
              <div
                key={song._id}
                className={`track-item ${active ? "active" : ""} ${
                  playingNow ? "playing-now" : ""
                }`}
                onClick={() => playTrack(song)}
                style={{ cursor: "pointer" }}
              >
                <div className="track-number">
                  {playingNow ? (
                    <span className="album-mini-equalizer">
                      <i></i>
                      <i></i>
                      <i></i>
                    </span>
                  ) : active ? (
                    <FaPause />
                  ) : (
                    index + 1
                  )}
                </div>

                <img
                  src={song.imageUrl || album.coverImage || "/fallback-cover.png"}
                  alt={song.title}
                />

                <div className="track-info">
                  <h4>
                    {song.title}
                    {active && (
                      <span className="album-now-playing">
                        Playing now
                      </span>
                    )}
                  </h4>

                  <p>
                    {song.artist?.name ||
                      album.artist?.name ||
                      "Unknown Artist"}
                  </p>
                </div>

                <span className="track-duration">
                  {formatTime(song.duration)}
                </span>

                <button
                  type="button"
                  className="track-play"
                  onClick={(e) => {
                    e.stopPropagation();
                    playTrack(song);
                  }}
                >
                  {playingNow ? <FaPause /> : <FaPlay />}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Album;