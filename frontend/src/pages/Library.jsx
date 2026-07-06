import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import axios from "axios";
import { Link } from "react-router-dom";

import {
  FaArrowRight,
  FaCheckCircle,
  FaClock,
  FaCompactDisc,
  FaDownload,
  FaHeadphones,
  FaHeart,
  FaHistory,
  FaListUl,
  FaMusic,
  FaPlay,
  FaSearch,
  FaTrash,
  FaWifi,
} from "react-icons/fa";

import { MusicContext } from "../context/ShopContext";
import { MusicPlayerContext } from "../context/MainPlayerContext";
import {
  getOfflineSongs,
  isSongOfflineAvailable,
  removeOfflineSong,
} from "../utils/offlineDownload";

import "./CSS/Library.css";

const FALLBACK_COVER = "/fallback-cover.png";
const PLAYLIST_COVER = "/playlist.png";

const formatTime = (seconds = 0) => {
  const safeSeconds = Number(seconds);

  if (!Number.isFinite(safeSeconds) || safeSeconds <= 0) return "0:00";

  const mins = Math.floor(safeSeconds / 60);
  const secs = Math.floor(safeSeconds % 60);

  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const getSongId = (song) => song?._id || song?.id || "";

const getSongImage = (song) =>
  song?.imageUrl ||
  song?.image ||
  song?.coverImage ||
  song?.thumbnail ||
  song?.album?.image ||
  song?.album?.coverImage ||
  FALLBACK_COVER;

const getArtistName = (song) => {
  if (song?.artistName) return song.artistName;
  if (!song?.artist) return "Unknown Artist";
  if (typeof song.artist === "string") return song.artist;

  return song.artist.name || song.artist.artistName || "Unknown Artist";
};

const getAlbumTitle = (song) => {
  if (song?.albumTitle) return song.albumTitle;
  if (!song?.album) return "";
  if (typeof song.album === "string") return song.album;

  return song.album.title || "";
};

const getSongTitle = (song) => song?.title || song?.name || "Untitled Song";

const matchesSearch = (item, searchTerm) => {
  const search = searchTerm.toLowerCase().trim();

  if (!search) return true;

  const title = getSongTitle(item).toLowerCase();
  const artist = getArtistName(item).toLowerCase();
  const album = getAlbumTitle(item).toLowerCase();

  return title.includes(search) || artist.includes(search) || album.includes(search);
};

const normalizeHistorySongs = (items = []) =>
  items
    .map((item) => {
      if (item?.song) {
        return {
          ...item.song,
          playedAt: item.playedAt,
        };
      }

      return item;
    })
    .filter((song) => getSongId(song));

const removeDuplicateSongs = (songs = []) => {
  const seen = new Set();

  return songs.filter((song) => {
    const songId = getSongId(song);

    if (!songId || seen.has(songId)) return false;

    seen.add(songId);
    return true;
  });
};

const libraryPageStyles = `
.boom-library-page {
  min-height: 100vh;
  padding: 18px 14px 120px;
  color: #f8fafc;
  background:
    radial-gradient(circle at top left, rgba(20, 184, 166, 0.35), transparent 34%),
    linear-gradient(180deg, #07110f 0%, #0b1513 42%, #050807 100%);
}

.boom-library-shell {
  width: min(1180px, 100%);
  margin: 0 auto;
}

.boom-hero {
  position: relative;
  overflow: hidden;
  border-radius: 26px;
  padding: 24px;
  background:
    linear-gradient(135deg, rgba(10, 199, 129, 0.95), rgba(15, 118, 110, 0.86)),
    #0f766e;
  box-shadow: 0 22px 60px rgba(0, 0, 0, 0.35);
}

.boom-hero::after {
  content: "";
  position: absolute;
  right: -60px;
  top: -60px;
  width: 220px;
  height: 220px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
}

.boom-hero-top,
.boom-hero-actions,
.boom-stats,
.boom-search,
.boom-tabs,
.boom-section-head,
.boom-song-row,
.boom-playlist-row,
.boom-empty,
.boom-dj-banner {
  position: relative;
  z-index: 1;
}

.boom-hero-top {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-start;
}

.boom-kicker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 8px;
  color: rgba(255, 255, 255, 0.82);
  font-size: 0.82rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.boom-hero h1 {
  margin: 0;
  font-size: clamp(2.1rem, 6vw, 4.7rem);
  line-height: 0.95;
  letter-spacing: 0;
}

.boom-hero p {
  max-width: 620px;
  margin: 12px 0 0;
  color: rgba(255, 255, 255, 0.88);
  font-size: 1rem;
}

.boom-hero-disc {
  display: grid;
  place-items: center;
  flex: 0 0 92px;
  width: 92px;
  height: 92px;
  border-radius: 999px;
  color: #052e24;
  background:
    radial-gradient(circle, #ffffff 0 11%, transparent 12%),
    conic-gradient(from 90deg, #ecfeff, #99f6e4, #134e4a, #ecfeff);
  box-shadow: inset 0 0 0 10px rgba(4, 47, 46, 0.16), 0 18px 34px rgba(0, 0, 0, 0.25);
}

.boom-hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 22px;
}

.boom-pill-link,
.boom-primary-action,
.boom-secondary-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 42px;
  border: 0;
  border-radius: 999px;
  padding: 0 16px;
  font-weight: 800;
  text-decoration: none;
  cursor: pointer;
}

.boom-primary-action {
  color: #042f2e;
  background: #ffffff;
}

.boom-secondary-action,
.boom-pill-link {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(12px);
}

.boom-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin: 14px 0;
}

.boom-stat-card {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.055);
}

.boom-stat-card span {
  display: block;
  color: #9ca3af;
  font-size: 0.78rem;
  font-weight: 800;
}

.boom-stat-card strong {
  display: block;
  margin-top: 4px;
  color: #ffffff;
  font-size: 1.35rem;
}

.boom-search {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 52px;
  margin-top: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  padding: 0 16px;
  color: #99f6e4;
  background: rgba(255, 255, 255, 0.07);
}

.boom-search input {
  width: 100%;
  border: 0;
  outline: 0;
  color: #ffffff;
  background: transparent;
}

.boom-search input::placeholder {
  color: #94a3b8;
}

.boom-tabs {
  display: flex;
  gap: 9px;
  overflow-x: auto;
  padding: 14px 0 4px;
  scrollbar-width: none;
}

.boom-tabs::-webkit-scrollbar {
  display: none;
}

.boom-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  padding: 10px 14px;
  color: #cbd5e1;
  background: rgba(255, 255, 255, 0.055);
  font-weight: 800;
}

.boom-tab.active {
  color: #041411;
  background: #22c55e;
}

.boom-section {
  margin-top: 18px;
}

.boom-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 10px;
}

.boom-section-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.boom-section-title h2 {
  margin: 0;
  font-size: 1.2rem;
}

.boom-section-title p {
  margin: 2px 0 0;
  color: #94a3b8;
  font-size: 0.86rem;
}

.boom-count-badge {
  border-radius: 999px;
  padding: 7px 11px;
  color: #86efac;
  background: rgba(34, 197, 94, 0.12);
  font-weight: 800;
  font-size: 0.78rem;
}

.boom-list {
  display: grid;
  gap: 9px;
}

.boom-song-row,
.boom-playlist-row {
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 12px;
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.075);
  border-radius: 18px;
  padding: 9px;
  color: #ffffff;
  background: rgba(255, 255, 255, 0.055);
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}

.boom-cover {
  position: relative;
  overflow: hidden;
  width: 54px;
  height: 54px;
  border-radius: 14px;
  background: #10201d;
}

.boom-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.boom-offline-dot {
  position: absolute;
  right: 5px;
  bottom: 5px;
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  color: #052e16;
  background: #22c55e;
  font-size: 0.62rem;
}

.boom-song-main {
  min-width: 0;
}

.boom-song-main h3 {
  overflow: hidden;
  margin: 0;
  color: #ffffff;
  font-size: 0.98rem;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.boom-song-main p {
  overflow: hidden;
  margin: 4px 0 0;
  color: #94a3b8;
  font-size: 0.84rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.boom-song-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  padding: 7px 10px;
  color: #cbd5e1;
  background: rgba(255, 255, 255, 0.07);
  font-size: 0.78rem;
  font-weight: 800;
  white-space: nowrap;
}

.boom-play-btn,
.boom-delete-btn {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 0;
  border-radius: 999px;
  color: #041411;
  background: #22c55e;
  cursor: pointer;
}

.boom-delete-btn {
  color: #fecaca;
  background: rgba(239, 68, 68, 0.16);
}

.boom-empty,
.boom-login-box {
  border: 1px dashed rgba(255, 255, 255, 0.14);
  border-radius: 22px;
  padding: 24px;
  color: #94a3b8;
  background: rgba(255, 255, 255, 0.045);
}

.boom-empty h3,
.boom-login-box h3 {
  margin: 0 0 6px;
  color: #ffffff;
}

.boom-dj-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 22px;
  border-radius: 24px;
  padding: 20px;
  color: #ffffff;
  background: linear-gradient(135deg, rgba(20, 184, 166, 0.2), rgba(34, 197, 94, 0.13));
}

.boom-dj-banner h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 6px;
}

.boom-dj-banner p {
  margin: 0;
  color: #94a3b8;
}

.boom-dj-banner a {
  text-decoration: none;
}

.boom-error {
  margin-top: 12px;
  border-radius: 16px;
  padding: 12px;
  color: #fecaca;
  background: rgba(239, 68, 68, 0.12);
}

@media (max-width: 720px) {
  .boom-library-page {
    padding: 12px 10px 110px;
  }

  .boom-hero {
    border-radius: 22px;
    padding: 20px;
  }

  .boom-hero-top {
    display: block;
  }

  .boom-hero-disc {
    width: 70px;
    height: 70px;
    margin-top: 18px;
  }

  .boom-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .boom-song-row,
  .boom-playlist-row {
    grid-template-columns: 50px minmax(0, 1fr) auto;
  }

  .boom-song-chip {
    display: none;
  }

  .boom-dj-banner {
    display: block;
  }

  .boom-dj-banner .boom-primary-action {
    width: 100%;
    margin-top: 14px;
  }
}
`;

const Library = () => {
  const {
    backendUrl,
    token,
    playlists,
    fetchPlaylists,
  } = useContext(MusicContext);

  const { playSong } = useContext(MusicPlayerContext);

  const fetchPlaylistsRef = useRef(fetchPlaylists);
  const lastPlaylistFetchTokenRef = useRef("");
  const offlineRequestIdRef = useRef(0);
  const historyRequestIdRef = useRef(0);
  const likesRequestIdRef = useRef(0);

  const [historySongs, setHistorySongs] = useState([]);
  const [likedSongs, setLikedSongs] = useState([]);
  const [offlineSongs, setOfflineSongs] = useState([]);

  const [activeCategory, setActiveCategory] = useState("Offline");
  const [searchTerm, setSearchTerm] = useState("");

  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingLikes, setLoadingLikes] = useState(false);
  const [loadingOffline, setLoadingOffline] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    fetchPlaylistsRef.current = fetchPlaylists;
  }, [fetchPlaylists]);

  const refreshOfflineSongs = useCallback(async (showLoader = true) => {
    const requestId = offlineRequestIdRef.current + 1;
    offlineRequestIdRef.current = requestId;

    try {
      if (showLoader) {
        setLoadingOffline(true);
      }

      const savedSongs = getOfflineSongs();
      const availability = await Promise.all(
        savedSongs.map(async (song) => {
          const available = await isSongOfflineAvailable(song).catch(() => false);
          return available ? song : null;
        })
      );

      if (offlineRequestIdRef.current === requestId) {
        setOfflineSongs(availability.filter(Boolean));
      }
    } catch (error) {
      console.log("Fetch offline songs error:", error);
      if (offlineRequestIdRef.current === requestId) {
        setOfflineSongs([]);
        setError("Failed to load offline songs.");
      }
    } finally {
      if (showLoader && offlineRequestIdRef.current === requestId) {
        setLoadingOffline(false);
      }
    }
  }, []);

  const fetchHistorySongs = useCallback(async (showLoader = true) => {
    const requestId = historyRequestIdRef.current + 1;
    historyRequestIdRef.current = requestId;

    try {
      if (!backendUrl || !token) {
        setHistorySongs([]);
        setLoadingHistory(false);
        return;
      }

      if (showLoader) {
        setLoadingHistory(true);
      }

      const res = await axios.get(`${backendUrl}/api/history/get`, {
        headers: { token },
      });

      if (historyRequestIdRef.current !== requestId) return;

      if (res.data?.success) {
        setHistorySongs(res.data.history || []);
      } else {
        setHistorySongs([]);
      }
    } catch (error) {
      console.log("Fetch history error:", error);
      if (historyRequestIdRef.current === requestId) {
        setHistorySongs([]);
        setError("Failed to load listening history.");
      }
    } finally {
      if (showLoader && historyRequestIdRef.current === requestId) {
        setLoadingHistory(false);
      }
    }
  }, [backendUrl, token]);

  const fetchLikedSongs = useCallback(async () => {
    const requestId = likesRequestIdRef.current + 1;
    likesRequestIdRef.current = requestId;

    try {
      if (!backendUrl || !token) {
        setLikedSongs([]);
        setLoadingLikes(false);
        return;
      }

      setLoadingLikes(true);

      const res = await axios.get(`${backendUrl}/api/likes/songs`, {
        headers: { token },
      });

      if (likesRequestIdRef.current !== requestId) return;

      if (res.data?.success) {
        setLikedSongs(res.data.likedSongs || []);
      } else {
        setLikedSongs([]);
      }
    } catch (error) {
      console.log("Fetch liked songs error:", error);
      if (likesRequestIdRef.current === requestId) {
        setLikedSongs([]);
        setError("Failed to load liked songs.");
      }
    } finally {
      if (likesRequestIdRef.current === requestId) {
        setLoadingLikes(false);
      }
    }
  }, [backendUrl, token]);

  useEffect(() => {
    refreshOfflineSongs(true);
  }, [refreshOfflineSongs]);

  useEffect(() => {
    fetchHistorySongs(true);
    fetchLikedSongs();
  }, [fetchHistorySongs, fetchLikedSongs]);

  useEffect(() => {
    if (!token) {
      lastPlaylistFetchTokenRef.current = "";
      return;
    }

    if (lastPlaylistFetchTokenRef.current === token) return;

    lastPlaylistFetchTokenRef.current = token;
    fetchPlaylistsRef.current?.();
  }, [token]);

  useEffect(() => {
    const handleStorageUpdate = () => {
      refreshOfflineSongs(false);
    };

    window.addEventListener("storage", handleStorageUpdate);
    window.addEventListener("music-offline-songs-updated", handleStorageUpdate);

    return () => {
      window.removeEventListener("storage", handleStorageUpdate);
      window.removeEventListener("music-offline-songs-updated", handleStorageUpdate);
    };
  }, [refreshOfflineSongs]);

  const normalizedHistorySongs = useMemo(
    () => normalizeHistorySongs(historySongs),
    [historySongs]
  );

  const allLibrarySongs = useMemo(
    () => removeDuplicateSongs([...offlineSongs, ...likedSongs, ...normalizedHistorySongs]),
    [likedSongs, normalizedHistorySongs, offlineSongs]
  );

  const filteredOfflineSongs = useMemo(
    () => offlineSongs.filter((song) => matchesSearch(song, searchTerm)),
    [offlineSongs, searchTerm]
  );

  const filteredLikedSongs = useMemo(
    () => likedSongs.filter((song) => matchesSearch(song, searchTerm)),
    [likedSongs, searchTerm]
  );

  const filteredHistorySongs = useMemo(
    () => normalizedHistorySongs.filter((song) => matchesSearch(song, searchTerm)),
    [normalizedHistorySongs, searchTerm]
  );

  const filteredPlaylists = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();

    return (playlists || []).filter((playlist) => {
      const name = (playlist?.name || playlist?.title || "Untitled Playlist").toLowerCase();
      return !search || name.includes(search);
    });
  }, [playlists, searchTerm]);

  const handlePlaySong = async (song, queueSource = []) => {
    const songId = getSongId(song);

    if (!songId) return;

    const queue = removeDuplicateSongs([
      song,
      ...queueSource.filter((item) => getSongId(item) !== songId),
    ]);

    playSong?.(song, queue);

    try {
      if (backendUrl && navigator.onLine) {
        await axios.patch(`${backendUrl}/api/songs/${songId}/play`);
      }
    } catch (error) {
      console.log("Increment plays error:", error);
    }

    try {
      if (backendUrl && token && navigator.onLine) {
        await axios.post(
          `${backendUrl}/api/history/add`,
          { songId },
          { headers: { token } }
        );

        fetchHistorySongs(false);
      }
    } catch (error) {
      console.log("Add history error:", error);
    }
  };

  const handleRemoveOfflineSong = async (song) => {
    const songId = getSongId(song);

    if (!songId) return;

    try {
      await removeOfflineSong(song);
      await refreshOfflineSongs();
      window.dispatchEvent(new Event("music-offline-songs-updated"));
    } catch (error) {
      console.log("Remove offline song error:", error);
      setError("Could not remove offline song.");
    }
  };

  const playAllOffline = () => {
    if (!filteredOfflineSongs.length) return;
    handlePlaySong(filteredOfflineSongs[0], filteredOfflineSongs);
  };

  const sections = [
    {
      id: "Offline",
      label: "Offline",
      icon: <FaDownload />,
      count: offlineSongs.length,
    },
    {
      id: "All",
      label: "All",
      icon: <FaMusic />,
      count: allLibrarySongs.length,
    },
    {
      id: "Liked Songs",
      label: "Liked",
      icon: <FaHeart />,
      count: likedSongs.length,
    },
    {
      id: "History",
      label: "History",
      icon: <FaHistory />,
      count: normalizedHistorySongs.length,
    },
    {
      id: "Playlists",
      label: "Playlists",
      icon: <FaListUl />,
      count: playlists?.length || 0,
    },
  ];

  const showOfflineSection = activeCategory === "Offline" || activeCategory === "All";
  const showLikedSection = activeCategory === "All" || activeCategory === "Liked Songs";
  const showHistorySection = activeCategory === "All" || activeCategory === "History";
  const showPlaylistSection = activeCategory === "All" || activeCategory === "Playlists";

  const renderSongRow = (
    song,
    queue,
    {
      chipIcon = <FaMusic />,
      chipText = "Song",
      offline = false,
      removable = false,
    } = {}
  ) => (
    <div
      key={getSongId(song)}
      className="boom-song-row"
      role="button"
      tabIndex={0}
      onClick={() => handlePlaySong(song, queue)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handlePlaySong(song, queue);
        }
      }}
    >
      <span className="boom-cover">
        <img
          src={getSongImage(song)}
          alt={getSongTitle(song)}
          onError={(event) => {
            event.currentTarget.src = FALLBACK_COVER;
          }}
        />
        {offline && (
          <span className="boom-offline-dot" title="Saved offline">
            <FaCheckCircle />
          </span>
        )}
      </span>

      <span className="boom-song-main">
        <h3>{getSongTitle(song)}</h3>
        <p>
          {getArtistName(song)}
          {getAlbumTitle(song) ? ` • ${getAlbumTitle(song)}` : ""}
        </p>
      </span>

      <span className="boom-song-chip">
        {chipIcon}
        {chipText}
      </span>

      {removable ? (
        <button
          type="button"
          className="boom-delete-btn"
          title="Remove offline"
          onClick={(event) => {
            event.stopPropagation();
            handleRemoveOfflineSong(song);
          }}
        >
          <FaTrash />
        </button>
      ) : (
        <span className="boom-play-btn">
          <FaPlay />
        </span>
      )}
    </div>
  );

  return (
    <main className="boom-library-page">
      <style>{libraryPageStyles}</style>

      <div className="boom-library-shell">
        <section className="boom-hero" aria-label="Music library overview">
          <div className="boom-hero-top">
            <div>
              <p className="boom-kicker">
                <FaWifi />
                App Offline Music
              </p>

              <h1>Your Library</h1>

              <p>
                Play your saved offline songs inside the app, browse liked songs,
                open playlists, and jump back into recent music.
              </p>
            </div>

            <div className="boom-hero-disc" aria-hidden="true">
              <FaCompactDisc />
            </div>
          </div>

          <div className="boom-hero-actions">
            <button
              type="button"
              className="boom-primary-action"
              disabled={!filteredOfflineSongs.length}
              onClick={playAllOffline}
            >
              <FaPlay />
              Play Offline
            </button>

            <Link to="/dj" className="boom-secondary-action">
              <FaHeadphones />
              DJ Essentials
            </Link>

            <Link to="/studio" className="boom-secondary-action">
              <FaMusic />
              Studio
            </Link>
          </div>
        </section>

        <section className="boom-stats" aria-label="Library stats">
          <div className="boom-stat-card">
            <span>Offline</span>
            <strong>{offlineSongs.length}</strong>
          </div>

          <div className="boom-stat-card">
            <span>Liked</span>
            <strong>{likedSongs.length}</strong>
          </div>

          <div className="boom-stat-card">
            <span>Recent</span>
            <strong>{normalizedHistorySongs.length}</strong>
          </div>

          <div className="boom-stat-card">
            <span>Playlists</span>
            <strong>{playlists?.length || 0}</strong>
          </div>
        </section>

        <label className="boom-search">
          <FaSearch />
          <input
            type="text"
            placeholder="Search offline songs, artists, playlists..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>

        <nav className="boom-tabs" aria-label="Library categories">
          {sections.map((section) => (
            <button
              type="button"
              key={section.id}
              className={`boom-tab ${activeCategory === section.id ? "active" : ""}`}
              onClick={() => setActiveCategory(section.id)}
            >
              {section.icon}
              {section.label}
              <span>{section.count}</span>
            </button>
          ))}
        </nav>

        {error && <div className="boom-error">{error}</div>}

        {!token && (
          <section className="boom-login-box">
            <h3>Sign in to unlock your full library</h3>
            <p>
              Offline songs saved on this browser still show here. Sign in to
              sync liked songs, playlists, and listening history.
            </p>
          </section>
        )}

        {showOfflineSection && (
          <section className="boom-section">
            <div className="boom-section-head">
              <div className="boom-section-title">
                <FaDownload />
                <div>
                  <h2>Offline Songs</h2>
                  <p>Saved inside the app cache for playback in this app.</p>
                </div>
              </div>

              <span className="boom-count-badge">{filteredOfflineSongs.length} saved</span>
            </div>

            {loadingOffline ? (
              <div className="boom-empty">Checking saved offline songs...</div>
            ) : filteredOfflineSongs.length === 0 ? (
              <div className="boom-empty">
                <h3>No offline songs yet</h3>
                <p>
                  Open a song and tap Save Offline. It will appear here without
                  being saved into the user's Downloads folder.
                </p>
              </div>
            ) : (
              <div className="boom-list">
                {filteredOfflineSongs.map((song) =>
                  renderSongRow(song, filteredOfflineSongs, {
                    chipIcon: <FaCheckCircle />,
                    chipText: formatTime(song.duration),
                    offline: true,
                    removable: true,
                  })
                )}
              </div>
            )}
          </section>
        )}

        {showHistorySection && (
          <section className="boom-section">
            <div className="boom-section-head">
              <div className="boom-section-title">
                <FaHistory />
                <div>
                  <h2>Recently Played</h2>
                  <p>Your listening history from the app.</p>
                </div>
              </div>

              <span className="boom-count-badge">{filteredHistorySongs.length} recent</span>
            </div>

            {loadingHistory ? (
              <div className="boom-empty">Loading your recent songs...</div>
            ) : filteredHistorySongs.length === 0 ? (
              <div className="boom-empty">No recently played songs yet.</div>
            ) : (
              <div className="boom-list">
                {filteredHistorySongs
                  .slice(0, 12)
                  .map((song) =>
                    renderSongRow(song, filteredHistorySongs, {
                      chipIcon: <FaClock />,
                      chipText: "Recent",
                    })
                  )}
              </div>
            )}
          </section>
        )}

        {showLikedSection && (
          <section className="boom-section">
            <div className="boom-section-head">
              <div className="boom-section-title">
                <FaHeart />
                <div>
                  <h2>Liked Songs</h2>
                  <p>Songs you have liked.</p>
                </div>
              </div>

              <span className="boom-count-badge">{filteredLikedSongs.length} liked</span>
            </div>

            {loadingLikes ? (
              <div className="boom-empty">Loading your liked songs...</div>
            ) : filteredLikedSongs.length === 0 ? (
              <div className="boom-empty">You have not liked any songs yet.</div>
            ) : (
              <div className="boom-list">
                {filteredLikedSongs
                  .slice(0, 12)
                  .map((song) =>
                    renderSongRow(song, filteredLikedSongs, {
                      chipIcon: <FaHeart />,
                      chipText: "Liked",
                    })
                  )}
              </div>
            )}
          </section>
        )}

        {showPlaylistSection && (
          <section className="boom-section">
            <div className="boom-section-head">
              <div className="boom-section-title">
                <FaListUl />
                <div>
                  <h2>Your Playlists</h2>
                  <p>Open your saved playlists.</p>
                </div>
              </div>

              <span className="boom-count-badge">{filteredPlaylists.length} playlists</span>
            </div>

            {filteredPlaylists.length === 0 ? (
              <div className="boom-empty">No playlists created yet.</div>
            ) : (
              <div className="boom-list">
                {filteredPlaylists.map((playlist) => (
                  <Link
                    key={playlist._id}
                    to={`/playlist/${playlist._id}`}
                    className="boom-playlist-row"
                  >
                    <span className="boom-cover">
                      <img
                        src={
                          playlist.coverImage ||
                          playlist.image ||
                          playlist.songs?.[0]?.imageUrl ||
                          playlist.songs?.[0]?.image ||
                          PLAYLIST_COVER
                        }
                        alt={playlist.name || playlist.title || "Playlist"}
                        onError={(event) => {
                          event.currentTarget.src = PLAYLIST_COVER;
                        }}
                      />
                    </span>

                    <span className="boom-song-main">
                      <h3>{playlist.name || playlist.title || "Untitled Playlist"}</h3>
                      <p>{playlist.songs?.length || playlist.tracks?.length || 0} songs</p>
                    </span>

                    <span className="boom-song-chip">
                      <FaListUl />
                      Open
                    </span>

                    <span className="boom-play-btn">
                      <FaArrowRight />
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="boom-dj-banner">
          <div>
            <h2>
              <FaHeadphones />
              DJ Essentials
            </h2>

            <p>
              Load your own songs, mix with two decks, scratch, trigger sound pads,
              and create your own DJ vibe.
            </p>
          </div>

          <Link to="/dj">
            <button type="button" className="boom-primary-action">
              Open DJ Studio
              <FaArrowRight />
            </button>
          </Link>
        </section>
      </div>
    </main>
  );
};

export default Library;
