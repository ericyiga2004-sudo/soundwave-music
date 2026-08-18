import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useContext,
} from "react";
import axios from "axios";
import { MusicContext } from "./ShopContext";
import { getLowData } from "../utils/uiPreferences";
import { trackTasteEvent } from "../utils/personalization";
import { getSongAudioUrl } from "../utils/audioSource";

export const MusicPlayerContext = createContext(null);

const REPEAT_MODES = {
  OFF: "off",
  ALL: "all",
  ONE: "one",
};

const DEFAULT_AUDIO_EFFECTS = {
  bassBoost: 0,
  reverb: 0,
  presence: 0,
};

const MIN_BUFFER_SECONDS = 0.75;
const OFFLINE_CACHE_NAME = "music-app-offline-songs-v1";

const normalizePlaylist = (songs = []) => {
  const seen = new Set();

  return songs.filter((song) => {
    if (!song?._id || seen.has(song._id)) return false;
    seen.add(song._id);
    return true;
  });
};

const getRandomIndex = (length, currentIndex) => {
  if (length <= 1) return currentIndex;

  let nextIndex = currentIndex;

  while (nextIndex === currentIndex) {
    nextIndex = Math.floor(Math.random() * length);
  }

  return nextIndex;
};

const getArtistName = (song) =>
  song?.artist?.name || song?.artistName || song?.artist || "Unknown Artist";

const getAlbumTitle = (song) =>
  song?.album?.title || song?.albumTitle || song?.album || "";

const getBufferedAhead = (audio) => {
  if (!audio || !audio.buffered || audio.buffered.length === 0) return 0;

  const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;

  for (let i = 0; i < audio.buffered.length; i += 1) {
    const start = audio.buffered.start(i);
    const end = audio.buffered.end(i);

    if (currentTime >= start && currentTime <= end) {
      return Math.max(0, end - currentTime);
    }
  }

  return 0;
};

const hasEnoughBuffer = (audio, minSeconds = MIN_BUFFER_SECONDS) => {
  if (!audio) return false;

  if (audio.readyState >= 4) return true;

  const bufferedAhead = getBufferedAhead(audio);

  return bufferedAhead >= minSeconds;
};

const getOfflineAudioObjectUrl = async (song) => {
  const audioUrl = getSongAudioUrl(song);
  if (
    !audioUrl ||
    typeof window === "undefined" ||
    !("caches" in window)
  ) {
    return "";
  }

  const cache = await caches.open(OFFLINE_CACHE_NAME);
  const cachedAudio = await cache.match(audioUrl);

  if (!cachedAudio) return "";

  const blob = await cachedAudio.blob();
  return URL.createObjectURL(blob);
};

export const MusicPlayerProvider = ({ children }) => {
  const audioRef = useRef(null);

  const playlistRef = useRef([]);
  const currentIndexRef = useRef(-1);
  const currentSongRef = useRef(null);
  const shuffleRef = useRef(false);
  const repeatRef = useRef(REPEAT_MODES.OFF);
  const isChangingTrackRef = useRef(false);
  const userWantedPlayRef = useRef(false);
  const recoveryTimerRef = useRef(null);
  const offlineAudioObjectUrlRef = useRef("");
  const tasteSignalsRef = useRef({ songId: "", sent20: false, sent60: false, completed: false });
  const playbackRequestRef = useRef(0);
  const audioRetryRef = useRef({ songId: "", count: 0 });
  const roomControlRef = useRef({ active: false });

  const musicContext = useContext(MusicContext);

  const token = musicContext?.token || "";
  const backendUrl = musicContext?.backendUrl || "";

  const [audioReady, setAudioReady] = useState(false);
  const [currentSong, setCurrentSong] = useState(null);
  const [playlist, setPlaylist] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [bufferMessage, setBufferMessage] = useState("");
  const [playbackError, setPlaybackError] = useState("");
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffleState] = useState(false);
  const [repeat, setRepeatState] = useState(REPEAT_MODES.OFF);
  const [audioEffects, setAudioEffectsState] = useState(DEFAULT_AUDIO_EFFECTS);
  const [loading] = useState(false);

  useEffect(() => {
    const onRoomControl = (event) => {
      const detail = event?.detail || {};
      roomControlRef.current = detail.active ? detail : { active: false };
    };
    window.addEventListener("soundwave-room-control", onRoomControl);
    return () => window.removeEventListener("soundwave-room-control", onRoomControl);
  }, []);

  const clearRecoveryTimer = useCallback(() => {
    if (recoveryTimerRef.current) {
      window.clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
  }, []);

  const setBufferingState = useCallback((value, message = "") => {
    setIsBuffering(value);
    setBufferMessage(value ? message || "Buffering song..." : "");
  }, []);

  const releaseOfflineAudioObjectUrl = useCallback(() => {
    if (!offlineAudioObjectUrlRef.current) return;

    URL.revokeObjectURL(offlineAudioObjectUrlRef.current);
    offlineAudioObjectUrlRef.current = "";
  }, []);

  const resolvePlayableAudioUrl = useCallback(
    async (song) => {
      const directAudioUrl = getSongAudioUrl(song);
      if (!directAudioUrl) return "";

      const shouldUseOfflineCache =
        typeof navigator !== "undefined" && !navigator.onLine;

      if (!shouldUseOfflineCache) {
        releaseOfflineAudioObjectUrl();
        return directAudioUrl;
      }

      try {
        const offlineObjectUrl = await getOfflineAudioObjectUrl(song);

        if (offlineObjectUrl) {
          releaseOfflineAudioObjectUrl();
          offlineAudioObjectUrlRef.current = offlineObjectUrl;
          return offlineObjectUrl;
        }
      } catch (error) {
        console.warn("Unable to read offline audio cache:", error);
      }

      releaseOfflineAudioObjectUrl();
      return directAudioUrl;
    },
    [releaseOfflineAudioObjectUrl]
  );

  const tryResumeAfterBuffer = useCallback(async () => {
    const audio = audioRef.current;

    if (!audio || !getSongAudioUrl(currentSongRef.current)) return;
    if (!userWantedPlayRef.current) return;
    if (!audio.paused) {
      setBufferingState(false);
      return;
    }

    if (!hasEnoughBuffer(audio, MIN_BUFFER_SECONDS)) {
      setBufferingState(true, "Waiting for stable audio...");
      return;
    }

    try {
      await audio.play();
      setIsPlaying(true);
      setBufferingState(false);
    } catch (error) {
      setIsPlaying(false);
      setBufferingState(true, "Tap play when connection is stable.");
      console.error("Unable to resume after buffering:", error);
    }
  }, [setBufferingState]);

  const registerAudioElement = useCallback((node) => {
    if (!node) {
      audioRef.current = null;
      setAudioReady(false);
      return;
    }

    audioRef.current = node;

    node.preload = getLowData() ? "metadata" : "auto";
    node.removeAttribute("crossorigin");
    node.setAttribute("playsinline", "true");
    node.setAttribute("webkit-playsinline", "true");
    node.setAttribute("x-webkit-airplay", "allow");
    node.controls = false;

    setAudioReady(true);
  }, []);

  const setAudioEffects = useCallback((effectsOrUpdater) => {
    setAudioEffectsState((previous) => {
      const nextEffects =
        typeof effectsOrUpdater === "function"
          ? effectsOrUpdater(previous)
          : effectsOrUpdater;

      return {
        bassBoost: Number(nextEffects?.bassBoost || 0),
        reverb: Number(nextEffects?.reverb || 0),
        presence: Number(nextEffects?.presence || 0),
      };
    });
  }, []);

  const resetAudioEffects = useCallback(() => {
    setAudioEffects(DEFAULT_AUDIO_EFFECTS);
  }, [setAudioEffects]);

  const setShuffle = useCallback((value) => {
    setShuffleState((previous) => {
      const nextValue =
        typeof value === "function" ? Boolean(value(previous)) : Boolean(value);

      shuffleRef.current = nextValue;
      return nextValue;
    });
  }, []);

  const setRepeat = useCallback((modeOrUpdater) => {
    setRepeatState((previous) => {
      const nextMode =
        typeof modeOrUpdater === "function"
          ? modeOrUpdater(previous)
          : modeOrUpdater;

      const safeMode = Object.values(REPEAT_MODES).includes(nextMode)
        ? nextMode
        : REPEAT_MODES.OFF;

      repeatRef.current = safeMode;
      return safeMode;
    });
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeat((previous) => {
      if (previous === REPEAT_MODES.OFF) return REPEAT_MODES.ALL;
      if (previous === REPEAT_MODES.ALL) return REPEAT_MODES.ONE;
      return REPEAT_MODES.OFF;
    });
  }, [setRepeat]);

  const syncTrackState = useCallback((song, queue) => {
    const cleanQueue = normalizePlaylist(queue?.length ? queue : [song]);
    const index = cleanQueue.findIndex((item) => item._id === song?._id);

    playlistRef.current = cleanQueue;
    currentIndexRef.current = index;
    currentSongRef.current = song;

    setPlaylist(cleanQueue);
    setCurrentIndex(index);
    setCurrentSong(song);
  }, []);

  const addSongToHistory = useCallback(
    async (song) => {
      if (!token || !backendUrl || !song?._id) return;

      try {
        await axios.post(
          `${backendUrl}/api/history/add`,
          {
            songId: song._id,
          },
          {
            headers: {
              token,
            },
          }
        );

        window.dispatchEvent(new Event("music-history-updated"));
      } catch (error) {
        console.error("Unable to add song to history:", error);
      }
    },
    [backendUrl, token]
  );

  const playSong = useCallback(
    async (song, queue = [], options = {}) => {
      if (!song?._id) return false;

      const roomControl = roomControlRef.current;
      if (!options?.roomSync && roomControl?.active) {
        const roomSongId = String(roomControl.currentSongId || "");
        const requestedSongId = String(song._id || "");
        if (!roomControl.isHost || (roomSongId && requestedSongId !== roomSongId)) {
          roomControl.onBlocked?.("play-song");
          return false;
        }
      }

      const audio = audioRef.current;
      const directAudioUrl = getSongAudioUrl(song);

      // Keep the UI and route in sync even when a catalog entry is missing
      // audio. The player can then show an actionable error instead of
      // silently doing nothing.
      if (!directAudioUrl) {
        syncTrackState(song, queue);
        userWantedPlayRef.current = false;
        setIsPlaying(false);
        setBufferingState(false);
        setPlaybackError("Audio is unavailable for this song.");
        return false;
      }

      if (!audio) {
        setPlaybackError("The audio player is still starting. Tap Play again.");
        console.error("Audio element is not mounted yet.");
        return false;
      }

      const requestId = playbackRequestRef.current + 1;
      playbackRequestRef.current = requestId;

      const previousSong = currentSongRef.current;
      const isSameSong = previousSong?._id === song._id;

      if (!isSameSong && previousSong?._id && audio.currentTime > 0 && audio.currentTime < 12) {
        trackTasteEvent("skip_early", { songId: previousSong._id }, { cooldownMs: 8000 });
      }

      if (!isSameSong) {
        tasteSignalsRef.current = { songId: song._id, sent20: false, sent60: false, completed: false };
        audioRetryRef.current = { songId: song._id, count: 0 };
      }

      userWantedPlayRef.current = true;
      syncTrackState(song, queue);
      clearRecoveryTimer();
      setPlaybackError("");

      try {
        setBufferingState(true, "Loading song...");

        const audioSource = await resolvePlayableAudioUrl(song);
        if (requestId !== playbackRequestRef.current) return false;

        if (!audioSource) {
          throw new Error("Song audio URL is missing.");
        }

        const currentSource = String(audio.currentSrc || audio.src || "");
        const sourceChanged = !isSameSong || !currentSource || currentSource !== audioSource;

        if (sourceChanged) {
          isChangingTrackRef.current = true;

          // A normal <audio> element does not need CORS permission merely to
          // play a remote file. Requiring anonymous CORS here made otherwise
          // playable files fail on providers that do not return CORS headers.
          audio.pause();
          audio.removeAttribute("crossorigin");
          audio.preload = "auto";
          audio.setAttribute("playsinline", "true");
          audio.setAttribute("webkit-playsinline", "true");
          audio.setAttribute("x-webkit-airplay", "allow");
          audio.src = audioSource;
          audio.load();

          setProgress(0);
          setDuration(0);
        }

        if (requestId !== playbackRequestRef.current) return false;

        await audio.play();
        if (requestId !== playbackRequestRef.current) return false;

        setIsPlaying(true);
        setBufferingState(false);
        setPlaybackError("");

        addSongToHistory(song).catch(() => {});
        if (!options?.roomSync && roomControl?.active && roomControl.isHost) {
          Promise.resolve(roomControl.onPlaybackChange?.({
            playbackState: "playing",
            position: Number(audio.currentTime || 0),
            reason: "play-song",
          })).catch(() => {});
        }
        return true;
      } catch (error) {
        if (requestId !== playbackRequestRef.current) return false;

        setIsPlaying(false);
        setBufferingState(false);

        const message =
          error?.name === "NotAllowedError"
            ? "Playback was blocked by the browser. Tap Play to start audio."
            : "Could not start this audio. Tap Play to retry.";

        setPlaybackError(message);
        console.error("Unable to play song:", error);
        return false;
      } finally {
        if (requestId === playbackRequestRef.current) {
          isChangingTrackRef.current = false;
        }
      }
    },
    [
      addSongToHistory,
      clearRecoveryTimer,
      resolvePlayableAudioUrl,
      setBufferingState,
      syncTrackState,
    ]
  );

  const pauseSong = useCallback((options = {}) => {
    const audio = audioRef.current;
    const roomControl = roomControlRef.current;
    playbackRequestRef.current += 1;
    if (!audio) return;

    userWantedPlayRef.current = false;
    clearRecoveryTimer();

    // In a live room, a listener may locally pause their own device without
    // changing the room clock. The host remains authoritative for everybody
    // else; when this listener resumes, LiveRoom resynchronizes them to the
    // host's current position before audio continues.
    if (!options?.roomSync && roomControl?.active && !roomControl.isHost) {
      audio.pause();
      setIsPlaying(false);
      setBufferingState(false);
      roomControl.onLocalPause?.();
      return true;
    }

    audio.pause();
    setIsPlaying(false);
    setBufferingState(false);
    if (!options?.roomSync && roomControl?.active && roomControl.isHost) {
      Promise.resolve(roomControl.onPlaybackChange?.({
        playbackState: "paused",
        position: Number(audio.currentTime || 0),
        reason: "pause",
      })).catch(() => {});
    }
    return true;
  }, [clearRecoveryTimer, setBufferingState]);

  const resumeSong = useCallback(async (options = {}) => {
    const audio = audioRef.current;
    const activeSong = currentSongRef.current;
    const roomControl = roomControlRef.current;

    if (!options?.roomSync && roomControl?.active && !roomControl.isHost) {
      if (typeof roomControl.onListenerResume === "function") {
        return roomControl.onListenerResume();
      }
      roomControl.onBlocked?.("play");
      return false;
    }

    if (!audio || !getSongAudioUrl(activeSong)) return;

    const requestId = playbackRequestRef.current + 1;
    playbackRequestRef.current = requestId;
    userWantedPlayRef.current = true;
    clearRecoveryTimer();
    setPlaybackError("");

    try {
      setBufferingState(true, "Preparing audio...");

      audio.preload = "auto";
      audio.removeAttribute("crossorigin");
      audio.setAttribute("playsinline", "true");
      audio.setAttribute("webkit-playsinline", "true");
      audio.setAttribute("x-webkit-airplay", "allow");

      if (!audio.src) {
        const audioSource = await resolvePlayableAudioUrl(activeSong);

        if (!audioSource) return;

        audio.src = audioSource;
        audio.load();
      }

      if (!hasEnoughBuffer(audio, 1.2) && audio.readyState < 3) {
        setBufferingState(true, "Buffering song...");
      }

      await audio.play();
      if (requestId !== playbackRequestRef.current) return;

      setIsPlaying(true);
      setBufferingState(false);
      setPlaybackError("");
      if (!options?.roomSync && roomControl?.active && roomControl.isHost) {
        Promise.resolve(roomControl.onPlaybackChange?.({
          playbackState: "playing",
          position: Number(audio.currentTime || 0),
          reason: "play",
        })).catch(() => {});
      }
      return true;
    } catch (error) {
      if (requestId !== playbackRequestRef.current) return;
      setIsPlaying(false);
      setBufferingState(false);
      setPlaybackError(error?.name === "NotAllowedError" ? "Tap Play to start audio." : "Could not resume this audio. Tap Play to retry.");
      console.error("Unable to resume song:", error);
      return false;
    }
  }, [
    clearRecoveryTimer,
    resolvePlayableAudioUrl,
    setBufferingState,
    tryResumeAfterBuffer,
  ]);

  const togglePlay = useCallback(async (options = {}) => {
    const audio = audioRef.current;
    if (!audio || !getSongAudioUrl(currentSongRef.current)) return;

    if (audio.paused) {
      await resumeSong(options);
    } else {
      pauseSong(options);
    }
  }, [pauseSong, resumeSong]);

  const seekTo = useCallback(
    (time, options = {}) => {
      const audio = audioRef.current;
      if (!audio) return;

      const roomControl = roomControlRef.current;
      if (!options?.roomSync && roomControl?.active && !roomControl.isHost) {
        roomControl.onBlocked?.("seek");
        return false;
      }

      const safeDuration = Number.isFinite(audio.duration) ? audio.duration : 0;

      const safeTime = Number.isFinite(time)
        ? Math.min(Math.max(0, time), safeDuration || time)
        : 0;

      audio.currentTime = safeTime;
      setProgress(safeTime);

      if (userWantedPlayRef.current && !hasEnoughBuffer(audio, 1.5)) {
        setBufferingState(true, "Buffering after seek...");
      }

      if (!options?.roomSync && roomControl?.active && roomControl.isHost) {
        Promise.resolve(roomControl.onPlaybackChange?.({
          playbackState: audio.paused ? "paused" : "playing",
          position: safeTime,
          reason: "seek",
        })).catch(() => {});
      }
      return true;
    },
    [setBufferingState]
  );

  const skipForward = useCallback(
    (seconds = 15, options = {}) => {
      const audio = audioRef.current;
      if (!audio) return;

      const currentTime = Number.isFinite(audio.currentTime)
        ? audio.currentTime
        : 0;

      const audioDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
      const safeSeconds = Number(seconds) || 15;

      const nextTime = audioDuration
        ? Math.min(currentTime + safeSeconds, audioDuration)
        : currentTime + safeSeconds;
      return seekTo(nextTime, options);
    },
    [seekTo]
  );

  const skipBackward = useCallback(
    (seconds = 15, options = {}) => {
      const audio = audioRef.current;
      if (!audio) return;

      const currentTime = Number.isFinite(audio.currentTime)
        ? audio.currentTime
        : 0;

      const safeSeconds = Number(seconds) || 15;
      const nextTime = Math.max(currentTime - safeSeconds, 0);
      return seekTo(nextTime, options);
    },
    [seekTo]
  );

  const addToQueue = useCallback((song) => {
    if (!song?._id) return false;

    const currentQueue = playlistRef.current.length
      ? playlistRef.current
      : currentSongRef.current
        ? [currentSongRef.current]
        : [];

    if (currentQueue.some((item) => item?._id === song._id)) {
      return false;
    }

    const nextQueue = normalizePlaylist([...currentQueue, song]);
    playlistRef.current = nextQueue;
    setPlaylist(nextQueue);

    if (currentSongRef.current?._id) {
      const nextIndex = nextQueue.findIndex((item) => item?._id === currentSongRef.current?._id);
      currentIndexRef.current = nextIndex;
      setCurrentIndex(nextIndex);
    }

    return true;
  }, []);

  const addNextToQueue = useCallback((song) => {
    if (!song?._id) return false;
    const currentQueue = playlistRef.current.length
      ? [...playlistRef.current]
      : currentSongRef.current
        ? [currentSongRef.current]
        : [];
    const existingIndex = currentQueue.findIndex((item) => item?._id === song._id);
    if (existingIndex >= 0) currentQueue.splice(existingIndex, 1);
    const currentId = currentSongRef.current?._id;
    const activeIndex = Math.max(0, currentQueue.findIndex((item) => item?._id === currentId));
    currentQueue.splice(activeIndex + 1, 0, song);
    const nextQueue = normalizePlaylist(currentQueue);
    playlistRef.current = nextQueue;
    setPlaylist(nextQueue);
    const nextIndex = nextQueue.findIndex((item) => item?._id === currentId);
    currentIndexRef.current = nextIndex;
    setCurrentIndex(nextIndex);
    return true;
  }, []);

  const removeFromQueue = useCallback((songId) => {
    const currentId = currentSongRef.current?._id;
    if (!songId || songId === currentId) return false;
    const nextQueue = playlistRef.current.filter((item) => item?._id !== songId);
    if (nextQueue.length === playlistRef.current.length) return false;
    playlistRef.current = nextQueue;
    setPlaylist(nextQueue);
    const nextIndex = nextQueue.findIndex((item) => item?._id === currentId);
    currentIndexRef.current = nextIndex;
    setCurrentIndex(nextIndex);
    return true;
  }, []);

  const playByIndex = useCallback(
    async (index) => {
      const queue = playlistRef.current;
      const targetSong = queue[index];

      if (!targetSong) return false;

      await playSong(targetSong, queue);
      return true;
    },
    [playSong]
  );

  const nextSong = useCallback(async (options = {}) => {
    const roomControl = roomControlRef.current;
    if (!options?.roomSync && roomControl?.active) {
      if (roomControl.isHost && typeof roomControl.onNext === "function") {
        return roomControl.onNext();
      }
      roomControl.onBlocked?.("next");
      return currentSongRef.current;
    }

    const audio = audioRef.current;
    const queue = playlistRef.current;
    const activeIndex = currentIndexRef.current;

    if (!audio || !queue.length || activeIndex < 0) return null;

    let nextIndex;

    if (shuffleRef.current) {
      nextIndex = getRandomIndex(queue.length, activeIndex);
    } else {
      nextIndex = activeIndex + 1;
    }

    if (nextIndex >= queue.length) {
      if (repeatRef.current === REPEAT_MODES.ALL) {
        nextIndex = 0;
      } else {
        userWantedPlayRef.current = false;
        audio.pause();
        audio.currentTime = 0;
        setProgress(0);
        setIsPlaying(false);
        setBufferingState(false);
        return null;
      }
    }

    await playByIndex(nextIndex);
    return playlistRef.current[nextIndex] || null;
  }, [playByIndex, setBufferingState]);

  const prevSong = useCallback(async (options = {}) => {
    const roomControl = roomControlRef.current;
    if (!options?.roomSync && roomControl?.active) {
      if (roomControl.isHost) {
        seekTo(0);
        return currentSongRef.current;
      }
      roomControl.onBlocked?.("previous");
      return currentSongRef.current;
    }

    const audio = audioRef.current;
    const queue = playlistRef.current;
    const activeIndex = currentIndexRef.current;

    if (!audio || !queue.length || activeIndex < 0) return null;

    if (audio.currentTime > 3) {
      seekTo(0);
      return currentSongRef.current;
    }

    let previousIndex = activeIndex - 1;

    if (previousIndex < 0) {
      if (repeatRef.current === REPEAT_MODES.ALL) {
        previousIndex = queue.length - 1;
      } else {
        seekTo(0);
        return currentSongRef.current;
      }
    }

    await playByIndex(previousIndex);
    return playlistRef.current[previousIndex] || null;
  }, [playByIndex, seekTo]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioReady) return;

    const handleLoadedMetadata = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };

    const handleTimeUpdate = () => {
      const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      setProgress(currentTime);
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);

      const activeSong = currentSongRef.current;
      const signals = tasteSignalsRef.current;
      if (activeSong?._id && signals.songId === activeSong._id) {
        if (currentTime >= 20 && !signals.sent20) {
          signals.sent20 = true;
          trackTasteEvent("play_20s", { songId: activeSong._id }, { cooldownMs: 0 });
        }
        if (currentTime >= 60 && !signals.sent60) {
          signals.sent60 = true;
          trackTasteEvent("play_60s", { songId: activeSong._id }, { cooldownMs: 0 });
        }
      }

      if (userWantedPlayRef.current && !audio.paused && hasEnoughBuffer(audio, 1)) {
        setBufferingState(false);
      }
    };

    const handleLoadStart = () => {
      if (userWantedPlayRef.current) {
        setBufferingState(true, "Loading song...");
      }
    };

    const handleWaiting = () => {
      if (!userWantedPlayRef.current) return;
      // Let the browser continue buffering naturally. Pausing here used to
      // deadlock some remote streams on slow/mobile connections.
      setBufferingState(true, "Buffering song...");
    };

    const handleStalled = () => {
      if (!userWantedPlayRef.current) return;
      setBufferingState(true, "Connection is unstable...");
    };

    const handleCanPlay = () => {
      if (!userWantedPlayRef.current) {
        setBufferingState(false);
        return;
      }

      if (hasEnoughBuffer(audio, 1.5)) {
        tryResumeAfterBuffer();
      }
    };

    const handleCanPlayThrough = () => {
      if (!userWantedPlayRef.current) {
        setBufferingState(false);
        return;
      }

      tryResumeAfterBuffer();
    };

    const handleProgress = () => {
      if (!userWantedPlayRef.current) return;

      if (audio.paused && hasEnoughBuffer(audio, MIN_BUFFER_SECONDS)) {
        tryResumeAfterBuffer();
      } else if (!audio.paused && hasEnoughBuffer(audio, 1)) {
        setBufferingState(false);
      }
    };

    const handlePlaying = () => {
      setIsPlaying(true);
      setBufferingState(false);

      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "playing";
      }
    };

    const handlePlay = () => {
      userWantedPlayRef.current = true;
      setIsPlaying(true);

      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "playing";
      }
    };

    const handlePause = () => {
      if (!isChangingTrackRef.current) {
        setIsPlaying(false);

        if (!userWantedPlayRef.current) {
          setBufferingState(false);
        }

        if ("mediaSession" in navigator) {
          navigator.mediaSession.playbackState = "paused";
        }
      }
    };

    const handleError = () => {
      const activeSong = currentSongRef.current;
      if (!activeSong?._id) return;

      setIsPlaying(false);
      setBufferingState(false);

      const sameSong = audioRetryRef.current.songId === activeSong._id;
      const retryCount = sameSong ? audioRetryRef.current.count : 0;

      if (userWantedPlayRef.current && retryCount < 1 && getSongAudioUrl(activeSong)) {
        audioRetryRef.current = { songId: activeSong._id, count: retryCount + 1 };
        setBufferingState(true, "Retrying audio...");

        clearRecoveryTimer();
        recoveryTimerRef.current = window.setTimeout(() => {
          if (!userWantedPlayRef.current || currentSongRef.current?._id !== activeSong._id) return;
          try {
            audio.pause();
            audio.removeAttribute("src");
            audio.load();
          } catch {
            // The explicit playSong retry below will rebuild the source.
          }
          playSong(activeSong, playlistRef.current, { roomSync: true });
        }, 700);
        return;
      }

      userWantedPlayRef.current = false;
      setPlaybackError("This audio source could not be played. Tap Play to retry.");
    };

    const handleEnded = async () => {
      if (isChangingTrackRef.current) return;

      const repeatMode = repeatRef.current;
      const activeSong = currentSongRef.current;
      if (activeSong?._id && !tasteSignalsRef.current.completed) {
        tasteSignalsRef.current.completed = true;
        trackTasteEvent("complete", { songId: activeSong._id }, { cooldownMs: 0 });
      }

      if (roomControlRef.current?.active) {
        await nextSong();
        return;
      }

      if (repeatMode === REPEAT_MODES.ONE) {
        if (activeSong?._id) trackTasteEvent("repeat", { songId: activeSong._id }, { cooldownMs: 5000 });
        tasteSignalsRef.current = { songId: activeSong?._id || "", sent20: false, sent60: false, completed: false };
        audio.currentTime = 0;

        try {
          userWantedPlayRef.current = true;
          setBufferingState(true, "Repeating song...");
          await audio.play();
          setIsPlaying(true);
          setBufferingState(false);
        } catch (error) {
          setIsPlaying(false);
          setBufferingState(true, "Preparing repeat...");
          console.error("Unable to repeat song:", error);
        }

        return;
      }

      // Low Data Mode avoids silently starting another full audio stream.
      // Explicit Repeat All still behaves as requested by the listener.
      if (getLowData() && repeatMode === REPEAT_MODES.OFF) {
        userWantedPlayRef.current = false;
        audio.pause();
        audio.currentTime = 0;
        setProgress(0);
        setIsPlaying(false);
        setBufferingState(false);
        return;
      }

      await nextSong();
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("durationchange", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadstart", handleLoadStart);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("stalled", handleStalled);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("canplaythrough", handleCanPlayThrough);
    audio.addEventListener("progress", handleProgress);
    audio.addEventListener("playing", handlePlaying);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("error", handleError);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("durationchange", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadstart", handleLoadStart);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("stalled", handleStalled);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("canplaythrough", handleCanPlayThrough);
      audio.removeEventListener("progress", handleProgress);
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [
    audioReady,
    clearRecoveryTimer,
    nextSong,
    playSong,
    releaseOfflineAudioObjectUrl,
    resolvePlayableAudioUrl,
    setBufferingState,
    tryResumeAfterBuffer,
  ]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    if (!currentSong) return;

    try {
      if ("MediaMetadata" in window) {
        navigator.mediaSession.metadata = new window.MediaMetadata({
          title: currentSong.title || "Unknown Song",
          artist: getArtistName(currentSong),
          album: getAlbumTitle(currentSong),
          artwork: currentSong.imageUrl
            ? [
                {
                  src: currentSong.imageUrl,
                  sizes: "96x96",
                  type: "image/png",
                },
                {
                  src: currentSong.imageUrl,
                  sizes: "128x128",
                  type: "image/png",
                },
                {
                  src: currentSong.imageUrl,
                  sizes: "192x192",
                  type: "image/png",
                },
                {
                  src: currentSong.imageUrl,
                  sizes: "256x256",
                  type: "image/png",
                },
                {
                  src: currentSong.imageUrl,
                  sizes: "384x384",
                  type: "image/png",
                },
                {
                  src: currentSong.imageUrl,
                  sizes: "512x512",
                  type: "image/png",
                },
              ]
            : [],
        });
      }

      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";

      navigator.mediaSession.setActionHandler("play", () => {
        resumeSong();
      });

      navigator.mediaSession.setActionHandler("pause", () => {
        pauseSong();
      });

      navigator.mediaSession.setActionHandler("previoustrack", () => {
        prevSong();
      });

      navigator.mediaSession.setActionHandler("nexttrack", () => {
        nextSong();
      });

      navigator.mediaSession.setActionHandler("seekbackward", (details) => {
        skipBackward(details.seekOffset || 15);
      });

      navigator.mediaSession.setActionHandler("seekforward", (details) => {
        skipForward(details.seekOffset || 15);
      });

      navigator.mediaSession.setActionHandler("seekto", (details) => {
        const audio = audioRef.current;

        if (audio && details.fastSeek && "fastSeek" in audio) {
          audio.fastSeek(details.seekTime);
          return;
        }

        seekTo(details.seekTime);
      });
    } catch (error) {
      console.warn("Media Session is not fully supported:", error);
    }
  }, [
    currentSong,
    isPlaying,
    resumeSong,
    pauseSong,
    prevSong,
    nextSong,
    skipBackward,
    skipForward,
    seekTo,
  ]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    const audio = audioRef.current;
    if (!audio) return;

    const safeDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const safePosition = Number.isFinite(audio.currentTime)
      ? audio.currentTime
      : 0;

    if (!safeDuration || safePosition > safeDuration) return;

    try {
      navigator.mediaSession.setPositionState({
        duration: safeDuration,
        playbackRate: audio.playbackRate || 1,
        position: safePosition,
      });
    } catch {
      // Some browsers do not support setPositionState.
    }
  }, [progress, duration]);

  useEffect(() => {
    const handleOnline = () => {
      if (userWantedPlayRef.current) {
        setBufferingState(true, "Connection restored. Resuming...");
        window.setTimeout(() => {
          tryResumeAfterBuffer();
        }, 700);
      }
    };

    const handleOffline = async () => {
      setBufferingState(true, "You are offline. Waiting for connection...");

      const audio = audioRef.current;
      if (audio) {
        const activeSong = currentSongRef.current;

        if (getSongAudioUrl(activeSong) && userWantedPlayRef.current) {
          try {
            const currentTime = Number.isFinite(audio.currentTime)
              ? audio.currentTime
              : 0;
            const offlineObjectUrl = await getOfflineAudioObjectUrl(activeSong);

            if (offlineObjectUrl) {
              releaseOfflineAudioObjectUrl();
              offlineAudioObjectUrlRef.current = offlineObjectUrl;
              audio.src = offlineObjectUrl;
              audio.load();

              if (currentTime > 0) {
                audio.currentTime = currentTime;
              }

              await audio.play();
              setIsPlaying(true);
              setBufferingState(false);
              return;
            }
          } catch (error) {
            console.error("Unable to continue with offline audio:", error);
          }
        }

        try {
          audio.pause();
        } catch {
          // Ignore pause errors.
        }
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [releaseOfflineAudioObjectUrl, setBufferingState, tryResumeAfterBuffer]);

  useEffect(() => {
    return () => {
      clearRecoveryTimer();

      const audio = audioRef.current;

      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }

      releaseOfflineAudioObjectUrl();
    };
  }, [clearRecoveryTimer, releaseOfflineAudioObjectUrl]);

  const value = useMemo(
    () => ({
      audioRef,
      registerAudioElement,
      loading,

      currentSong,
      playlist,
      currentIndex,
      isPlaying,
      isBuffering,
      bufferMessage,
      playbackError,
      progress,
      duration,
      shuffle,
      repeat,
      repeatModes: REPEAT_MODES,

      audioEffects,
      setAudioEffects,
      resetAudioEffects,

      playSong,
      pauseSong,
      resumeSong,
      togglePlay,
      nextSong,
      prevSong,
      skipForward,
      skipBackward,
      seekTo,
      setShuffle,
      setRepeat,
      cycleRepeat,
      addToQueue,
      addNextToQueue,
      removeFromQueue,
    }),
    [
      registerAudioElement,
      loading,
      currentSong,
      playlist,
      currentIndex,
      isPlaying,
      isBuffering,
      bufferMessage,
      playbackError,
      progress,
      duration,
      shuffle,
      repeat,
      audioEffects,
      setAudioEffects,
      resetAudioEffects,
      playSong,
      pauseSong,
      resumeSong,
      togglePlay,
      nextSong,
      prevSong,
      skipForward,
      skipBackward,
      seekTo,
      setShuffle,
      setRepeat,
      cycleRepeat,
      addToQueue,
      addNextToQueue,
      removeFromQueue,
    ]
  );

  return (
    <MusicPlayerContext.Provider value={value}>
      {children}
    </MusicPlayerContext.Provider>
  );
};

export default MusicPlayerProvider;
