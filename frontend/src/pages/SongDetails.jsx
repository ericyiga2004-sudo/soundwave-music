import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaPlay,
  FaPause,
  FaStepBackward,
  FaStepForward,
  FaRandom,
  FaRedoAlt,
  FaVolumeUp,
  FaVolumeMute,
  FaHeart,
  FaRegHeart,
  FaDownload,
  FaShareAlt,
  FaListUl,
  FaPlus,
  FaTimes,
  FaCheck,
  FaMusic,
} from "react-icons/fa";
import { MdRepeatOne } from "react-icons/md";

import "./CSS/SongDetails.css";
import { MusicContext } from "../context/ShopContext";
import { MusicPlayerContext } from "../context/MainPlayerContext";

const PLAYER_STORAGE_KEY = "music_app_last_song_session";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const safeJsonParse = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const formatTime = (seconds = 0) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const formatDate = (date) => {
  if (!date) return "Unknown";

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "Unknown";

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const getArtistName = (song) =>
  song?.artist?.name || song?.artistName || song?.artist || "Unknown Artist";

const getAlbumTitle = (song) =>
  song?.album?.title || song?.albumTitle || song?.album || "Unknown Album";

const getDuration = (song, playerDuration) =>
  Number(song?.duration) > 0 ? Number(song.duration) : Number(playerDuration) || 0;

const repeatLabel = (repeat) => {
  if (repeat === "one" || repeat === 1) return "Repeat one";
  if (repeat === "all" || repeat === true) return "Repeat all";
  return "Repeat off";
};

const parseLrcTimestamp = (timestamp) => {
  const match = timestamp.match(/^(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?$/);
  if (!match) return null;

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const fractionRaw = match[3] || "0";

  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;

  const fraction =
    fractionRaw.length === 1
      ? Number(fractionRaw) / 10
      : fractionRaw.length === 2
      ? Number(fractionRaw) / 100
      : Number(fractionRaw) / 1000;

  return minutes * 60 + seconds + fraction;
};

const parseLrcLyrics = (lrcLyrics = "") => {
  if (typeof lrcLyrics !== "string" || !lrcLyrics.trim()) return [];

  const metadataTags = new Set([
    "ar",
    "al",
    "ti",
    "au",
    "by",
    "offset",
    "length",
    "re",
    "ve",
  ]);

  const parsedLines = [];

  lrcLyrics.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;

    const tagMatches = [...line.matchAll(/\[([^\]]+)\]/g)];
    if (!tagMatches.length) return;

    const text = line.replace(/\[[^\]]+\]/g, "").trim();

    tagMatches.forEach((tagMatch) => {
      const rawTag = tagMatch[1].trim();
      const lowerTag = rawTag.toLowerCase();

      if (metadataTags.has(lowerTag.split(":")[0])) return;

      const start = parseLrcTimestamp(rawTag);
      if (start === null) return;

      parsedLines.push({
        text: text || "♪",
        start,
        end: null,
        words: [],
      });
    });
  });

  return parsedLines
    .sort((a, b) => a.start - b.start)
    .map((line, index, lines) => {
      const nextLine = lines[index + 1];

      return {
        ...line,
        end: nextLine ? Math.max(nextLine.start - 0.01, line.start + 0.01) : null,
      };
    });
};

const normalizeSyncedLyrics = (lyrics = []) => {
  if (!Array.isArray(lyrics)) return [];

  return lyrics
    .filter((line) => line?.text && Number.isFinite(Number(line.start)))
    .map((line) => ({
      text: String(line.text),
      start: Number(line.start),
      end: Number.isFinite(Number(line.end)) ? Number(line.end) : null,
      words: Array.isArray(line.words)
        ? line.words
            .filter((word) => word?.text && Number.isFinite(Number(word.start)))
            .map((word) => ({
              text: String(word.text),
              start: Number(word.start),
              end: Number.isFinite(Number(word.end)) ? Number(word.end) : null,
            }))
        : [],
    }))
    .sort((a, b) => a.start - b.start)
    .map((line, index, lines) => {
      const nextLine = lines[index + 1];

      return {
        ...line,
        end:
          Number(line.end) > line.start
            ? Number(line.end)
            : nextLine
            ? Math.max(nextLine.start - 0.01, line.start + 0.01)
            : null,
      };
    });
};

const SongDetails = () => {
  const { songs = [], backendUrl, token } = useContext(MusicContext);

  const {
    currentSong,
    playlist = [],
    currentIndex = 0,
    isPlaying,
    progress = 0,
    duration = 0,
    playSong,
    pauseSong,
    resumeSong,
    togglePlay,
    nextSong,
    prevSong,
    seekTo,
    shuffle,
    setShuffle,
    repeat,
    setRepeat,
    cycleRepeat,
    audioRef,
  } = useContext(MusicPlayerContext);

  const [liveProgress, setLiveProgress] = useState(Number(progress) || 0);
  const [restoredSongPreview, setRestoredSongPreview] = useState(null);
  const [restoreAttempted, setRestoreAttempted] = useState(false);

  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [likeLoading, setLikeLoading] = useState(false);

  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const lastVolumeRef = useRef(1);

  const [playlistModalOpen, setPlaylistModalOpen] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
  const [playlistStatus, setPlaylistStatus] = useState("");

  const [queueOpen, setQueueOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState("");

  const lyricsContainerRef = useRef(null);
  const lyricRefs = useRef({});
  const animationFrameRef = useRef(null);
  const lastSessionRef = useRef(null);

  const activeSong = currentSong || restoredSongPreview;

  const totalDuration = useMemo(
    () => getDuration(activeSong, duration),
    [activeSong, duration]
  );

  const displayProgress = useMemo(() => {
    const audioTime = Number(liveProgress);
    const contextTime = Number(progress);

    if (Number.isFinite(audioTime)) return audioTime;
    if (Number.isFinite(contextTime)) return contextTime;

    return 0;
  }, [liveProgress, progress]);

  const recommendedSongs = useMemo(() => {
    if (!Array.isArray(songs)) return [];

    return songs
      .filter((song) => song?._id && song._id !== activeSong?._id)
      .slice(0, 12);
  }, [songs, activeSong?._id]);

  const syncedLyrics = useMemo(() => {
    const lrcLines = parseLrcLyrics(activeSong?.lrcLyrics);

    if (lrcLines.length) return lrcLines;

    const syncedLines = normalizeSyncedLyrics(activeSong?.syncedLyrics);

    if (syncedLines.length) return syncedLines;

    if (typeof activeSong?.lyrics === "string" && activeSong.lyrics.trim()) {
      return activeSong.lyrics
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line, index) => ({
          text: line.trim(),
          start: index * 5,
          end: index * 5 + 4.99,
          words: [],
        }));
    }

    return [];
  }, [activeSong?.lrcLyrics, activeSong?.syncedLyrics, activeSong?.lyrics]);

  const activeLyricIndex = useMemo(() => {
    if (!syncedLyrics.length) return -1;

    const currentTime = Number(displayProgress) || 0;

    const exactIndex = syncedLyrics.findIndex((line, index) => {
      const nextLine = syncedLyrics[index + 1];
      const start = Number(line.start) || 0;
      const end =
        Number(line.end) > start
          ? Number(line.end)
          : Number(nextLine?.start) > start
          ? Number(nextLine.start)
          : Number.MAX_SAFE_INTEGER;

      return currentTime >= start && currentTime < end;
    });

    if (exactIndex !== -1) return exactIndex;

    return syncedLyrics.findLastIndex(
      (line) => currentTime >= (Number(line.start) || 0)
    );
  }, [displayProgress, syncedLyrics]);

  const currentLyric = activeLyricIndex >= 0 ? syncedLyrics[activeLyricIndex] : null;

  const activeWordIndex = useMemo(() => {
    if (!currentLyric?.words?.length) return -1;

    const currentTime = Number(displayProgress) || 0;

    return currentLyric.words.findIndex((word, index) => {
      const nextWord = currentLyric.words[index + 1];
      const start = Number(word.start) || 0;
      const end =
        Number(word.end) > start
          ? Number(word.end)
          : Number(nextWord?.start) > start
          ? Number(nextWord.start)
          : start + 0.35;

      return currentTime >= start && currentTime < end;
    });
  }, [currentLyric, displayProgress]);

  const buildSessionPayload = useCallback(() => {
    if (!activeSong?._id) return null;

    const queueSource = playlist.length ? playlist : songs;
    const queueIds = Array.isArray(queueSource)
      ? queueSource.map((song) => song?._id).filter(Boolean)
      : [];

    return {
      songId: activeSong._id,
      position: Number(displayProgress) || 0,
      duration: Number(totalDuration) || 0,
      wasPlaying: Boolean(isPlaying),
      currentIndex: Number(currentIndex) || 0,
      playlistIds: queueIds,
      savedAt: Date.now(),
    };
  }, [
    activeSong?._id,
    playlist,
    songs,
    displayProgress,
    totalDuration,
    isPlaying,
    currentIndex,
  ]);

  const saveCurrentSession = useCallback(() => {
    const payload = buildSessionPayload();
    if (!payload) return;

    lastSessionRef.current = payload;
    localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(payload));
  }, [buildSessionPayload]);

  useEffect(() => {
    const payload = buildSessionPayload();
    if (payload) {
      lastSessionRef.current = payload;
    }
  }, [buildSessionPayload]);

  useEffect(() => {
    if (!activeSong?._id) return;

    saveCurrentSession();

    const intervalId = window.setInterval(() => {
      saveCurrentSession();
    }, 1000);

    const handleBeforeUnload = () => {
      const payload = lastSessionRef.current || buildSessionPayload();

      if (payload) {
        localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(payload));
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.clearInterval(intervalId);
      handleBeforeUnload();
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [activeSong?._id, saveCurrentSession, buildSessionPayload]);

  useEffect(() => {
    if (currentSong?._id) {
      setRestoredSongPreview(null);
      setRestoreAttempted(true);
      return;
    }

    if (restoreAttempted) return;
    if (!Array.isArray(songs) || !songs.length) return;

    const savedSession = safeJsonParse(localStorage.getItem(PLAYER_STORAGE_KEY));

    if (!savedSession?.songId) {
      setRestoreAttempted(true);
      return;
    }

    const songToRestore = songs.find((song) => song?._id === savedSession.songId);

    if (!songToRestore) {
      setRestoreAttempted(true);
      return;
    }

    const savedQueue =
      Array.isArray(savedSession.playlistIds) && savedSession.playlistIds.length
        ? savedSession.playlistIds
            .map((id) => songs.find((song) => song?._id === id))
            .filter(Boolean)
        : songs;

    const queueToRestore = savedQueue.length ? savedQueue : songs;
    const savedPosition = Number(savedSession.position) || 0;

    setRestoredSongPreview(songToRestore);
    setLiveProgress(savedPosition);
    setRestoreAttempted(true);

    Promise.resolve().then(() => {
      playSong?.(songToRestore, queueToRestore);

      window.setTimeout(() => {
        if (savedPosition > 0) {
          seekTo?.(savedPosition);
          setLiveProgress(savedPosition);
        }

        if (savedSession.wasPlaying) {
          resumeSong?.();
        } else {
          pauseSong?.();
        }
      }, 250);
    });
  }, [
    currentSong?._id,
    restoreAttempted,
    songs,
    playSong,
    seekTo,
    resumeSong,
    pauseSong,
  ]);

  useEffect(() => {
    setLiveProgress(Number(progress) || 0);
  }, [progress, activeSong?._id]);

  useEffect(() => {
    const audio = audioRef?.current;

    const syncFromAudio = () => {
      const currentTime = Number(audio?.currentTime);

      if (Number.isFinite(currentTime)) {
        setLiveProgress(currentTime);
      }

      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(syncFromAudio);
      }
    };

    if (isPlaying && audio) {
      animationFrameRef.current = requestAnimationFrame(syncFromAudio);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [audioRef, isPlaying, activeSong?._id]);

  useEffect(() => {
    const audio = audioRef?.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setLiveProgress(Number(audio.currentTime) || 0);
    };

    const handleSeeked = () => {
      setLiveProgress(Number(audio.currentTime) || 0);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("seeked", handleSeeked);
    audio.addEventListener("loadedmetadata", handleTimeUpdate);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("seeked", handleSeeked);
      audio.removeEventListener("loadedmetadata", handleTimeUpdate);
    };
  }, [audioRef, activeSong?._id]);

  useEffect(() => {
    setLikesCount(Number(activeSong?.likes) || 0);
    setLiked(false);
    setPlaylistStatus("");
    setSelectedPlaylistId("");
  }, [activeSong?._id, activeSong?.likes]);

  useEffect(() => {
    const checkLikeStatus = async () => {
      if (!backendUrl || !token || !activeSong?._id) return;

      try {
        const res = await axios.get(
          `${backendUrl}/api/likes/check/${activeSong._id}`,
          {
            headers: { token },
          }
        );

        if (res.data?.success) {
          setLiked(Boolean(res.data.liked));
        }
      } catch (error) {
        console.error("Failed to check like status:", error);
      }
    };

    checkLikeStatus();
  }, [backendUrl, token, activeSong?._id]);

  useEffect(() => {
    const container = lyricsContainerRef.current;
    const activeNode = lyricRefs.current[activeLyricIndex];

    if (!container || !activeNode || activeLyricIndex < 0) return;

    const containerHeight = container.clientHeight;
    const activeOffsetTop = activeNode.offsetTop;
    const activeHeight = activeNode.offsetHeight;

    const targetScrollTop =
      activeOffsetTop - containerHeight / 2 + activeHeight / 2;

    container.scrollTo({
      top: Math.max(0, targetScrollTop),
      behavior: "smooth",
    });
  }, [activeLyricIndex]);

  useEffect(() => {
    const audio = audioRef?.current;
    if (!audio) return;

    audio.volume = muted ? 0 : volume;
    audio.muted = muted;
  }, [audioRef, muted, volume]);

  const fetchPlaylists = useCallback(async () => {
    if (!backendUrl || !token) {
      setPlaylists([]);
      return;
    }

    try {
      setPlaylistLoading(true);
      const res = await axios.get(`${backendUrl}/api/playlist/get`, {
        headers: { token },
      });

      if (res.data?.success) {
        setPlaylists(res.data.playlists || []);
      }
    } catch (error) {
      console.error("Failed to fetch playlists:", error);
      setPlaylistStatus("Could not load playlists.");
    } finally {
      setPlaylistLoading(false);
    }
  }, [backendUrl, token]);

  const openPlaylistModal = async () => {
    setPlaylistModalOpen(true);
    setPlaylistStatus("");
    await fetchPlaylists();
  };

  const handleToggleLike = async () => {
    if (!backendUrl || !token || !activeSong?._id || likeLoading) return;

    const previousLiked = liked;
    const previousCount = likesCount;

    try {
      setLikeLoading(true);

      setLiked(!previousLiked);
      setLikesCount((count) => Math.max(0, count + (previousLiked ? -1 : 1)));

      const res = await axios.post(
        `${backendUrl}/api/likes/toggle/${activeSong._id}`,
        {},
        {
          headers: { token },
        }
      );

      if (res.data?.success) {
        setLiked(Boolean(res.data.liked));
        setLikesCount(Number(res.data.likes) || 0);
      } else {
        setLiked(previousLiked);
        setLikesCount(previousCount);
      }
    } catch (error) {
      console.error("Failed to toggle like:", error);
      setLiked(previousLiked);
      setLikesCount(previousCount);
    } finally {
      setLikeLoading(false);
    }
  };

  const handleSeek = (event) => {
    const value = Number(event.target.value);
    const safeValue = clamp(value, 0, totalDuration || value);

    setLiveProgress(safeValue);
    seekTo?.(safeValue);

    window.setTimeout(saveCurrentSession, 0);
  };

  const handleLyricClick = (start) => {
    const timestamp = Number(start) || 0;

    setLiveProgress(timestamp);
    seekTo?.(timestamp);

    if (!isPlaying) {
      resumeSong?.();
    }

    window.setTimeout(saveCurrentSession, 0);
  };

  const handleVolumeChange = (event) => {
    const nextVolume = clamp(Number(event.target.value), 0, 1);

    setVolume(nextVolume);
    setMuted(nextVolume === 0);

    if (nextVolume > 0) {
      lastVolumeRef.current = nextVolume;
    }
  };

  const handleMute = () => {
    if (muted || volume === 0) {
      const restoredVolume = lastVolumeRef.current || 0.8;
      setVolume(restoredVolume);
      setMuted(false);
      return;
    }

    lastVolumeRef.current = volume;
    setMuted(true);
  };

  const handleShuffle = () => {
    setShuffle?.(!shuffle);
  };

  const handleRepeat = () => {
    if (typeof cycleRepeat === "function") {
      cycleRepeat();
      return;
    }

    if (typeof setRepeat === "function") {
      if (repeat === "off" || repeat === false) setRepeat("all");
      else if (repeat === "all" || repeat === true) setRepeat("one");
      else setRepeat("off");
    }
  };

  const handlePlayPause = () => {
    if (typeof togglePlay === "function") {
      togglePlay();
    } else if (isPlaying) {
      pauseSong?.();
    } else {
      resumeSong?.();
    }

    window.setTimeout(saveCurrentSession, 0);
  };

  const handleDownload = () => {
    if (!activeSong?.audioUrl) return;

    const link = document.createElement("a");
    link.href = activeSong.audioUrl;
    link.download = `${activeSong.title || "song"}.mp3`;
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = async () => {
    if (!activeSong) return;

    const shareData = {
      title: activeSong.title,
      text: `Listen to ${activeSong.title} by ${getArtistName(activeSong)}`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setShareStatus("Shared");
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setShareStatus("Link copied");
      }

      window.setTimeout(() => setShareStatus(""), 1800);
    } catch (error) {
      console.error("Share failed:", error);
      setShareStatus("");
    }
  };

  const handlePlayRecommended = (song) => {
    setRestoredSongPreview(null);
    playSong?.(song, songs);

    const payload = {
      songId: song?._id,
      position: 0,
      duration: Number(song?.duration) || 0,
      wasPlaying: true,
      currentIndex: songs.findIndex((item) => item?._id === song?._id),
      playlistIds: songs.map((item) => item?._id).filter(Boolean),
      savedAt: Date.now(),
    };

    localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(payload));
  };

  const handlePlaylistSelect = async (playlistId) => {
    setSelectedPlaylistId(playlistId);

    const selected = playlists.find((playlist) => playlist._id === playlistId);
    const playlistName = selected?.name || selected?.title || "playlist";

    setPlaylistStatus(`Selected ${playlistName}`);
  };

  const renderRepeatIcon = () => {
    if (repeat === "one" || repeat === 1) return <MdRepeatOne />;
    return <FaRedoAlt />;
  };

  if (!activeSong) {
    return (
      <main className="song-details song-details-empty">
        <motion.section
          className="empty-player-card"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <FaMusic className="empty-player-icon" aria-hidden="true" />
          <h1>
            {restoreAttempted ? "No song selected" : "Restoring your last song…"}
          </h1>
          <p>
            {restoreAttempted
              ? "Choose a song to open the now-playing experience."
              : "Loading the track you were listening to."}
          </p>
        </motion.section>
      </main>
    );
  }

  return (
    <main className="song-details" aria-label="Song details and player">
      <div className="song-details-bg" aria-hidden="true">
        <img src={activeSong.imageUrl} alt="" />
      </div>

      <motion.section
        className="song-details-layout row g-3 g-xl-4 align-items-stretch"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.45 }}
      >
        <motion.aside
          className="col-12 col-md-2 order-1 song-panel song-panel-left glass-card"
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45 }}
          aria-label="Current song information"
        >
          <motion.div
            className={`cover-shell ${isPlaying ? "is-playing" : ""}`}
            animate={{ y: isPlaying ? [0, -7, 0] : 0 }}
            transition={{
              duration: 4,
              repeat: isPlaying ? Infinity : 0,
              ease: "easeInOut",
            }}
          >
            <img
              className="song-cover"
              src={activeSong.imageUrl}
              alt={`${activeSong.title} album cover`}
            />
          </motion.div>

          <div className="song-title-block">
            <p className="eyebrow">Now Playing</p>
            <h1>{activeSong.title}</h1>
            <p>{getArtistName(activeSong)}</p>
          </div>

          <div className="visualizer" aria-hidden="true">
            {Array.from({ length: 16 }).map((_, index) => (
              <span
                key={index}
                className={isPlaying ? "bar playing" : "bar"}
                style={{
                  "--delay": `${index * 0.07}s`,
                  "--height": `${18 + ((index * 17) % 48)}px`,
                }}
              />
            ))}
          </div>

          <section className="song-info-panel" aria-label="Song metadata">
            <h2>Song Info</h2>

            <dl>
              <div>
                <dt>Artist</dt>
                <dd>{getArtistName(activeSong)}</dd>
              </div>

              <div>
                <dt>Album</dt>
                <dd>{getAlbumTitle(activeSong)}</dd>
              </div>

              <div>
                <dt>Genre</dt>
                <dd>{activeSong.genre || "Unknown"}</dd>
              </div>

              <div>
                <dt>Release Date</dt>
                <dd>{formatDate(activeSong.releaseDate)}</dd>
              </div>

              <div>
                <dt>Release Year</dt>
                <dd>{activeSong.releaseYear || "Unknown"}</dd>
              </div>

              <div>
                <dt>Plays</dt>
                <dd>{Number(activeSong.plays || 0).toLocaleString()}</dd>
              </div>

              <div>
                <dt>Likes</dt>
                <dd>{likesCount.toLocaleString()}</dd>
              </div>

              <div>
                <dt>Duration</dt>
                <dd>{formatTime(totalDuration)}</dd>
              </div>

              <div>
                <dt>Audio Quality</dt>
                <dd>High Quality</dd>
              </div>
            </dl>
          </section>
        </motion.aside>

        <motion.section
          className="col-12 col-md-8 order-2 lyrics-panel glass-card"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          aria-label="Synchronized lyrics"
        >
          <div className="lyrics-header">
            <div>
              <p className="eyebrow">Live Lyrics</p>
              <h2>Karaoke Mode</h2>
            </div>

            <span className="lyrics-time">{formatTime(displayProgress)}</span>
          </div>

          <div
            className="lyrics-scroll"
            ref={lyricsContainerRef}
            tabIndex={0}
            aria-live="polite"
          >
            {syncedLyrics.length ? (
              syncedLyrics.map((line, index) => {
                const isActive = index === activeLyricIndex;
                const isPast = index < activeLyricIndex;
                const isUpcoming = index > activeLyricIndex;

                return (
                  <motion.button
                    key={`${line.start}-${line.text}-${index}`}
                    ref={(node) => {
                      lyricRefs.current[index] = node;
                    }}
                    type="button"
                    className={[
                      "lyric-line",
                      isActive ? "active" : "",
                      isPast ? "past" : "",
                      isUpcoming ? "upcoming" : "",
                    ].join(" ")}
                    onClick={() => handleLyricClick(line.start)}
                    aria-label={`Jump to lyric at ${formatTime(line.start)}: ${
                      line.text
                    }`}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{
                      opacity: isActive ? 1 : isPast ? 0.36 : 0.72,
                      y: 0,
                      scale: isActive ? 1.025 : 1,
                    }}
                    transition={{ duration: 0.22 }}
                    whileHover={{ scale: isActive ? 1.025 : 1.01 }}
                    whileTap={{ scale: 0.985 }}
                  >
                    {isActive && Array.isArray(line.words) && line.words.length ? (
                      <span className="lyric-words">
                        {line.words.map((word, wordIndex) => (
                          <span
                            key={`${word.text}-${word.start}-${wordIndex}`}
                            className={
                              wordIndex <= activeWordIndex
                                ? "lyric-word sung"
                                : "lyric-word"
                            }
                          >
                            {word.text}
                            {wordIndex < line.words.length - 1 ? " " : ""}
                          </span>
                        ))}
                      </span>
                    ) : (
                      line.text
                    )}
                  </motion.button>
                );
              })
            ) : (
              <div className="no-lyrics">
                <FaMusic aria-hidden="true" />
                <h3>No synchronized lyrics available</h3>
                <p>This song does not include LRC lyrics yet.</p>
              </div>
            )}
          </div>
        </motion.section>

        <motion.aside
          className="col-12 col-md-2 order-3 song-panel song-panel-right glass-card"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45 }}
          aria-label="Recommended songs"
        >
          <div className="recommendations-header">
            <div>
              <p className="eyebrow">Up Next</p>
              <h2>Recommended</h2>
            </div>

            <button
              type="button"
              className="icon-button"
              onClick={() => setQueueOpen(true)}
              aria-label="Open queue"
            >
              <FaListUl />
            </button>
          </div>

          <div className="recommended-list">
            {recommendedSongs.map((song) => (
              <motion.button
                key={song._id}
                type="button"
                className="recommended-song"
                onClick={() => handlePlayRecommended(song)}
                whileHover={{ scale: 1.015, x: 3 }}
                whileTap={{ scale: 0.985 }}
                aria-label={`Play ${song.title} by ${getArtistName(song)}`}
              >
                <img src={song.imageUrl} alt="" />
                <span>
                  <strong>{song.title}</strong>
                  <small>{getArtistName(song)}</small>
                </span>
                <em>{formatTime(song.duration)}</em>
              </motion.button>
            ))}
          </div>
        </motion.aside>
      </motion.section>

      <motion.section
  className="player-dock glass-card"
  initial={{ opacity: 0, y: 36 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.1, duration: 0.42 }}
  aria-label="Music player controls"
>
  <div className="container-fluid p-0">
    <div className="row g-2 g-md-3 align-items-center">
      <div className="col-12 col-lg-3">
        <div className="dock-song">
          <img src={activeSong.imageUrl} alt="" />

          <span>
            <strong>{activeSong.title}</strong>
            <small>{getArtistName(activeSong)}</small>
          </span>
        </div>
      </div>

      <div className="col-12 col-lg-6">
        <div className="dock-main">
          <div className="control-row">
            <motion.button
              type="button"
              className={`icon-button ${shuffle ? "active" : ""}`}
              onClick={handleShuffle}
              whileTap={{ scale: 0.9 }}
              aria-label={shuffle ? "Turn shuffle off" : "Turn shuffle on"}
              aria-pressed={Boolean(shuffle)}
            >
              <FaRandom />
            </motion.button>

            <motion.button
              type="button"
              className="icon-button"
              onClick={prevSong}
              whileTap={{ scale: 0.9 }}
              aria-label="Previous song"
            >
              <FaStepBackward />
            </motion.button>

            <motion.button
              type="button"
              className="play-button"
              onClick={handlePlayPause}
              whileHover={{ scale: 1.045 }}
              whileTap={{ scale: 0.94 }}
              aria-label={isPlaying ? "Pause song" : "Play song"}
            >
              {isPlaying ? <FaPause /> : <FaPlay />}
            </motion.button>

            <motion.button
              type="button"
              className="icon-button"
              onClick={nextSong}
              whileTap={{ scale: 0.9 }}
              aria-label="Next song"
            >
              <FaStepForward />
            </motion.button>

            <motion.button
              type="button"
              className={`icon-button ${
                repeat === "one" ||
                repeat === "all" ||
                repeat === true ||
                repeat === 1
                  ? "active"
                  : ""
              }`}
              onClick={handleRepeat}
              whileTap={{ scale: 0.9 }}
              aria-label={repeatLabel(repeat)}
              aria-pressed={
                repeat === "one" ||
                repeat === "all" ||
                repeat === true ||
                repeat === 1
              }
            >
              {renderRepeatIcon()}
            </motion.button>
          </div>

          <div className="progress-row">
            <time>{formatTime(displayProgress)}</time>

            <input
              className="progress-slider"
              type="range"
              min="0"
              max={totalDuration || 0}
              step="0.01"
              value={clamp(Number(displayProgress) || 0, 0, totalDuration || 0)}
              onChange={handleSeek}
              aria-label="Song progress"
              style={{
                "--progress-percent": `${
                  totalDuration ? (displayProgress / totalDuration) * 100 : 0
                }%`,
              }}
            />

            <time>{formatTime(totalDuration)}</time>
          </div>
        </div>
      </div>

      <div className="col-12 col-lg-3">
        <div className="dock-actions">
          <div className="dock-actions-buttons">
            <motion.button
              type="button"
              className={`icon-button favorite-button ${liked ? "liked" : ""}`}
              onClick={handleToggleLike}
              disabled={!token || likeLoading}
              whileTap={{ scale: 0.9 }}
              aria-label={liked ? "Unlike song" : "Like song"}
              aria-pressed={liked}
            >
              {liked ? <FaHeart /> : <FaRegHeart />}
            </motion.button>

            <motion.button
              type="button"
              className="icon-button"
              onClick={openPlaylistModal}
              whileTap={{ scale: 0.9 }}
              aria-label="Add to playlist"
            >
              <FaPlus />
            </motion.button>

            <motion.button
              type="button"
              className="icon-button"
              onClick={handleDownload}
              whileTap={{ scale: 0.9 }}
              aria-label="Download song"
            >
              <FaDownload />
            </motion.button>

            <div className="share-wrap">
              <motion.button
                type="button"
                className="icon-button"
                onClick={handleShare}
                whileTap={{ scale: 0.9 }}
                aria-label="Share song"
              >
                <FaShareAlt />
              </motion.button>

              <AnimatePresence>
                {shareStatus && (
                  <motion.span
                    className="mini-status"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                  >
                    {shareStatus}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className=" d-flex align-items-center justify-content-center mx-auto">
            <button
              type="button"
              className="icon-button"
              onClick={handleMute}
              aria-label={muted || volume === 0 ? "Unmute" : "Mute"}
            >
              {muted || volume === 0 ? <FaVolumeMute /> : <FaVolumeUp />}
            </button>

            
          </div>
        </div>
      </div>
    </div>
  </div>
</motion.section>

      <AnimatePresence>
        {playlistModalOpen && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="presentation"
            onClick={() => setPlaylistModalOpen(false)}
          >
            <motion.section
              className="modal-card glass-card"
              initial={{ opacity: 0, y: 28, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.96 }}
              transition={{ duration: 0.22 }}
              role="dialog"
              aria-modal="true"
              aria-label="Add to playlist"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal-header">
                <div>
                  <p className="eyebrow">Library</p>
                  <h2>Add to playlist</h2>
                </div>

                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setPlaylistModalOpen(false)}
                  aria-label="Close playlist modal"
                >
                  <FaTimes />
                </button>
              </div>

              {playlistLoading ? (
                <div className="modal-empty">
                  <p>Loading playlists…</p>
                </div>
              ) : playlists.length ? (
                <div className="playlist-options">
                  {playlists.map((playlist) => (
                    <button
                      key={playlist._id}
                      type="button"
                      className={`playlist-option ${
                        selectedPlaylistId === playlist._id ? "selected" : ""
                      }`}
                      onClick={() => handlePlaylistSelect(playlist._id)}
                    >
                      <span>
                        <strong>{playlist.name || playlist.title}</strong>
                        <small>
                          {playlist.songs?.length || playlist.tracks?.length || 0} songs
                        </small>
                      </span>

                      {selectedPlaylistId === playlist._id && <FaCheck />}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="modal-empty">
                  <p>No playlists found.</p>
                </div>
              )}

              {playlistStatus && <p className="playlist-status">{playlistStatus}</p>}
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {queueOpen && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="presentation"
            onClick={() => setQueueOpen(false)}
          >
            <motion.section
              className="modal-card queue-card glass-card"
              initial={{ opacity: 0, y: 28, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.96 }}
              transition={{ duration: 0.22 }}
              role="dialog"
              aria-modal="true"
              aria-label="Current queue"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal-header">
                <div>
                  <p className="eyebrow">Playing Queue</p>
                  <h2>Up Next</h2>
                </div>

                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setQueueOpen(false)}
                  aria-label="Close queue modal"
                >
                  <FaTimes />
                </button>
              </div>

              <div className="queue-list">
                {(playlist.length ? playlist : songs).map((song, index) => (
                  <button
                    key={song._id}
                    type="button"
                    className={`queue-item ${
                      song._id === activeSong._id ? "active" : ""
                    }`}
                    onClick={() => handlePlayRecommended(song)}
                  >
                    <span className="queue-index">
                      {song._id === activeSong._id ? <FaMusic /> : index + 1}
                    </span>
                    <img src={song.imageUrl} alt="" />
                    <span>
                      <strong>{song.title}</strong>
                      <small>{getArtistName(song)}</small>
                    </span>
                    <em>{formatTime(song.duration)}</em>
                  </button>
                ))}
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
};

export default SongDetails;