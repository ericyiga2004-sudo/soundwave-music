import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import axios from "axios";
import { useContext } from "react";
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

const createReverbImpulse = (audioContext, seconds = 2.2, decay = 2.4) => {
  const sampleRate = audioContext.sampleRate;
  const length = sampleRate * seconds;
  const impulse = audioContext.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const channelData = impulse.getChannelData(channel);

    for (let i = 0; i < length; i += 1) {
      const randomValue = Math.random() * 2 - 1;
      const fade = Math.pow(1 - i / length, decay);

      channelData[i] = randomValue * fade;
    }
  }

  return impulse;
};

export const MusicPlayerProvider = ({ children }) => {
  const audioRef = useRef(new Audio());

  const audioContextRef = useRef(null);
  const audioSourceRef = useRef(null);
  const bassFilterRef = useRef(null);
  const presenceFilterRef = useRef(null);
  const dryGainRef = useRef(null);
  const wetGainRef = useRef(null);
  const convolverRef = useRef(null);
  const audioGraphReadyRef = useRef(false);

  const playlistRef = useRef([]);
  const currentIndexRef = useRef(-1);
  const currentSongRef = useRef(null);
  const shuffleRef = useRef(false);
  const repeatRef = useRef(REPEAT_MODES.OFF);
  const isChangingTrackRef = useRef(false);
  const audioEffectsRef = useRef(DEFAULT_AUDIO_EFFECTS);

  const { token, backendUrl, fetchHistory } = useContext(MusicContext);

  const [currentSong, setCurrentSong] = useState(null);
  const [playlist, setPlaylist] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffleState] = useState(false);
  const [repeat, setRepeatState] = useState(REPEAT_MODES.OFF);
  const [audioEffects, setAudioEffectsState] = useState(DEFAULT_AUDIO_EFFECTS);

  const applyAudioEffects = useCallback((effects) => {
    const bassBoost = Number(effects?.bassBoost || 0);
    const reverb = Number(effects?.reverb || 0);
    const presence = Number(effects?.presence || 0);

    if (bassFilterRef.current) {
      bassFilterRef.current.gain.value = bassBoost;
    }

    if (presenceFilterRef.current) {
      presenceFilterRef.current.gain.value = presence;
    }

    if (dryGainRef.current && wetGainRef.current) {
      const wetAmount = Math.min(Math.max(reverb / 100, 0), 1);

      dryGainRef.current.gain.value = 1 - wetAmount * 0.35;
      wetGainRef.current.gain.value = wetAmount * 0.75;
    }
  }, []);

  const setupAudioGraph = useCallback(() => {
    if (audioGraphReadyRef.current) return;

    const audio = audioRef.current;

    audio.crossOrigin = "anonymous";

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      console.warn("Web Audio API is not supported in this browser.");
      return;
    }

    const audioContext = new AudioContextClass();
    const source = audioContext.createMediaElementSource(audio);

    const bassFilter = audioContext.createBiquadFilter();
    bassFilter.type = "lowshelf";
    bassFilter.frequency.value = 180;
    bassFilter.gain.value = audioEffectsRef.current.bassBoost || 0;

    const presenceFilter = audioContext.createBiquadFilter();
    presenceFilter.type = "peaking";
    presenceFilter.frequency.value = 3200;
    presenceFilter.Q.value = 1.1;
    presenceFilter.gain.value = audioEffectsRef.current.presence || 0;

    const dryGain = audioContext.createGain();
    const wetGain = audioContext.createGain();

    const convolver = audioContext.createConvolver();
    convolver.buffer = createReverbImpulse(audioContext);

    source.connect(bassFilter);
    bassFilter.connect(presenceFilter);

    presenceFilter.connect(dryGain);
    dryGain.connect(audioContext.destination);

    presenceFilter.connect(convolver);
    convolver.connect(wetGain);
    wetGain.connect(audioContext.destination);

    audioContextRef.current = audioContext;
    audioSourceRef.current = source;
    bassFilterRef.current = bassFilter;
    presenceFilterRef.current = presenceFilter;
    dryGainRef.current = dryGain;
    wetGainRef.current = wetGain;
    convolverRef.current = convolver;
    audioGraphReadyRef.current = true;

    applyAudioEffects(audioEffectsRef.current);
  }, [applyAudioEffects]);

  const resumeAudioContext = useCallback(async () => {
    setupAudioGraph();

    const audioContext = audioContextRef.current;

    if (audioContext?.state === "suspended") {
      await audioContext.resume();
    }
  }, [setupAudioGraph]);

  const setAudioEffects = useCallback(
    (effectsOrUpdater) => {
      setAudioEffectsState((previous) => {
        const nextEffects =
          typeof effectsOrUpdater === "function"
            ? effectsOrUpdater(previous)
            : effectsOrUpdater;

        const safeEffects = {
          bassBoost: Number(nextEffects?.bassBoost || 0),
          reverb: Number(nextEffects?.reverb || 0),
          presence: Number(nextEffects?.presence || 0),
        };

        audioEffectsRef.current = safeEffects;
        applyAudioEffects(safeEffects);

        return safeEffects;
      });
    },
    [applyAudioEffects]
  );

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
      const isSameSong = currentSongRef.current?._id === song._id;

      syncTrackState(song, queue);

      try {
        await resumeAudioContext();

        if (!isSameSong || audio.src !== song.audioUrl) {
          isChangingTrackRef.current = true;
          audio.crossOrigin = "anonymous";
          audio.preload = "metadata";
          audio.setAttribute("playsinline", "true");
          audio.setAttribute("webkit-playsinline", "true");
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
    [addSongToHistory, resumeAudioContext, syncTrackState]
  );

  const pauseSong = useCallback(() => {
    audioRef.current.pause();
    setIsPlaying(false);
  }, []);

  const resumeSong = useCallback(async () => {
    if (!currentSongRef.current?.audioUrl) return;

    try {
      await resumeAudioContext();

      const audio = audioRef.current;

      audio.preload = "metadata";
      audio.setAttribute("playsinline", "true");
      audio.setAttribute("webkit-playsinline", "true");

      await audio.play();
      setIsPlaying(true);
    } catch (error) {
      setIsPlaying(false);
      console.error("Unable to resume song:", error);
    }
  }, [resumeAudioContext]);

  const togglePlay = useCallback(async () => {
    if (!currentSongRef.current?.audioUrl) return;

    if (audioRef.current.paused) {
      await resumeSong();
    } else {
      pauseSong();
    }
  }, [pauseSong, resumeSong]);

  const seekTo = useCallback((time) => {
    const audio = audioRef.current;

    const safeDuration = Number.isFinite(audio.duration) ? audio.duration : 0;

    const safeTime = Number.isFinite(time)
      ? Math.min(Math.max(0, time), safeDuration || time)
      : 0;

    audio.currentTime = safeTime;
    setProgress(safeTime);
  }, []);

  const skipForward = useCallback((seconds = 15) => {
    const audio = audioRef.current;

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
    const queue = playlistRef.current;
    const activeIndex = currentIndexRef.current;

    if (!queue.length || activeIndex < 0) return null;

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
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setProgress(0);
        setIsPlaying(false);
        return null;
      }
    }

    await playByIndex(nextIndex);
    return playlistRef.current[nextIndex] || null;
  }, [playByIndex]);

  const prevSong = useCallback(async () => {
    const queue = playlistRef.current;
    const activeIndex = currentIndexRef.current;
    const audio = audioRef.current;

    if (!queue.length || activeIndex < 0) return null;

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

    audio.crossOrigin = "anonymous";
    audio.preload = "metadata";
    audio.setAttribute("playsinline", "true");
    audio.setAttribute("webkit-playsinline", "true");

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
          await resumeAudioContext();

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
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [nextSong, resumeAudioContext]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    if (!currentSong) return;

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

    try {
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
      console.warn("Media Session action handlers are not fully supported:", error);
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
      // Some browsers do not support setPositionState fully.
    }
  }, [progress, duration]);

  useEffect(() => {
    return () => {
      audioRef.current.pause();
      audioRef.current.src = "";

      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const value = useMemo(
    () => ({
      audioRef,
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