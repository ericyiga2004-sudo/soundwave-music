import React, { useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import axios from "axios";
import {
  FaPause,
  FaPlay,
  FaClock,
  FaMusic,
  FaCompactDisc,
} from "react-icons/fa";
import { MusicPlayerContext } from "../context/MainPlayerContext";
import "./CSS/Album.css";

import { API_BASE_URL as backendUrl } from "../config/api";
import { trackTasteEvent } from "../utils/personalization";

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

const getYear = (date) => {
  if (!date) return "Unknown Year";

  const year = new Date(date).getFullYear();

  return Number.isNaN(year) ? "Unknown Year" : year;
};

const AlbumSkeleton = () => {
  return (
    <main className="album-page">
      <section className="container-fluid album-container">
        <div className="album-skeleton-card">
          <div className="row g-4 align-items-end">
            <div className="col-12 col-md-5 col-lg-4">
              <div className="album-skeleton album-skeleton-cover"></div>
            </div>

            <div className="col-12 col-md-7 col-lg-8">
              <div className="album-skeleton album-skeleton-label"></div>
              <div className="album-skeleton album-skeleton-title"></div>
              <div className="album-skeleton album-skeleton-text"></div>
              <div className="album-skeleton album-skeleton-text short"></div>
              <div className="album-skeleton album-skeleton-button"></div>
            </div>
          </div>
        </div>

        <div className="album-track-list">
          {Array.from({ length: 7 }).map((_, index) => (
            <div className="album-track album-track-loading" key={index}>
              <div className="album-skeleton album-skeleton-number"></div>
              <div className="album-skeleton album-skeleton-thumb"></div>
              <div className="album-track-info">
                <div className="album-skeleton album-skeleton-track-title"></div>
                <div className="album-skeleton album-skeleton-track-subtitle"></div>
              </div>
              <div className="album-skeleton album-skeleton-duration"></div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
};

const Album = () => {
  const { albumId } = useParams();
  const location = useLocation();

  const { currentSong, isPlaying, playSong, togglePlay } =
    useContext(MusicPlayerContext);

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
      } catch (error) {
        console.log("Failed to fetch album:", error);

        if (mounted) {
          setAlbum(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    if (albumId) {
      fetchAlbum();
    }

    return () => {
      mounted = false;
    };
  }, [albumId]);

  useEffect(() => {
    if (album?._id) trackTasteEvent("album_view", { albumId: album._id }, { cooldownMs: 90000 });
  }, [album?._id]);

  const albumQueue = useMemo(() => {
    if (!album?.songs?.length) return [];

    return normalizeSongs(album.songs);
  }, [album]);

  const albumImage =
    album?.coverImage ||
    album?.imageUrl ||
    album?.image ||
    "/fallback-cover.svg";

  const albumArtist =
    album?.artist?.name ||
    album?.artistName ||
    album?.artist ||
    "Unknown Artist";

  const totalDuration = albumQueue.reduce((total, song) => {
    return total + Number(song?.duration || 0);
  }, 0);

  const getSongImage = (song) => {
    return (
      song?.imageUrl ||
      song?.image ||
      song?.coverImage ||
      song?.thumbnail ||
      albumImage
    );
  };

  const getArtistName = (song) => {
    if (typeof song?.artist === "string") return song.artist;

    return (
      song?.artist?.name ||
      song?.artist?.username ||
      song?.artistName ||
      albumArtist ||
      "Unknown Artist"
    );
  };

  const playAlbum = () => {
    if (!albumQueue.length) return;

    playSong(albumQueue[0], albumQueue);
  };

  const playTrack = (song) => {
    if (!song?._id) return;

    const activeSong = currentSong?._id === song._id;

    if (activeSong) {
      togglePlay();
      return;
    }

    playSong(song, albumQueue);
  };

  if (loading) {
    return <AlbumSkeleton />;
  }

  if (!album) {
    return (
      <main className="album-page">
        <section className="container-fluid album-container">
          <div className="album-empty-state">
            <FaCompactDisc />
            <h2>Album not found</h2>
            <p>This album may have been removed or is currently unavailable.</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="album-page">
      <section className="container-fluid album-container">
        <div className="album-hero">
          <div className="row g-4 g-lg-5 align-items-end">
            <div className="col-12 col-md-5 col-lg-4">
              <div className="album-cover-wrap">
                <img
                  src={albumImage}
                  alt={album.title || "Album cover"}
                  className="album-cover"
                  loading="lazy"
                />
              </div>
            </div>

            <div className="col-12 col-md-7 col-lg-8">
              <div className="album-info">
                <span className="album-label">
                  <FaCompactDisc />
                  Album
                </span>

                <h1>{album.title || "Untitled Album"}</h1>

                <p className="album-artist">{albumArtist}</p>

                <p className="album-description">
                  {album.description || "No description available for this album."}
                </p>

                <div className="album-meta">
                  <span>
                    <FaMusic />
                    {albumQueue.length} {albumQueue.length === 1 ? "Song" : "Songs"}
                  </span>

                  <span>{getYear(album.releaseDate || album.createdAt)}</span>

                  <span>
                    <FaClock />
                    {formatTime(totalDuration)}
                  </span>
                </div>

                <button
                  type="button"
                  className="album-play-button"
                  onClick={playAlbum}
                  disabled={albumQueue.length === 0}
                >
                  <FaPlay />
                  Play Album
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="album-tracks-header">
          <div>
            <span>Tracklist</span>
            <h2>Songs</h2>
          </div>

          <p>{albumQueue.length} total</p>
        </div>

        {albumQueue.length === 0 ? (
          <div className="album-empty-state small">
            <FaMusic />
            <h2>No songs yet</h2>
            <p>This album does not have any uploaded songs.</p>
          </div>
        ) : (
          <div className="album-track-list">
            {albumQueue.map((song, index) => {
              const active = currentSong?._id === song._id;
              const playingNow = active && isPlaying;

              return (
                <div
                  className={`album-track ${active ? "active" : ""}`}
                  key={song._id}
                  onClick={() => playTrack(song)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      playTrack(song);
                    }
                  }}
                >
                  <div className="album-track-number">
                    {playingNow ? (
                      <span className="album-equalizer">
                        <i></i>
                        <i></i>
                        <i></i>
                      </span>
                    ) : (
                      index + 1
                    )}
                  </div>

                  <img
                    src={getSongImage(song)}
                    alt={song.title || "Song cover"}
                    className="album-track-image"
                    loading="lazy"
                  />

                  <div className="album-track-info">
                    <h3>
                      {song.title || "Unknown Song"}

                      {active && (
                        <span className="album-playing-badge">
                          {playingNow ? "Playing" : "Paused"}
                        </span>
                      )}
                    </h3>

                    <p>{getArtistName(song)}</p>
                  </div>

                  <span className="album-track-duration">
                    {formatTime(song.duration)}
                  </span>

                  <button
                    type="button"
                    className="album-track-play"
                    onClick={(event) => {
                      event.stopPropagation();
                      playTrack(song);
                    }}
                    aria-label={playingNow ? "Pause song" : "Play song"}
                  >
                    {playingNow ? <FaPause /> : <FaPlay />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
};

export default Album;