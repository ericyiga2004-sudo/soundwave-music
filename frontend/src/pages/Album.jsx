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

const AlbumSkeleton = () => {
  return (
    <div className="album-page">
      <div className="album-hero album-hero-skeleton">
        <div className="album-skeleton album-skeleton-cover"></div>

        <div className="album-hero-overlay album-skeleton-overlay">
          <div className="album-skeleton album-skeleton-label"></div>
          <div className="album-skeleton album-skeleton-title"></div>
          <div className="album-skeleton album-skeleton-artist"></div>
          <div className="album-skeleton album-skeleton-desc"></div>
          <div className="album-skeleton album-skeleton-desc short"></div>

          <div className="album-skeleton-meta-row">
            <div className="album-skeleton album-skeleton-meta"></div>
            <div className="album-skeleton album-skeleton-meta small"></div>
          </div>

          <div className="album-skeleton album-skeleton-button"></div>
        </div>
      </div>

      <div className="album-tracks">
        <div className="album-skeleton album-skeleton-tracks-title"></div>

        {Array.from({ length: 7 }).map((_, index) => (
          <div className="track-item album-track-skeleton" key={index}>
            <div className="album-skeleton album-skeleton-number"></div>
            <div className="album-skeleton album-skeleton-track-img"></div>

            <div className="track-info">
              <div className="album-skeleton album-skeleton-track-title"></div>
              <div className="album-skeleton album-skeleton-track-artist"></div>
            </div>

            <div className="album-skeleton album-skeleton-duration"></div>
            <div className="album-skeleton album-skeleton-play"></div>
          </div>
        ))}
      </div>
    </div>
  );
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
    let mounted = true;

    const fetchAlbum = async () => {
      try {
        setLoading(true);

        const res = await axios.get(`${backendUrl}/api/albums/${albumId}`);

        if (!mounted) return;

        if (res.data?.success) {
          setAlbum(res.data.album || null);
        } else {
          setAlbum(null);
        }
      } catch (err) {
        console.log(err);

        if (mounted) {
          setAlbum(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchAlbum();

    return () => {
      mounted = false;
    };
  }, [albumId]);

  const albumQueue = useMemo(() => {
    if (!album?.songs?.length) return [];

    return normalizeSongs(album.songs);
  }, [album]);

  const playAlbum = () => {
    if (!albumQueue.length) {
      alert("No songs found in this album");
      return;
    }

    playSong(albumQueue[0], albumQueue);
  };

  const playTrack = (song) => {
    if (!song?._id) return;

    const isActiveSong = currentSong?._id === song._id;

    if (isActiveSong) {
      togglePlay();
      return;
    }

    playSong(song, albumQueue);
  };

  const getAlbumImage = () => {
    return (
      album?.coverImage ||
      album?.imageUrl ||
      album?.image ||
      "/fallback-cover.png"
    );
  };

  const getSongImage = (song) => {
    return (
      song?.imageUrl ||
      song?.image ||
      song?.coverImage ||
      song?.thumbnail ||
      getAlbumImage()
    );
  };

  const getArtistName = (song) => {
    if (typeof song?.artist === "string") return song.artist;

    return (
      song?.artist?.name ||
      song?.artist?.username ||
      song?.artistName ||
      album?.artist?.name ||
      "Unknown Artist"
    );
  };

  if (loading) {
    return <AlbumSkeleton />;
  }

  if (!album) {
    return (
      <div className="album-page">
        <div className="album-loading">
          Album not found
        </div>
      </div>
    );
  }

  return (
    <div className="album-page">
      <div className="album-hero">
        <img
          src={getAlbumImage()}
          alt={album.title || "Album cover"}
          className="album-hero-img"
        />

        <div className="album-hero-overlay">
          <span className="label">ALBUM</span>

          <h1>{album.title || "Untitled Album"}</h1>

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
            <FaPlay />
            Play Album
          </button>
        </div>
      </div>

      <div className="album-tracks">
        <h2>Tracks</h2>

        {albumQueue.length === 0 ? (
          <p className="album-empty-text">
            No songs in this album yet
          </p>
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
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    playTrack(song);
                  }
                }}
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
                  src={getSongImage(song)}
                  alt={song.title || "Song cover"}
                />

                <div className="track-info">
                  <h4>
                    {song.title || "Unknown Song"}

                    {active && (
                      <span className="album-now-playing">
                        Playing now
                      </span>
                    )}
                  </h4>

                  <p>{getArtistName(song)}</p>
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
                  aria-label={playingNow ? "Pause song" : "Play song"}
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