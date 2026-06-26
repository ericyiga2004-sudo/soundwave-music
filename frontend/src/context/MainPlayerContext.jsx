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

export const MusicPlayerProvider = ({ children }) => {
  const audioRef = useRef(null);

  const playlistRef = useRef([]);
  const currentIndexRef = useRef(-1);
  const currentSongRef = useRef(null);
  const shuffleRef = useRef(false);
  const repeatRef = useRef(REPEAT_MODES.OFF);
  const isChangingTrackRef = useRef(false);

  const musicContext = useContext(MusicContext);

  const token = musicContext?.token || "";
  const backendUrl = musicContext?.backendUrl || "";
  const fetchHistory = musicContext?.fetchHistory;

  const [audioReady, setAudioReady] = useState(false);
  const [currentSong, setCurrentSong] = useState(null);
  const [playlist, setPlaylist] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffleState] = useState(false);
  const [repeat, setRepeatState] = useState(REPEAT_MODES.OFF);
  const [audioEffects, setAudioEffectsState] = useState(DEFAULT_AUDIO_EFFECTS);
  const [loading] = useState(false);

  const registerAudioElement = useCallback((node) => {
    if (!node) {
      audioRef.current = null;
      setAudioReady(false);
      return;
    }

    audioRef.current = node;

    node.preload = "auto";
    node.crossOrigin = "anonymous";
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

        fetchHistory?.();
      } catch (error) {
        console.error("Unable to add song to history:", error);
      }
    },
    [backendUrl, fetchHistory, token]
  );

  const playSong = useCallback(
    async (song, queue = []) => {
      if (!song?.audioUrl) return;

      const audio = audioRef.current;

      if (!audio) {
        console.error("Audio element is not mounted yet.");
        return;
      }

      const isSameSong = currentSongRef.current?._id === song._id;

      syncTrackState(song, queue);

      try {
        if (!isSameSong || audio.src !== song.audioUrl) {
          isChangingTrackRef.current = true;

          audio.preload = "auto";
          audio.crossOrigin = "anonymous";
          audio.setAttribute("playsinline", "true");
          audio.setAttribute("webkit-playsinline", "true");
          audio.setAttribute("x-webkit-airplay", "allow");

          audio.src = song.audioUrl;
          audio.load();

          setProgress(0);
          setDuration(0);
        }

        await audio.play();
        setIsPlaying(true);

        await addSongToHistory(song);
      } catch (error) {
        setIsPlaying(false);
        console.error("Unable to play song:", error);
      } finally {
        isChangingTrackRef.current = false;
      }
    },
    [addSongToHistory, syncTrackState]
  );

  const pauseSong = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    setIsPlaying(false);
  }, []);

  const resumeSong = useCallback(async () => {
    const audio = audioRef.current;
    const activeSong = currentSongRef.current;

    if (!audio || !activeSong?.audioUrl) return;

    try {
      audio.preload = "auto";
      audio.setAttribute("playsinline", "true");
      audio.setAttribute("webkit-playsinline", "true");
      audio.setAttribute("x-webkit-airplay", "allow");

      if (!audio.src) {
        audio.src = activeSong.audioUrl;
        audio.load();
      }

      await audio.play();
      setIsPlaying(true);
    } catch (error) {
      setIsPlaying(false);
      console.error("Unable to resume song:", error);
    }
  }, []);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !currentSongRef.current?.audioUrl) return;

    if (audio.paused) {
      await resumeSong();
    } else {
      pauseSong();
    }
  }, [pauseSong, resumeSong]);

  const seekTo = useCallback((time) => {
    const audio = audioRef.current;
    if (!audio) return;

    const safeDuration = Number.isFinite(audio.duration) ? audio.duration : 0;

    const safeTime = Number.isFinite(time)
      ? Math.min(Math.max(0, time), safeDuration || time)
      : 0;

    audio.currentTime = safeTime;
    setProgress(safeTime);
  }, []);

  const skipForward = useCallback((seconds = 15) => {
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

    audio.currentTime = nextTime;
    setProgress(nextTime);
  }, []);

  const skipBackward = useCallback((seconds = 15) => {
    const audio = audioRef.current;
    if (!audio) return;

    const currentTime = Number.isFinite(audio.currentTime)
      ? audio.currentTime
      : 0;

    const safeSeconds = Number(seconds) || 15;
    const nextTime = Math.max(currentTime - safeSeconds, 0);

    audio.currentTime = nextTime;
    setProgress(nextTime);
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

  const nextSong = useCallback(async () => {
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
        audio.pause();
        audio.currentTime = 0;
        setProgress(0);
        setIsPlaying(false);
        return null;
      }
    }

    await playByIndex(nextIndex);
    return playlistRef.current[nextIndex] || null;
  }, [playByIndex]);

  const prevSong = useCallback(async () => {
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
      setProgress(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };

    const handlePlay = () => {
      setIsPlaying(true);

      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "playing";
      }
    };

    const handlePause = () => {
      if (!isChangingTrackRef.current) {
        setIsPlaying(false);

        if ("mediaSession" in navigator) {
          navigator.mediaSession.playbackState = "paused";
        }
      }
    };

    const handleEnded = async () => {
      if (isChangingTrackRef.current) return;

      const repeatMode = repeatRef.current;

      if (repeatMode === REPEAT_MODES.ONE) {
        audio.currentTime = 0;

        try {
          await audio.play();
          setIsPlaying(true);
        } catch (error) {
          setIsPlaying(false);
          console.error("Unable to repeat song:", error);
        }

        return;
      }

      await nextSong();
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("durationchange", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("durationchange", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [audioReady, nextSong]);

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
        if (details.fastSeek && "fastSeek" in audioRef.current) {
          audioRef.current.fastSeek(details.seekTime);
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
    const safePosition = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;

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
    return () => {
      const audio = audioRef.current;

      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
    };
  }, []);

  const value = useMemo(
    () => ({
      audioRef,
      registerAudioElement,
      loading,

      currentSong,
      playlist,
      currentIndex,
      isPlaying,
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
    }),
    [
      registerAudioElement,
      loading,
      currentSong,
      playlist,
      currentIndex,
      isPlaying,
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
    ]
  );

  return (
    <MusicPlayerContext.Provider value={value}>
      {children}
    </MusicPlayerContext.Provider>
  );
};

export default MusicPlayerProvider;