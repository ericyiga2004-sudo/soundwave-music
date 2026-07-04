import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  FaChevronLeft,
  FaCompress,
  FaExpand,
  FaPause,
  FaPlay,
  FaRandom,
  FaStepBackward,
  FaStepForward,
  FaVolumeMute,
  FaVolumeUp,
} from "react-icons/fa";

import "./CSS/Visualizer.css";
import { MusicContext } from "../context/ShopContext";
import { MusicPlayerContext } from "../context/MainPlayerContext";

const audioGraphCache = new WeakMap();

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const normalizeDuration = (value) => {
  const durationValue = Number(value);
  if (!Number.isFinite(durationValue) || durationValue <= 0) return 0;
  return durationValue > 10000 ? durationValue / 1000 : durationValue;
};

const formatTime = (seconds = 0) => {
  const safeSeconds = normalizeDuration(seconds);
  if (!safeSeconds) return "0:00";

  const mins = Math.floor(safeSeconds / 60);
  const secs = Math.floor(safeSeconds % 60);

  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const getArtistName = (song) =>
  song?.artist?.name || song?.artistName || song?.artist || "Unknown Artist";

const getAudioDuration = (song, playerDuration, audioDuration) => {
  const candidates = [
    audioDuration,
    playerDuration,
    song?.duration,
    song?.audioDuration,
    song?.metadata?.duration,
  ];

  return candidates.map(normalizeDuration).find(Boolean) || 0;
};

const normalizeQueue = (queue = []) => {
  const seen = new Set();

  return queue.filter((song) => {
    const id = song?._id || song?.id;
    if (!id || seen.has(id)) return false;
    seen.add(id);
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

const averageRange = (data, analyser, lowHz, highHz) => {
  if (!data?.length || !analyser?.context) return 0;

  const nyquist = analyser.context.sampleRate / 2;
  const start = clamp(Math.floor((lowHz / nyquist) * data.length), 0, data.length - 1);
  const end = clamp(Math.ceil((highHz / nyquist) * data.length), start + 1, data.length);
  let total = 0;

  for (let index = start; index < end; index += 1) {
    total += data[index];
  }

  return total / (end - start) / 255;
};

const calculateRms = (timeData) => {
  if (!timeData?.length) return 0;

  let sum = 0;
  for (let index = 0; index < timeData.length; index += 1) {
    const centered = (timeData[index] - 128) / 128;
    sum += centered * centered;
  }

  return Math.sqrt(sum / timeData.length);
};

const parseLrcTimestamp = (timestamp) => {
  const match = String(timestamp || "").match(/^(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?$/);
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

  const metadataTags = new Set(["ar", "al", "ti", "au", "by", "offset", "length", "re", "ve"]);
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
      });
    });
  });

  return parsedLines
    .sort((a, b) => a.start - b.start)
    .map((line, index, lines) => ({
      ...line,
      end: lines[index + 1]
        ? Math.max(lines[index + 1].start - 0.01, line.start + 0.01)
        : null,
    }));
};

const normalizeSyncedLyrics = (lyrics = []) => {
  if (!Array.isArray(lyrics)) return [];

  return lyrics
    .filter((line) => line?.text && Number.isFinite(Number(line.start)))
    .map((line) => ({
      text: String(line.text),
      start: Number(line.start),
      end: Number.isFinite(Number(line.end)) ? Number(line.end) : null,
    }))
    .sort((a, b) => a.start - b.start)
    .map((line, index, lines) => ({
      ...line,
      end:
        Number(line.end) > line.start
          ? Number(line.end)
          : lines[index + 1]
          ? Math.max(lines[index + 1].start - 0.01, line.start + 0.01)
          : null,
    }));
};

const getSmoothLyrics = (song) => {
  const lrcLines = parseLrcLyrics(song?.lrcLyrics);
  if (lrcLines.length) return lrcLines;

  const syncedLines = normalizeSyncedLyrics(song?.syncedLyrics);
  if (syncedLines.length) return syncedLines;

  if (typeof song?.lyrics === "string" && song.lyrics.trim()) {
    return song.lyrics
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => ({
        text: line,
        start: index * 5,
        end: index * 5 + 4.99,
      }));
  }

  return [];
};

const createOrGetAudioGraph = async (audio) => {
  if (!audio) return null;

  const cached = audioGraphCache.get(audio);
  if (cached?.analyser) {
    if (cached.context.state === "suspended") {
      await cached.context.resume();
    }
    return cached;
  }

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;

  const context = new AudioContext();

  if (context.state === "suspended") {
    await context.resume();
  }

  const source = context.createMediaElementSource(audio);
  const analyser = context.createAnalyser();
  const output = context.createGain();

  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.72;
  output.gain.value = 1;

  // One single graph only: audio element -> analyser -> output -> speakers.
  // Do not create a second audio element and do not call play() here.
  source.connect(analyser);
  analyser.connect(output);
  output.connect(context.destination);

  const graph = { context, source, analyser, output };
  audioGraphCache.set(audio, graph);
  return graph;
};

const zeroLevels = {
  audio: 0,
  bass: 0,
  kick: 0,
  vocal: 0,
  presence: 0,
  fluid: 0,
};

const Visualizer = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { songId } = useParams();
  const { songs = [] } = useContext(MusicContext) || {};

  const {
    currentSong,
    playlist = [],
    isPlaying,
    isBuffering,
    bufferMessage,
    progress = 0,
    duration = 0,
    playSong,
    togglePlay,
    seekTo,
    shuffle,
    setShuffle,
    audioRef,
  } = useContext(MusicPlayerContext) || {};

  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const fullscreenRef = useRef(null);
  const lastKickTimeRef = useRef(0);
  const kickDecayRef = useRef(0);
  const bassBaselineRef = useRef(0.08);
  const vocalBaselineRef = useRef(0.08);
  const smoothedRef = useRef({ ...zeroLevels });
  const lastPaintRef = useRef(0);
  const lastCanvasPaintRef = useRef(0);
  const mountedRef = useRef(false);

  const [liveProgress, setLiveProgress] = useState(Number(progress) || 0);
  const [liveDuration, setLiveDuration] = useState(normalizeDuration(duration));
  const [levels, setLevels] = useState({ ...zeroLevels });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [queueChanging, setQueueChanging] = useState(false);

  const routeSong = useMemo(() => {
    if (currentSong?._id) return currentSong;
    if (location.state?.song?._id === songId) return location.state.song;

    return (
      songs.find((song) => song?._id === songId) ||
      location.state?.song ||
      null
    );
  }, [currentSong, location.state, songId, songs]);

  const queue = useMemo(() => {
    const stateQueue = Array.isArray(location.state?.playlist)
      ? location.state.playlist
      : [];

    const sourceQueue = stateQueue.length
      ? stateQueue
      : playlist?.length
      ? playlist
      : songs;

    return normalizeQueue(sourceQueue);
  }, [location.state, playlist, songs]);

  const activeQueueIndex = useMemo(() => {
    if (!queue.length || !routeSong?._id) return -1;
    return queue.findIndex((song) => song?._id === routeSong._id);
  }, [queue, routeSong?._id]);

  const totalDuration = useMemo(
    () => getAudioDuration(routeSong, duration, liveDuration),
    [routeSong, duration, liveDuration]
  );

  const progressMax = Math.max(totalDuration, liveProgress, 0);
  const progressPercent = progressMax ? (liveProgress / progressMax) * 100 : 0;

  const visualVars = {
    "--audio-level": levels.audio.toFixed(3),
    "--bass-level": levels.bass.toFixed(3),
    "--kick-level": levels.kick.toFixed(3),
    "--vocal-level": levels.vocal.toFixed(3),
    "--presence-level": levels.presence.toFixed(3),
    "--fluid-level": levels.fluid.toFixed(3),
    "--progress-percent": `${progressPercent}%`,
  };

  const syncedLyrics = useMemo(() => getSmoothLyrics(routeSong), [routeSong]);

  const activeLyricIndex = useMemo(() => {
    if (!syncedLyrics.length) return -1;

    const currentTime = Number(liveProgress) || 0;

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

    return syncedLyrics.findLastIndex((line) => currentTime >= (Number(line.start) || 0));
  }, [liveProgress, syncedLyrics]);

  const visibleLyrics = useMemo(() => {
    if (!syncedLyrics.length) return [];

    const currentIndex = Math.max(0, activeLyricIndex);
    return syncedLyrics.slice(currentIndex, currentIndex + 2);
  }, [activeLyricIndex, syncedLyrics]);

  const resetVisualLevels = useCallback(() => {
    kickDecayRef.current = 0;
    smoothedRef.current = { ...zeroLevels };
    setLevels({ ...zeroLevels });
  }, []);

  const handleBack = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      // Ignore fullscreen exit errors.
    }

    const fallbackPath = location.state?.from || `/song/${routeSong?._id || songId}`;

    // Important: do not call playSong here. SongDetails and Visualizer share the same audioRef.
    navigate(fallbackPath, {
      replace: true,
      state: {
        playlist: queue?.length ? queue : playlist,
        song: routeSong,
      },
    });
  }, [location.state, navigate, playlist, queue, routeSong, songId]);

  const navigateToVisualizerSong = useCallback(
    (song) => {
      if (!song?._id) return;

      navigate(`/visualizer/${song._id}`, {
        replace: true,
        state: {
          song,
          playlist: queue?.length ? queue : playlist,
          from: location.state?.from || `/song/${song._id}`,
        },
      });
    },
    [location.state, navigate, playlist, queue]
  );

  const playQueueSong = useCallback(
    async (targetSong) => {
      if (!targetSong?._id || typeof playSong !== "function") return;

      setQueueChanging(true);

      try {
        await playSong(targetSong, queue?.length ? queue : [targetSong]);
        setLiveProgress(0);
        navigateToVisualizerSong(targetSong);
      } finally {
        window.setTimeout(() => {
          if (mountedRef.current) setQueueChanging(false);
        }, 260);
      }
    },
    [navigateToVisualizerSong, playSong, queue]
  );

  const handleNextSong = useCallback(async () => {
    if (!queue.length || !routeSong?._id) return;

    const currentIndex = activeQueueIndex >= 0 ? activeQueueIndex : 0;
    const nextIndex = shuffle
      ? getRandomIndex(queue.length, currentIndex)
      : (currentIndex + 1) % queue.length;

    await playQueueSong(queue[nextIndex]);
  }, [activeQueueIndex, playQueueSong, queue, routeSong?._id, shuffle]);

  const handlePrevSong = useCallback(async () => {
    const audio = audioRef?.current;

    if (audio && Number(audio.currentTime) > 3) {
      seekTo?.(0);
      setLiveProgress(0);
      return;
    }

    if (!queue.length || !routeSong?._id) return;

    const currentIndex = activeQueueIndex >= 0 ? activeQueueIndex : 0;
    const previousIndex = currentIndex - 1 < 0 ? queue.length - 1 : currentIndex - 1;

    await playQueueSong(queue[previousIndex]);
  }, [activeQueueIndex, audioRef, playQueueSong, queue, routeSong?._id, seekTo]);

  // Follow the real player. Do not replay the song when the visualizer mounts.
  // Only start route song when there is no active player song at all.
  useEffect(() => {
    if (!routeSong?._id) return;
    if (currentSong?._id) return;
    if (typeof playSong !== "function") return;

    const audio = audioRef?.current;
    if (audio?.src || audio?.currentSrc) return;

    playSong(routeSong, queue?.length ? queue : [routeSong]);
  }, [audioRef, currentSong?._id, playSong, queue, routeSong]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Do not pause or disconnect the graph here. The player context owns playback.
    };
  }, []);

  useEffect(() => {
    setLiveProgress(Number(progress) || 0);
  }, [progress, routeSong?._id]);

  useEffect(() => {
    const audio = audioRef?.current;
    if (!audio) return;

    const syncProgress = () => {
      const currentTime = Number(audio.currentTime);
      if (Number.isFinite(currentTime)) setLiveProgress(currentTime);
    };

    const syncDuration = () => {
      const nextDuration = normalizeDuration(audio.duration);
      if (nextDuration) setLiveDuration(nextDuration);
    };

    const handlePauseOrEnded = () => {
      resetVisualLevels();
    };

    syncProgress();
    syncDuration();

    audio.addEventListener("timeupdate", syncProgress);
    audio.addEventListener("seeked", syncProgress);
    audio.addEventListener("loadedmetadata", syncDuration);
    audio.addEventListener("durationchange", syncDuration);
    audio.addEventListener("canplay", syncDuration);
    audio.addEventListener("pause", handlePauseOrEnded);
    audio.addEventListener("ended", handlePauseOrEnded);

    return () => {
      audio.removeEventListener("timeupdate", syncProgress);
      audio.removeEventListener("seeked", syncProgress);
      audio.removeEventListener("loadedmetadata", syncDuration);
      audio.removeEventListener("durationchange", syncDuration);
      audio.removeEventListener("canplay", syncDuration);
      audio.removeEventListener("pause", handlePauseOrEnded);
      audio.removeEventListener("ended", handlePauseOrEnded);
    };
  }, [audioRef, resetVisualLevels, routeSong?._id]);

  useEffect(() => {
    const audio = audioRef?.current;
    const canvas = canvasRef.current;
    if (!audio || !canvas) return;

    let stopped = false;
    const ctx = canvas.getContext("2d");
    const frequencyData = new Uint8Array(512);
    const timeData = new Uint8Array(512);

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);

      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const updateLevels = (next, now) => {
      const current = smoothedRef.current;
      const attack = 0.2;
      const release = 0.08;

      Object.keys(current).forEach((key) => {
        const target = clamp(next[key] || 0, 0, 1);
        const factor = target > current[key] ? attack : release;
        current[key] = current[key] + (target - current[key]) * factor;
      });

      if (now - lastPaintRef.current > 70) {
        lastPaintRef.current = now;
        setLevels({ ...current });
      }
    };

    const drawIdle = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.globalAlpha = 0.22;

      const bars = 46;
      const gap = rect.width < 390 ? 2 : 3;
      const barWidth = Math.max(2, (rect.width - gap * (bars - 1)) / bars);

      for (let index = 0; index < bars; index += 1) {
        const distance = Math.abs(index - bars / 2) / (bars / 2);
        const height = 8 + (1 - distance) * 24;
        ctx.fillStyle = "rgba(255,255,255,.55)";
        ctx.fillRect(index * (barWidth + gap), rect.height - height, barWidth, height);
      }

      ctx.globalAlpha = 1;
    };

    const drawReactiveCanvas = (visualLevels) => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      const bars = rect.width < 390 ? 32 : 42;
      const gap = rect.width < 390 ? 2 : 3;
      const barWidth = Math.max(2, (rect.width - gap * (bars - 1)) / bars);

      for (let index = 0; index < bars; index += 1) {
        const dataIndex = Math.floor((index / bars) * frequencyData.length);
        const raw = frequencyData[dataIndex] / 255;
        const vocalPush = visualLevels.vocal * (0.14 + Math.sin(index * 0.36) * 0.035);
        const kickPush = visualLevels.kick * (index % 3 === 0 ? 0.22 : 0.08);
        const value = clamp(raw * 1.2 + vocalPush + kickPush, 0, 1);
        const height = 7 + value * rect.height * 0.9;
        const x = index * (barWidth + gap);
        const y = rect.height - height;
        const gradient = ctx.createLinearGradient(0, y, 0, rect.height);

        gradient.addColorStop(0, "rgba(255,255,255,.98)");
        gradient.addColorStop(0.34, "rgba(103,245,255,.9)");
        gradient.addColorStop(0.66, "rgba(30,215,96,.76)");
        gradient.addColorStop(1, "rgba(255,43,122,.72)");

        ctx.globalAlpha = 0.34 + value * 0.66;
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth, height);
      }

      ctx.globalAlpha = 0.48 + visualLevels.vocal * 0.42;
      ctx.lineWidth = 2 + visualLevels.vocal * 4;
      ctx.strokeStyle = "rgba(255,255,255,.88)";
      ctx.beginPath();

      const slice = rect.width / timeData.length;
      for (let index = 0; index < timeData.length; index += 2) {
        const centered = (timeData[index] - 128) / 128;
        const x = index * slice;
        const y = rect.height * 0.5 + centered * rect.height * (0.18 + visualLevels.fluid * 0.22);

        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.globalAlpha = 1;
    };

    const render = async () => {
      if (stopped) return;

      const now = performance.now();
      const graph = await createOrGetAudioGraph(audio);
      const analyser = graph?.analyser;

      const audioReallyPlaying =
        !audio.paused &&
        !audio.ended &&
        audio.readyState >= 2 &&
        Boolean(isPlaying);

      if (audioReallyPlaying && analyser && now - lastCanvasPaintRef.current < 33) {
        animationFrameRef.current = requestAnimationFrame(render);
        return;
      }

      lastCanvasPaintRef.current = now;

      if (!audioReallyPlaying || !analyser) {
        kickDecayRef.current = 0;
        updateLevels(zeroLevels, now);
        drawIdle();
        animationFrameRef.current = requestAnimationFrame(render);
        return;
      }

      analyser.getByteFrequencyData(frequencyData);
      analyser.getByteTimeDomainData(timeData);

      const rms = calculateRms(timeData);
      const sub = averageRange(frequencyData, analyser, 28, 70);
      const kickBand = averageRange(frequencyData, analyser, 45, 145);
      const bassBand = averageRange(frequencyData, analyser, 45, 230);
      const bodyBand = averageRange(frequencyData, analyser, 160, 420);
      const vocalBand = averageRange(frequencyData, analyser, 280, 3400);
      const presenceBand = averageRange(frequencyData, analyser, 1800, 6200);
      const airBand = averageRange(frequencyData, analyser, 6200, 12000);
      const fullBand = averageRange(frequencyData, analyser, 25, 12000);

      const bassEnergy = clamp(sub * 0.48 + kickBand * 0.95 + bassBand * 0.55, 0, 1);
      const vocalEnergy = clamp(vocalBand * 1.25 + presenceBand * 0.48 + bodyBand * 0.18, 0, 1);
      const audioEnergy = clamp(fullBand * 1.55 + rms * 0.85, 0, 1);
      const presenceEnergy = clamp(presenceBand * 1.05 + airBand * 0.35, 0, 1);

      bassBaselineRef.current = bassBaselineRef.current * 0.955 + bassEnergy * 0.045;
      vocalBaselineRef.current = vocalBaselineRef.current * 0.965 + vocalEnergy * 0.035;

      const bassLift = Math.max(0, bassEnergy - bassBaselineRef.current);
      const kickCandidate = clamp(
        bassLift * 3.9 + Math.max(0, kickBand - bodyBand * 0.38) * 1.8 + sub * 0.22,
        0,
        1
      );

      if (kickCandidate > 0.16 && now - lastKickTimeRef.current > 78) {
        kickDecayRef.current = Math.max(kickDecayRef.current, kickCandidate);
        lastKickTimeRef.current = now;
      } else {
        kickDecayRef.current *= 0.84;
      }

      const vocalLift = Math.max(0, vocalEnergy - vocalBaselineRef.current);
      const fluidEnergy = clamp(
        rms * 0.95 + vocalEnergy * 0.5 + vocalLift * 1.3 + bassEnergy * 0.22 + kickDecayRef.current * 0.16,
        0,
        1
      );

      const nextLevels = {
        audio: audioEnergy,
        bass: bassEnergy,
        kick: kickDecayRef.current,
        vocal: vocalEnergy,
        presence: presenceEnergy,
        fluid: fluidEnergy,
      };

      updateLevels(nextLevels, now);
      drawReactiveCanvas(smoothedRef.current);

      animationFrameRef.current = requestAnimationFrame(render);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      stopped = true;
      window.removeEventListener("resize", resizeCanvas);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [audioRef, isPlaying]);

  useEffect(() => {
    const audio = audioRef?.current;
    if (!audio) return;

    audio.muted = muted;
  }, [audioRef, muted]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const handleSeek = (event) => {
    const value = clamp(Number(event.target.value), 0, progressMax || 0);
    setLiveProgress(value);
    seekTo?.(value);
  };

  const handleToggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await fullscreenRef.current?.requestFullscreen?.();
      }
    } catch (error) {
      console.warn("Fullscreen unavailable:", error);
    }
  };

  const handleShuffle = () => {
    setShuffle?.(!shuffle);
  };

  if (!routeSong) {
    return (
      <main className="visualizer-page visualizer-empty">
        <button
          type="button"
          className="visualizer-top-btn visualizer-back-btn"
          onClick={() => navigate("/")}
          aria-label="Go home"
        >
          <FaChevronLeft />
        </button>

        <h1>No song selected</h1>
        <p>Play a song first, then open the visualizer.</p>
      </main>
    );
  }

  return (
    <main className="visualizer-page" style={visualVars} ref={fullscreenRef}>
      <div className="visualizer-bg" aria-hidden="true">
        <img src={routeSong.imageUrl || "/fallback.jpg"} alt="" />
      </div>

      <div className="visualizer-tint" aria-hidden="true" />

      <header className="visualizer-topbar">
        <button
          type="button"
          className="visualizer-top-btn visualizer-back-btn"
          onClick={handleBack}
          aria-label="Go back"
        >
          <FaChevronLeft />
        </button>

        <div className="visualizer-title-mini">
          <strong>{routeSong.title}</strong>
          <span>{getArtistName(routeSong)}</span>
        </div>

        <button
          type="button"
          className="visualizer-top-btn"
          onClick={handleToggleFullscreen}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? <FaCompress /> : <FaExpand />}
        </button>
      </header>

      <section className="visualizer-stage" aria-label="Audio visualizer">
        <div className="fluid-field" aria-hidden="true">
          <span className="fluid-orb orb-one" />
          <span className="fluid-orb orb-two" />
          <span className="fluid-orb orb-three" />
        </div>

        <div
          className={`visualizer-orbit ${isPlaying && levels.audio > 0.02 ? "slow-spin" : ""}`}
          aria-hidden="true"
        />

        <div className={`visualizer-blob ${isPlaying && levels.audio > 0.02 ? "playing" : ""}`}>
          <img src={routeSong.imageUrl || "/fallback.jpg"} alt={`${routeSong.title} cover`} />
          <span className="blob-ring ring-one" aria-hidden="true" />
          <span className="blob-ring ring-two" aria-hidden="true" />
          <span className="vocal-ring vocal-ring-one" aria-hidden="true" />
          <span className="vocal-ring vocal-ring-two" aria-hidden="true" />
        </div>

        <div className="vocal-wave" aria-hidden="true">
          {Array.from({ length: 18 }).map((_, index) => (
            <span key={index} style={{ "--wave-index": index }} />
          ))}
        </div>

        <div className="visualizer-copy">
          <p>
            {queueChanging
              ? "Changing track..."
              : isBuffering
              ? bufferMessage || "Buffering..."
              : "Smooth Pulse Mode"}
          </p>
          <h1>{routeSong.title}</h1>
          <span>{getArtistName(routeSong)}</span>
        </div>

        <div className="smooth-lyric-panel" aria-live="polite">
          {visibleLyrics.length ? (
            visibleLyrics.map((line, index) => (
              <p
                key={`${line.start}-${line.text}-${index}`}
                className={index === 0 ? "active" : "next"}
              >
                {line.text}
              </p>
            ))
          ) : (
            <>
              <p className="active">No synced lyrics available</p>
              <p className="next">Add LRC or synced lyrics to show them here.</p>
            </>
          )}
        </div>
      </section>

      <canvas className="visualizer-canvas" ref={canvasRef} aria-hidden="true" />

      <footer className="visualizer-control-deck" aria-label="Visualizer player controls">
        <div className="visualizer-time-row">
          <time>{formatTime(liveProgress)}</time>

          <input
            type="range"
            min="0"
            max={progressMax || 0}
            step="0.01"
            value={clamp(liveProgress, 0, progressMax || 0)}
            onChange={handleSeek}
            aria-label="Song progress"
          />

          <time>{formatTime(totalDuration)}</time>
        </div>

        <div className="visualizer-buttons">
          <button
            type="button"
            className={`visualizer-round-btn ${shuffle ? "active" : ""}`}
            onClick={handleShuffle}
            aria-label="Shuffle"
            aria-pressed={Boolean(shuffle)}
          >
            <FaRandom />
          </button>

          <button
            type="button"
            className="visualizer-round-btn"
            onClick={handlePrevSong}
            disabled={queueChanging}
            aria-label="Previous song in queue"
          >
            <FaStepBackward />
          </button>

          <button
            type="button"
            className={`visualizer-play-btn ${isBuffering ? "loading" : ""}`}
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isBuffering ? (
              <span className="visualizer-loader" />
            ) : isPlaying ? (
              <FaPause />
            ) : (
              <FaPlay />
            )}
          </button>

          <button
            type="button"
            className="visualizer-round-btn"
            onClick={handleNextSong}
            disabled={queueChanging}
            aria-label="Next song in queue"
          >
            <FaStepForward />
          </button>

          <button
            type="button"
            className={`visualizer-round-btn ${muted ? "active" : ""}`}
            onClick={() => setMuted((prev) => !prev)}
            aria-label={muted ? "Unmute" : "Mute"}
            aria-pressed={muted}
          >
            {muted ? <FaVolumeMute /> : <FaVolumeUp />}
          </button>
        </div>
      </footer>
    </main>
  );
};

export default Visualizer;
