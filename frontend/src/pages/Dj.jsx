import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaBackward,
  FaBolt,
  FaBomb,
  FaBroadcastTower,
  FaBullhorn,
  FaCog,
  FaCompactDisc,
  FaDownload,
  FaDrum,
  FaExclamationTriangle,
  FaFilter,
  FaHeadphones,
  FaKeyboard,
  FaMicrophone,
  FaPause,
  FaPlay,
  FaRandom,
  FaRecordVinyl,
  FaRedo,
  FaRetweet,
  FaSearch,
  FaSlidersH,
  FaStop,
  FaSyncAlt,
  FaTag,
  FaUndo,
  FaUsers,
  FaVolumeMute,
  FaVolumeUp,
  FaWind,
} from "react-icons/fa";
import { Howl, Howler } from "howler";
import WaveSurfer from "wavesurfer.js";
import { MusicContext } from "../context/ShopContext";
import "bootstrap/dist/css/bootstrap.min.css";
import "./CSS/Dj.css";

const SFX_MAX_PLAY_MS = 12000;
const sfx = (fileName) => `/sfx/${fileName}`;

const djPads = [
  { id: "airhorn", name: "Air Horn", icon: FaBullhorn, type: "horn", sample: sfx("airhorn.mp3") },
  { id: "scratch", name: "Scratch", icon: FaCompactDisc, type: "scratch", sample: sfx("scratch.mp3") },
  { id: "laser", name: "Laser", icon: FaBolt, type: "laser", sample: sfx("lazer.mp3") },
  { id: "drop", name: "Bass Drop", icon: FaBomb, type: "drop", sample: sfx("bass-drop.mp3") },
  { id: "crowd", name: "Crowd", icon: FaUsers, type: "crowd", sample: sfx("crowd.mp3") },
  { id: "rewind", name: "Rewind", icon: FaBackward, type: "rewind", sample: sfx("rewind.mp3") },
  { id: "siren", name: "Siren", icon: FaExclamationTriangle, type: "siren", sample: sfx("siren.mp3") },
  { id: "tag", name: "DJ Tag", icon: FaTag, type: "tag", sample: sfx("dj-tag.mp3") },
  { id: "impact", name: "Impact", icon: FaBolt, type: "drop", sample: sfx("impact.mp3") },
  { id: "vinylstop", name: "Vinyl Stop", icon: FaStop, type: "rewind", sample: sfx("vinyl-stop.mp3") },
  { id: "transition", name: "Sweep", icon: FaWind, type: "laser", sample: sfx("sweep.mp3") },
  { id: "noise", name: "Noise", icon: FaVolumeUp, type: "crowd", sample: sfx("noise.mp3") },
];

const fxButtons = [
  { id: "echo", name: "Echo", icon: FaVolumeUp, sample: sfx("sweep.mp3") },
  { id: "reverb", name: "Reverb", icon: FaBroadcastTower, sample: sfx("noise.mp3") },
  { id: "filter", name: "Filter", icon: FaFilter, sample: sfx("sweep.mp3") },
  { id: "flanger", name: "Flanger", icon: FaCog, sample: sfx("whoosh.mp3") },
  { id: "brake", name: "Brake", icon: FaStop, sample: sfx("vinyl-stop.mp3") },
  { id: "roll", name: "Roll", icon: FaRetweet, sample: sfx("beat.mp3") },
  { id: "siren", name: "Siren", icon: FaExclamationTriangle, sample: sfx("siren.mp3") },
  { id: "whoosh", name: "Whoosh", icon: FaWind, sample: sfx("whoosh.mp3") },
  { id: "stutter", name: "Stutter", icon: FaBolt, sample: sfx("scratch.mp3") },
];

const stemButtons = [
  { id: "vocal", name: "Vocal", icon: FaMicrophone, sample: sfx("yes.mp3") },
  { id: "drums", name: "Drums", icon: FaDrum, sample: sfx("drums.mp3") },
  { id: "bass", name: "Bass", icon: FaSlidersH, sample: sfx("bass-drop.mp3") },
  { id: "music", name: "Music", icon: FaKeyboard, sample: sfx("piano.mp3") },
];

const loopSizes = ["1/2", "1", "2", "4"];

const classicLeftButtons = [
  { id: "piano", name: "Piano", type: "tone", tone: 523, sample: sfx("piano.mp3") },
  { id: "yes", name: "YES", type: "tag", sample: sfx("yes.mp3") },
  { id: "pick", name: "Pick", type: "click", sample: sfx("pick.mp3") },
  { id: "duing", name: "Duing", type: "laser", sample: sfx("lazer.mp3") },
  { id: "squeak", name: "Squeak", type: "squeak", sample: sfx("squeak.mp3") },
  { id: "scratch-mini", name: "Scratch", type: "scratch", sample: sfx("scratch.mp3") },
];

const classicRightButtons = [
  { id: "book", name: "Book", type: "click", sample: sfx("book.mp3") },
  { id: "pick2", name: "Pick", type: "click", sample: sfx("pick.mp3") },
  { id: "walker", name: "Walker", type: "hey", sample: sfx("walker.mp3") },
  { id: "whoosh", name: "Whoosh", type: "whoosh", sample: sfx("whoosh.mp3") },
  { id: "drums", name: "Drums", type: "beat", sample: sfx("drums.mp3") },
  { id: "beat", name: "Beat", type: "beat", sample: sfx("beat.mp3") },
];

const classicAllButtons = [...classicLeftButtons, ...classicRightButtons];

const classicColorPads = [
  { id: "hat-a", name: "Hi Hat", type: "hihat", color: "pink", sample: sfx("hihat.mp3") },
  { id: "trouble-a", name: "Trouble", type: "trouble", color: "lime", sample: sfx("trouble.mp3") },
  { id: "laser-a", name: "Lazer", type: "laser", color: "orange", sample: sfx("lazer.mp3") },
  { id: "hat-b", name: "Hi Hat", type: "hihat", color: "yellow", sample: sfx("hihat.mp3") },
  { id: "trouble-b", name: "Trouble", type: "trouble", color: "green", sample: sfx("trouble.mp3") },
  { id: "laser-b", name: "Lazer", type: "laser", color: "blue", sample: sfx("lazer.mp3") },
];

const clamp = (value, min, max) => {
  return Math.min(max, Math.max(min, Number(value) || 0));
};

const formatTime = (seconds = 0) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

const getAudioFormat = (url) => {
  if (!url) return ["mp3"];

  const cleanUrl = String(url).split("?")[0].toLowerCase();

  if (cleanUrl.endsWith(".wav")) return ["wav"];
  if (cleanUrl.endsWith(".ogg")) return ["ogg"];
  if (cleanUrl.endsWith(".m4a")) return ["m4a", "mp4"];
  if (cleanUrl.endsWith(".aac")) return ["aac"];
  if (cleanUrl.endsWith(".mp4")) return ["mp4"];

  return ["mp3"];
};

const hasSoundId = (soundId) => {
  return soundId !== null && soundId !== undefined;
};

const WAVE_STATUS_LABELS = {
  empty: "No waveform yet",
  loading: "Loading waveform...",
  ready: "Waveform ready",
  fallback: "Waveform unavailable",
  error: "Waveform error",
};

const getCrossfaderBalanceLabel = (value) => {
  const amount = clamp(value, 0, 100);
  if (amount <= 35) return "Deck A";
  if (amount >= 65) return "Deck B";
  return "A + B";
};

const Dj = () => {
  const navigate = useNavigate();
  const { songs = [] } = useContext(MusicContext) || {};

  const deckHowlsRef = useRef({ A: null, B: null });
  const deckSoundIdsRef = useRef({ A: null, B: null });
  const progressTimerRef = useRef(null);
  const mountedRef = useRef(false);
  const activeTimeoutsRef = useRef(new Set());
  const mixerStateRef = useRef(null);
  const deckLoadTokensRef = useRef({ A: 0, B: 0 });
  const waveTrackKeysRef = useRef({ A: null, B: null });
  const recordingUrlRef = useRef("");
  const sfxHowlsRef = useRef({});
  const sfxStopTimersRef = useRef({});

  const waveContainersRef = useRef({ A: null, B: null });
  const waveSurfersRef = useRef({ A: null, B: null });
  const waveSyncingRef = useRef({ A: false, B: false });
  const waveCreateTimerRef = useRef({ A: null, B: null });

  const recordingDestinationRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  const scratchRef = useRef({
    active: false,
    side: null,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
  });

  const [deckA, setDeckA] = useState(null);
  const [deckB, setDeckB] = useState(null);

  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);

  const [errorA, setErrorA] = useState("");
  const [errorB, setErrorB] = useState("");

  const [playingA, setPlayingA] = useState(false);
  const [playingB, setPlayingB] = useState(false);

  const [volumeA, setVolumeA] = useState(88);
  const [volumeB, setVolumeB] = useState(88);

  const [pitchA, setPitchA] = useState(0);
  const [pitchB, setPitchB] = useState(0);

  const [gainA, setGainA] = useState(50);
  const [gainB, setGainB] = useState(50);

  const [lowA, setLowA] = useState(50);
  const [midA, setMidA] = useState(50);
  const [highA, setHighA] = useState(50);

  const [lowB, setLowB] = useState(50);
  const [midB, setMidB] = useState(50);
  const [highB, setHighB] = useState(50);

  const [crossfader, setCrossfader] = useState(50);

  const [progressA, setProgressA] = useState(0);
  const [progressB, setProgressB] = useState(0);

  const [timeA, setTimeA] = useState(0);
  const [timeB, setTimeB] = useState(0);
  const [durationA, setDurationA] = useState(0);
  const [durationB, setDurationB] = useState(0);

  const [cuePoints, setCuePoints] = useState({ A: {}, B: {} });

  const [searchTerm, setSearchTerm] = useState("");
  const [visibleSongCount, setVisibleSongCount] = useState(10);
  const [activePad, setActivePad] = useState("");
  const [activeFx, setActiveFx] = useState("");
  const [activeLoop, setActiveLoop] = useState("");
  const [activeStem, setActiveStem] = useState("");
  const [fxTarget, setFxTarget] = useState("AB");
  const [mobileView, setMobileView] = useState("A");

  const [waveStatusA, setWaveStatusA] = useState("empty");
  const [waveStatusB, setWaveStatusB] = useState("empty");

  const [isRecording, setIsRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState("");
  const [recordingError, setRecordingError] = useState("");

  useEffect(() => {
    recordingUrlRef.current = recordingUrl;
  }, [recordingUrl]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      activeTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      activeTimeoutsRef.current.clear();
      Object.values(sfxStopTimersRef.current).forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      sfxStopTimersRef.current = {};
      Object.values(sfxHowlsRef.current).forEach((sound) => {
        try {
          sound.stop();
          sound.unload();
        } catch (error) {
          console.log("SFX cleanup error:", error);
        }
      });
      sfxHowlsRef.current = {};
    };
  }, []);

  const getSongImage = (song) => {
    return (
      song?.imageUrl ||
      song?.image ||
      song?.coverImage ||
      song?.thumbnail ||
      song?.album?.image ||
      song?.album?.coverImage ||
      "/fallback-cover.png"
    );
  };

  const getSongAudio = (song) => {
    return (
      song?.audioUrl ||
      song?.audio ||
      song?.fileUrl ||
      song?.url ||
      song?.src ||
      song?.previewUrl ||
      null
    );
  };

  const getSongTitle = (song) => {
    const title = song?.title || song?.name;
    return title === undefined || title === null ? "Load Track" : String(title);
  };

  const getArtistName = (song) => {
    const artist = song?.artist;
    if (!artist) return "Choose from library";
    if (typeof artist === "string" || typeof artist === "number") return String(artist);
    if (Array.isArray(artist)) {
      return (
        artist
          .map((item) =>
            typeof item === "string"
              ? item
              : item?.name || item?.artistName || item?.title || ""
          )
          .filter(Boolean)
          .join(", ") || "Unknown Artist"
      );
    }

    return String(artist.name || artist.artistName || artist.title || "Unknown Artist");
  };

  const getSongBpm = (song) => {
    return song?.bpm || song?.tempo || song?.metadata?.bpm || 128;
  };

  const getSongKey = (song) => {
    return song?._id || song?.id || getSongAudio(song) || getSongTitle(song);
  };

  const isSameSong = (one, two) => {
    return Boolean(one && two && getSongKey(one) === getSongKey(two));
  };

  const safeSongs = useMemo(() => (Array.isArray(songs) ? songs : []), [songs]);

  const filteredSongs = useMemo(() => {
    const search = String(searchTerm || "").toLowerCase().trim();

    return safeSongs.filter((song) => {
      const title = String(getSongTitle(song) || "").toLowerCase();
      const artist = String(getArtistName(song) || "").toLowerCase();

      return title.includes(search) || artist.includes(search);
    });
  }, [safeSongs, searchTerm]);

  const visibleSongs = useMemo(
    () => filteredSongs.slice(0, visibleSongCount),
    [filteredSongs, visibleSongCount]
  );

  const hasMoreSongs = visibleSongCount < filteredSongs.length;

  useEffect(() => {
    setVisibleSongCount(10);
  }, [searchTerm]);

  const getAudioContext = () => {
    return Howler.ctx || null;
  };

  const unlockAudio = async () => {
    try {
      Howler.autoUnlock = true;

      if (Howler.ctx?.state === "suspended") {
        await Howler.ctx.resume();
      }
    } catch (error) {
      console.log("Audio unlock error:", error);
    }
  };

  const getDeckHowl = (side) => {
    return deckHowlsRef.current[side];
  };

  const getDeckSoundId = (side) => {
    return deckSoundIdsRef.current[side];
  };

  const scheduleTimeout = (callback, delay) => {
    const timeoutId = window.setTimeout(() => {
      activeTimeoutsRef.current.delete(timeoutId);
      if (mountedRef.current) callback();
    }, delay);

    activeTimeoutsRef.current.add(timeoutId);
    return timeoutId;
  };

  const clearScheduledTimeout = (timeoutId) => {
    if (!timeoutId) return;
    window.clearTimeout(timeoutId);
    activeTimeoutsRef.current.delete(timeoutId);
  };

  const stopSfxTimer = (key) => {
    const timerId = sfxStopTimersRef.current[key];
    if (!timerId) return;

    window.clearTimeout(timerId);
    delete sfxStopTimersRef.current[key];
  };

  const playSfxSample = async (item, options = {}) => {
    if (!item?.sample) return false;

    await unlockAudio();

    const key = item.sample;
    const maxPlayMs = options.maxPlayMs || SFX_MAX_PLAY_MS;
    const sampleVolume = options.volume ?? 0.95;

    try {
      if (!sfxHowlsRef.current[key]) {
        sfxHowlsRef.current[key] = new Howl({
          src: [item.sample],
          html5: false,
          preload: true,
          volume: sampleVolume,
        });
      }

      const sound = sfxHowlsRef.current[key];

      stopSfxTimer(key);
      sound.stop();
      sound.volume(sampleVolume);

      const soundId = sound.play();

      sfxStopTimersRef.current[key] = window.setTimeout(() => {
        try {
          sound.fade(sampleVolume, 0, 180, soundId);

          window.setTimeout(() => {
            sound.stop(soundId);
            sound.volume(sampleVolume, soundId);
          }, 200);
        } catch (error) {
          sound.stop(soundId);
        } finally {
          delete sfxStopTimersRef.current[key];
        }
      }, maxPlayMs);

      return true;
    } catch (error) {
      console.log("SFX sample error:", error);
      return false;
    }
  };

  const setDeckPlaying = (side, value) => {
    if (!mountedRef.current) return;
    if (side === "A") setPlayingA(value);
    else setPlayingB(value);
  };

  const setDeckLoading = (side, value) => {
    if (!mountedRef.current) return;
    if (side === "A") setLoadingA(value);
    else setLoadingB(value);
  };

  const setDeckError = (side, value) => {
    if (!mountedRef.current) return;
    if (side === "A") setErrorA(value);
    else setErrorB(value);
  };

  const getLatestDeckData = (side) => {
    const state = mixerStateRef.current;

    if (!state) {
      return side === "A"
        ? {
            deck: deckA,
            volume: volumeA,
            gain: gainA,
            low: lowA,
            mid: midA,
            high: highA,
            pitch: pitchA,
            crossfader,
          }
        : {
            deck: deckB,
            volume: volumeB,
            gain: gainB,
            low: lowB,
            mid: midB,
            high: highB,
            pitch: pitchB,
            crossfader,
          };
    }

    return side === "A"
      ? {
          deck: state.deckA,
          volume: state.volumeA,
          gain: state.gainA,
          low: state.lowA,
          mid: state.midA,
          high: state.highA,
          pitch: state.pitchA,
          crossfader: state.crossfader,
        }
      : {
          deck: state.deckB,
          volume: state.volumeB,
          gain: state.gainB,
          low: state.lowB,
          mid: state.midB,
          high: state.highB,
          pitch: state.pitchB,
          crossfader: state.crossfader,
        };
  };

  const getDeckFinalVolume = (side) => {
    const { volume, gain, low, mid, high, crossfader: latestCrossfader } =
      getLatestDeckData(side);

    const position = clamp(latestCrossfader, 0, 100) / 100;
    const fadePower =
      side === "A"
        ? Math.cos(position * (Math.PI / 2))
        : Math.sin(position * (Math.PI / 2));

    const volumeAmount = clamp(volume, 0, 100) / 100;
    const gainAmount = clamp(gain, 0, 100) / 50;
    const eqMovement =
      (clamp(low, 0, 100) -
        50 +
        clamp(mid, 0, 100) -
        50 +
        clamp(high, 0, 100) -
        50) /
      500;
    const eqTrim = clamp(1 + eqMovement, 0.65, 1.25);

    return clamp(volumeAmount * gainAmount * fadePower * eqTrim, 0, 1);
  };

  const getSideRate = (side) => {
    const { pitch } = getLatestDeckData(side);
    return clamp(1 + clamp(pitch, -50, 50) / 100, 0.5, 1.5);
  };

  const isSoundIdValid = (sound, soundId) => {
    if (!sound || !hasSoundId(soundId)) return false;
    if (!Array.isArray(sound._sounds)) return true;
    return sound._sounds.some((item) => item?._id === soundId);
  };

  const getValidSoundId = (side) => {
    const sound = getDeckHowl(side);
    const soundId = getDeckSoundId(side);
    return isSoundIdValid(sound, soundId) ? soundId : null;
  };

  const isDeckCurrentSound = (side, sound, token) => {
    return (
      mountedRef.current &&
      deckHowlsRef.current[side] === sound &&
      deckLoadTokensRef.current[side] === token
    );
  };

  const setSoundVolume = (side, volume, explicitSoundId) => {
    const sound = getDeckHowl(side);
    if (!sound) return;

    const safeVolume = clamp(volume, 0, 1);
    const soundId = hasSoundId(explicitSoundId)
      ? explicitSoundId
      : getValidSoundId(side);

    try {
      if (isSoundIdValid(sound, soundId)) {
        sound.volume(safeVolume, soundId);
        return;
      }

      sound.volume(safeVolume);
    } catch (error) {
      console.log(`Volume apply failed on deck ${side}:`, error);
    }
  };

  const applyDeckControls = (side) => {
    const sides = side ? [side] : ["A", "B"];

    sides.forEach((currentSide) => {
      const sound = getDeckHowl(currentSide);
      if (!sound) return;

      const soundId = getValidSoundId(currentSide);
      const finalVolume = getDeckFinalVolume(currentSide);
      const finalRate = getSideRate(currentSide);

      try {
        setSoundVolume(currentSide, finalVolume, soundId);

        if (isSoundIdValid(sound, soundId)) {
          sound.rate(finalRate, soundId);
        } else {
          sound.rate(finalRate);
        }
      } catch (error) {
        console.log(`Apply controls failed on deck ${currentSide}:`, error);
      }
    });
  };

  const applyAllDeckControls = () => applyDeckControls();

  useEffect(() => {
    mixerStateRef.current = {
      deckA,
      deckB,
      volumeA,
      volumeB,
      gainA,
      gainB,
      lowA,
      lowB,
      midA,
      midB,
      highA,
      highB,
      pitchA,
      pitchB,
      crossfader,
    };

    applyAllDeckControls();
  }, [
    deckA,
    deckB,
    volumeA,
    volumeB,
    gainA,
    gainB,
    lowA,
    lowB,
    midA,
    midB,
    highA,
    highB,
    crossfader,
    pitchA,
    pitchB,
  ]);

  const setWaveStatus = (side, status) => {
    if (side === "A") {
      setWaveStatusA(status);
    } else {
      setWaveStatusB(status);
    }
  };

  const destroyWaveform = (side) => {
    if (waveCreateTimerRef.current[side]) {
      clearScheduledTimeout(waveCreateTimerRef.current[side]);
      waveCreateTimerRef.current[side] = null;
    }

    if (waveSurfersRef.current[side]) {
      try {
        waveSurfersRef.current[side].destroy();
      } catch (error) {
        console.log(`Waveform destroy failed on ${side}:`, error);
      }
    }

    waveSurfersRef.current[side] = null;
    waveTrackKeysRef.current[side] = null;
    setWaveStatus(side, "empty");
  };

  const syncWaveformToTime = (side, currentTime, duration) => {
    const wave = waveSurfersRef.current[side];

    if (!wave || !duration) return;

    try {
      waveSyncingRef.current[side] = true;
      wave.seekTo(clamp(currentTime / duration, 0, 1));

      scheduleTimeout(() => {
        waveSyncingRef.current[side] = false;
      }, 40);
    } catch {
      waveSyncingRef.current[side] = false;
    }
  };

  const seekDeck = (side, value) => {
    const sound = getDeckHowl(side);

    if (!sound) return;

    const duration = sound.duration();

    if (!duration) return;

    const nextTime = (Number(value) / 100) * duration;

    const soundId = getValidSoundId(side);
    if (hasSoundId(soundId)) sound.seek(nextTime, soundId);
    else sound.seek(nextTime);

    applyDeckControls(side);
    syncWaveformToTime(side, nextTime, duration);

    if (side === "A") {
      setProgressA(Number(value));
      setTimeA(nextTime);
    } else {
      setProgressB(Number(value));
      setTimeB(nextTime);
    }
  };

  const createWaveform = (side, song) => {
    const audioUrl = getSongAudio(song);
    const container = waveContainersRef.current[side];

    if (!audioUrl) {
      setWaveStatus(side, "error");
      return;
    }

    if (!container) {
      waveCreateTimerRef.current[side] = scheduleTimeout(() => {
        createWaveform(side, song);
      }, 150);
      return;
    }

    const nextWaveKey = getSongKey(song);

    if (waveSurfersRef.current[side] && waveTrackKeysRef.current[side] === nextWaveKey) {
      return;
    }

    destroyWaveform(side);
    waveTrackKeysRef.current[side] = nextWaveKey;
    setWaveStatus(side, "loading");

    waveCreateTimerRef.current[side] = scheduleTimeout(() => {
      const readyContainer = waveContainersRef.current[side];

      if (!readyContainer) {
        setWaveStatus(side, "error");
        return;
      }

      try {
        const wave = WaveSurfer.create({
          container: readyContainer,
          url: audioUrl,
          height: 58,
          waveColor: "rgba(255, 255, 255, 0.3)",
          progressColor: "#30ffc8",
          cursorColor: "#ffffff",
          cursorWidth: 1,
          barWidth: 2,
          barGap: 1,
          barRadius: 2,
          normalize: true,
          interact: true,
          backend: "MediaElement",
          mediaControls: false,
          autoplay: false,
          muted: true,
        });

        wave.on("ready", () => {
          const waveDuration = Number(wave.getDuration()) || 0;

          if (!mountedRef.current || waveSurfersRef.current[side] !== wave) return;
          setWaveStatus(side, "ready");

          if (side === "A") {
            setDurationA((current) => current || waveDuration);
          } else {
            setDurationB((current) => current || waveDuration);
          }
        });

        wave.on("interaction", () => {
          if (waveSyncingRef.current[side]) return;

          const sound = getDeckHowl(side);

          if (!sound) return;

          const duration = sound.duration();

          if (!duration) return;

          const newTime = wave.getCurrentTime() || 0;
          const percentage = clamp((newTime / duration) * 100, 0, 100);

          seekDeck(side, percentage);
        });

        wave.on("error", (error) => {
          console.log(`Waveform error on deck ${side}:`, error);
          if (mountedRef.current && waveSurfersRef.current[side] === wave) {
            setWaveStatus(side, "fallback");
          }
        });

        waveSurfersRef.current[side] = wave;
      } catch (error) {
        console.log(`Waveform create failed on deck ${side}:`, error);
        if (mountedRef.current) setWaveStatus(side, "fallback");
      }
    }, 150);
  };

  const unloadDeck = (side, options = {}) => {
    const oldSound = getDeckHowl(side);

    if (oldSound) {
      try {
        oldSound.stop();
        oldSound.unload();
      } catch (error) {
        console.log(`Unload deck ${side} error:`, error);
      }
    }

    destroyWaveform(side);

    if (!options.keepToken) {
      deckLoadTokensRef.current[side] += 1;
    }

    deckHowlsRef.current[side] = null;
    deckSoundIdsRef.current[side] = null;

    if (!mountedRef.current) return;

    if (side === "A") {
      setPlayingA(false);
      setProgressA(0);
      setTimeA(0);
      setDurationA(0);
      setLoadingA(false);
      setErrorA("");
    } else {
      setPlayingB(false);
      setProgressB(0);
      setTimeB(0);
      setDurationB(0);
      setLoadingB(false);
      setErrorB("");
    }
  };

  const createDeckHowl = (side, song, token = deckLoadTokensRef.current[side]) => {
    const audioUrl = getSongAudio(song);

    if (!audioUrl) {
      setDeckError(side, "This track has no audio URL.");
      setDeckLoading(side, false);
      return null;
    }

    setDeckLoading(side, true);
    setDeckError(side, "");

    let sound;

    try {
      sound = new Howl({
        src: [audioUrl],
        html5: false,
        preload: true,
        format: getAudioFormat(audioUrl),
        volume: getDeckFinalVolume(side),
        rate: getSideRate(side),
        pool: 1,
        onload: () => {
          if (!isDeckCurrentSound(side, sound, token)) return;

          const duration = sound.duration() || 0;
          setDeckLoading(side, false);
          setDeckError(side, "");

          if (side === "A") setDurationA(duration);
          else setDurationB(duration);

          applyDeckControls(side);
        },
        onloaderror: (_, error) => {
          if (!isDeckCurrentSound(side, sound, token)) return;
          console.log(`Deck ${side} load failed:`, error);

          setDeckLoading(side, false);
          setDeckError(
            side,
            "Audio could not preload. Press Play again, or check the audio URL/CORS."
          );
        },
        onplay: (soundId) => {
          if (!isDeckCurrentSound(side, sound, token)) return;

          deckSoundIdsRef.current[side] = soundId;
          setDeckPlaying(side, true);
          setDeckLoading(side, false);
          setDeckError(side, "");
          applyDeckControls(side);
        },
        onplayerror: (_, error) => {
          if (!isDeckCurrentSound(side, sound, token)) return;
          console.log(`Deck ${side} play error:`, error);

          setDeckPlaying(side, false);
          setDeckLoading(side, false);
          setDeckError(side, "Could not play. Check audio URL, CORS, or file format.");
        },
        onpause: (soundId) => {
          if (!isDeckCurrentSound(side, sound, token)) return;
          if (deckSoundIdsRef.current[side] === soundId) {
            setDeckPlaying(side, false);
            applyDeckControls(side);
          }
        },
        onstop: (soundId) => {
          if (!isDeckCurrentSound(side, sound, token)) return;
          if (!hasSoundId(soundId) || deckSoundIdsRef.current[side] === soundId) {
            setDeckPlaying(side, false);
            applyDeckControls(side);
          }
        },
        onend: (soundId) => {
          if (!isDeckCurrentSound(side, sound, token)) return;
          if (hasSoundId(soundId) && deckSoundIdsRef.current[side] !== soundId) return;

          deckSoundIdsRef.current[side] = null;
          setDeckPlaying(side, false);

          if (side === "A") {
            setProgressA(0);
            setTimeA(0);
          } else {
            setProgressB(0);
            setTimeB(0);
          }

          syncWaveformToTime(side, 0, sound.duration() || 1);
        },
      });
    } catch (error) {
      console.log(`Deck ${side} create failed:`, error);
      setDeckPlaying(side, false);
      setDeckLoading(side, false);
      setDeckError(
        side,
        "Could not create audio player. Check the audio URL/CORS or browser support."
      );

      return null;
    }

    if (deckLoadTokensRef.current[side] !== token) {
      try {
        sound.unload();
      } catch {
        // Ignore unload errors for a stale deck load.
      }
      return null;
    }

    deckHowlsRef.current[side] = sound;
    applyDeckControls(side);

    return sound;
  };

  const loadToDeck = async (song, side) => {
    await unlockAudio();

    const token = deckLoadTokensRef.current[side] + 1;
    deckLoadTokensRef.current[side] = token;

    unloadDeck(side, { keepToken: true });

    if (!mountedRef.current) return;

    if (side === "A") {
      setDeckA(song);
      setWaveStatusA("loading");
    } else {
      setDeckB(song);
      setWaveStatusB("loading");
    }

    setCuePoints((current) => ({
      ...current,
      [side]: {},
    }));

    scheduleTimeout(() => {
      if (deckLoadTokensRef.current[side] !== token) return;
      createDeckHowl(side, song, token);
      createWaveform(side, song);
    }, 80);
  };

  const resumeDeck = (side) => {
    const sound = getDeckHowl(side);
    const soundId = getValidSoundId(side);

    if (!sound || !hasSoundId(soundId)) return false;

    try {
      if (sound.playing(soundId)) {
        applyDeckControls(side);
        setDeckPlaying(side, true);
        return true;
      }

      setSoundVolume(side, getDeckFinalVolume(side), soundId);
      sound.rate(getSideRate(side), soundId);
      sound.play(soundId);
      deckSoundIdsRef.current[side] = soundId;
      applyDeckControls(side);
      setDeckPlaying(side, true);
      return true;
    } catch (error) {
      console.log(`Deck ${side} resume failed:`, error);
      return false;
    }
  };

  const playDeck = async (side) => {
    await unlockAudio();

    const { deck } = getLatestDeckData(side);

    if (!deck) {
      setDeckError(side, `Load a song into Deck ${side} first.`);
      return;
    }

    let sound = getDeckHowl(side);

    if (!sound) {
      sound = createDeckHowl(side, deck, deckLoadTokensRef.current[side]);
    }

    if (!sound) return;

    if (resumeDeck(side)) return;

    try {
      const currentId = getValidSoundId(side);
      if (hasSoundId(currentId) && sound.playing(currentId)) {
        applyDeckControls(side);
        setDeckPlaying(side, true);
        return;
      }

      const finalVolume = getDeckFinalVolume(side);
      const finalRate = getSideRate(side);

      sound.volume(finalVolume);
      sound.rate(finalRate);

      const id = sound.play();
      deckSoundIdsRef.current[side] = id;

      setSoundVolume(side, finalVolume, id);
      if (hasSoundId(id)) sound.rate(finalRate, id);

      setDeckPlaying(side, true);
      setDeckLoading(side, false);
      setDeckError(side, "");
      applyDeckControls(side);
    } catch (error) {
      console.log(`Deck ${side} play failed:`, error);
      setDeckPlaying(side, false);
      setDeckLoading(side, false);
      setDeckError(side, "Could not start playback.");
    }
  };

  const pauseDeck = (side) => {
    const sound = getDeckHowl(side);
    if (!sound) return;

    const soundId = getValidSoundId(side);

    try {
      if (hasSoundId(soundId)) sound.pause(soundId);
      else sound.pause();
    } catch (error) {
      console.log(`Deck ${side} pause failed:`, error);
      try {
        sound.pause();
      } catch {
        // Ignore secondary pause failure.
      }
    }

    setDeckPlaying(side, false);
    applyDeckControls(side);
  };

  const toggleDeck = async (side) => {
    const isPlaying = side === "A" ? playingA : playingB;

    if (isPlaying) {
      pauseDeck(side);
      return;
    }

    await playDeck(side);
  };

  const stopDeck = (side) => {
    const sound = getDeckHowl(side);

    if (!sound) return;

    const soundId = getValidSoundId(side);

    try {
      if (hasSoundId(soundId)) sound.stop(soundId);
      else sound.stop();
    } catch (error) {
      console.log(`Deck ${side} stop failed:`, error);
      try {
        sound.stop();
      } catch {
        // Ignore secondary stop failure.
      }
    }

    deckSoundIdsRef.current[side] = null;
    syncWaveformToTime(side, 0, sound.duration() || 1);
    setDeckPlaying(side, false);
    applyDeckControls(side);

    if (side === "A") {
      setProgressA(0);
      setTimeA(0);
    } else {
      setProgressB(0);
      setTimeB(0);
    }
  };

  const restartDeck = (side) => {
    const sound = getDeckHowl(side);

    if (!sound) return;

    const soundId = getValidSoundId(side);

    try {
      if (hasSoundId(soundId)) sound.seek(0, soundId);
      else sound.seek(0);
    } catch {
      try {
        sound.seek(0);
      } catch {
        // Ignore restart seek failure.
      }
    }

    applyDeckControls(side);
    syncWaveformToTime(side, 0, sound.duration() || 1);

    if (side === "A") {
      setProgressA(0);
      setTimeA(0);
    } else {
      setProgressB(0);
      setTimeB(0);
    }
  };

  const jumpDeck = (side, seconds) => {
    const sound = getDeckHowl(side);

    if (!sound) return;

    const duration = sound.duration();

    if (!duration) return;

    const soundId = getValidSoundId(side);
    const current = Number(hasSoundId(soundId) ? sound.seek(soundId) : sound.seek()) || 0;
    const next = clamp(current + seconds, 0, duration);

    if (hasSoundId(soundId)) sound.seek(next, soundId);
    else sound.seek(next);

    applyDeckControls(side);
    syncWaveformToTime(side, next, duration);
  };

  const setOrJumpCue = (side, cueNumber) => {
    const sound = getDeckHowl(side);

    if (!sound) return;

    const soundId = getValidSoundId(side);
    const currentTime = Number(hasSoundId(soundId) ? sound.seek(soundId) : sound.seek()) || 0;
    const savedCue = cuePoints[side]?.[cueNumber];

    if (savedCue !== undefined) {
      const rawCueTime =
        typeof savedCue === "object" && savedCue !== null
          ? savedCue.time
          : savedCue;
      const cueTime = clamp(Number(rawCueTime) || 0, 0, sound.duration() || 0);

      if (hasSoundId(soundId)) sound.seek(cueTime, soundId);
      else sound.seek(cueTime);

      applyDeckControls(side);
      syncWaveformToTime(side, cueTime, sound.duration() || 1);

      const percentage = clamp((cueTime / (sound.duration() || 1)) * 100, 0, 100);

      if (side === "A") {
        setTimeA(cueTime);
        setProgressA(percentage);
      } else {
        setTimeB(cueTime);
        setProgressB(percentage);
      }

      playTone({
        frequency: 650 + cueNumber * 80,
        duration: 0.07,
        type: "square",
        volume: 0.08,
      });

      return;
    }

    const defaultLabels = {
      1: "Intro",
      2: "Build",
      3: "Drop",
      4: "Outro",
    };

    setCuePoints((current) => ({
      ...current,
      [side]: {
        ...current[side],
        [cueNumber]: {
          time: currentTime,
          label: defaultLabels[cueNumber] || `Cue ${cueNumber}`,
        },
      },
    }));

    playTone({
      frequency: 480 + cueNumber * 90,
      duration: 0.08,
      type: "triangle",
      volume: 0.1,
    });
  };

  const clearCue = (side, cueNumber) => {
    setCuePoints((current) => {
      const nextSide = { ...current[side] };
      delete nextSide[cueNumber];

      return {
        ...current,
        [side]: nextSide,
      };
    });
  };

  const playTone = async ({
    frequency = 440,
    duration = 0.3,
    type = "sine",
    startFrequency,
    endFrequency,
    volume = 0.22,
  }) => {
    await unlockAudio();

    const ctx = getAudioContext();

    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(
      startFrequency || frequency,
      ctx.currentTime
    );

    if (endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(1, endFrequency),
        ctx.currentTime + duration
      );
    }

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    if (recordingDestinationRef.current) {
      gain.connect(recordingDestinationRef.current);
    }

    oscillator.start();
    oscillator.stop(ctx.currentTime + duration);
  };

  const playNoise = async (duration = 0.25, volume = 0.18) => {
    await unlockAudio();

    const ctx = getAudioContext();

    if (!ctx) return;

    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    filter.type = "bandpass";
    filter.frequency.value = 900;
    filter.Q.value = 0.8;

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    noise.buffer = buffer;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    if (recordingDestinationRef.current) {
      gain.connect(recordingDestinationRef.current);
    }

    noise.start();
    noise.stop(ctx.currentTime + duration);
  };

  const playWikiScratch = async (intensity = 1) => {
    await unlockAudio();

    const ctx = getAudioContext();

    if (!ctx) return;

    const duration = clamp(0.035 * intensity, 0.025, 0.09);
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i += 1) {
      const fade = 1 - i / bufferSize;
      data[i] = (Math.random() * 2 - 1) * fade;
    }

    const noise = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    filter.type = "bandpass";
    filter.frequency.value = 1600 + Math.random() * 900;
    filter.Q.value = 5;

    gain.gain.setValueAtTime(0.05 * intensity, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    noise.buffer = buffer;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    if (recordingDestinationRef.current) {
      gain.connect(recordingDestinationRef.current);
    }

    noise.start();
    noise.stop(ctx.currentTime + duration);
  };

  const getPointerPosition = (event) => {
    const touch = event.touches?.[0] || event.changedTouches?.[0];

    return {
      x: touch ? touch.clientX : event.clientX,
      y: touch ? touch.clientY : event.clientY,
    };
  };

  const startScratch = async (side, event) => {
    await unlockAudio();

    const sound = getDeckHowl(side);

    if (!sound) return;

    const point = getPointerPosition(event);
    const soundId = getValidSoundId(side);

    scratchRef.current = {
      active: true,
      side,
      lastX: point.x,
      lastY: point.y,
      lastTime: Number(hasSoundId(soundId) ? sound.seek(soundId) : sound.seek()) || 0,
    };

    document.body.classList.add("dj-scratching-now");
  };

  const moveScratch = (event) => {
    const scratch = scratchRef.current;

    if (!scratch.active || !scratch.side) return;

    const sound = getDeckHowl(scratch.side);
    const soundId = getValidSoundId(scratch.side);

    if (!sound) return;

    const point = getPointerPosition(event);
    const dx = point.x - scratch.lastX;
    const dy = point.y - scratch.lastY;
    const movement = dx + dy * 0.35;

    if (Math.abs(movement) < 2) return;

    const duration = sound.duration() || 0;
    const currentTime =
      Number(hasSoundId(soundId) ? sound.seek(soundId) : sound.seek()) ||
      scratch.lastTime ||
      0;
    const nextTime = clamp(
      currentTime + movement * 0.012,
      0,
      duration || currentTime
    );

    try {
      if (hasSoundId(soundId)) sound.seek(nextTime, soundId);
      else sound.seek(nextTime);

      const scratchRate = clamp(1 + movement * 0.018, 0.35, 2.4);
      if (hasSoundId(soundId)) sound.rate(scratchRate, soundId);
      else sound.rate(scratchRate);
    } catch (error) {
      console.log("Scratch move failed:", error);
    }

    playWikiScratch(clamp(Math.abs(movement) / 10, 0.5, 2.2));

    syncWaveformToTime(scratch.side, nextTime, duration || 1);

    const percentage = clamp((nextTime / (duration || 1)) * 100, 0, 100);

    if (scratch.side === "A") {
      setTimeA(nextTime);
      setProgressA(percentage);
    } else {
      setTimeB(nextTime);
      setProgressB(percentage);
    }

    scratch.lastX = point.x;
    scratch.lastY = point.y;
    scratch.lastTime = nextTime;
  };

  const endScratch = () => {
    const scratch = scratchRef.current;

    if (!scratch.active || !scratch.side) return;

    const sound = getDeckHowl(scratch.side);
    const soundId = getValidSoundId(scratch.side);

    if (sound) {
      try {
        if (hasSoundId(soundId)) sound.rate(getSideRate(scratch.side), soundId);
        else sound.rate(getSideRate(scratch.side));
      } catch {
        sound.rate(getSideRate(scratch.side));
      }
    }

    scratchRef.current = {
      active: false,
      side: null,
      lastX: 0,
      lastY: 0,
      lastTime: 0,
    };

    document.body.classList.remove("dj-scratching-now");
  };

  const triggerClassicPad = async (item) => {
    await unlockAudio();

    setActivePad(item.id);
    scheduleTimeout(() => setActivePad(""), 180);

    const playedSample = await playSfxSample(item);

    if (playedSample) {
      return;
    }

    if (item.type === "tone") {
      playTone({
        frequency: item.tone || 523,
        duration: 0.18,
        type: "triangle",
        volume: 0.12,
      });
    }

    if (item.type === "hihat") {
      playNoise(0.055, 0.08);
      playTone({
        frequency: 8800,
        duration: 0.035,
        type: "square",
        volume: 0.025,
      });
    }

    if (item.type === "trouble") {
      playTone({
        startFrequency: 300,
        endFrequency: 80,
        duration: 0.24,
        type: "sawtooth",
        volume: 0.11,
      });

      scheduleTimeout(() => {
        playTone({
          frequency: 560,
          duration: 0.08,
          type: "square",
          volume: 0.08,
        });
      }, 120);
    }

    if (item.type === "laser") {
      playTone({
        startFrequency: 1400,
        endFrequency: 150,
        duration: 0.28,
        type: "sawtooth",
        volume: 0.14,
      });
    }

    if (item.type === "scratch") {
      playWikiScratch(2.1);
      scheduleTimeout(() => playWikiScratch(1.6), 80);
      scheduleTimeout(() => playWikiScratch(1.9), 160);
    }

    if (item.type === "whoosh") {
      playNoise(0.5, 0.11);
      playTone({
        startFrequency: 180,
        endFrequency: 980,
        duration: 0.42,
        type: "triangle",
        volume: 0.055,
      });
    }

    if (item.type === "hey" || item.type === "tag") {
      playTone({
        frequency: 720,
        duration: 0.08,
        type: "square",
        volume: 0.1,
      });

      scheduleTimeout(() => {
        playTone({
          frequency: 520,
          duration: 0.08,
          type: "square",
          volume: 0.08,
        });
      }, 85);

      scheduleTimeout(() => playNoise(0.1, 0.045), 160);
    }

    if (item.type === "beat") {
      playTone({
        startFrequency: 160,
        endFrequency: 55,
        duration: 0.16,
        type: "sine",
        volume: 0.18,
      });

      scheduleTimeout(() => playNoise(0.045, 0.07), 110);
    }

    if (item.type === "click") {
      playTone({
        frequency: 1700,
        duration: 0.025,
        type: "square",
        volume: 0.075,
      });

      scheduleTimeout(() => {
        playTone({
          frequency: 900,
          duration: 0.035,
          type: "triangle",
          volume: 0.055,
        });
      }, 35);
    }

    if (item.type === "squeak") {
      playTone({
        startFrequency: 1200,
        endFrequency: 1800,
        duration: 0.18,
        type: "sine",
        volume: 0.08,
      });
    }
  };

  const triggerPad = async (pad) => {
    await unlockAudio();

    setActivePad(pad.id);
    scheduleTimeout(() => setActivePad(""), 220);

    const playedSample = await playSfxSample(pad);

    if (playedSample) {
      return;
    }

    if (pad.type === "horn") {
      playTone({
        frequency: 466,
        duration: 0.12,
        type: "square",
        volume: 0.13,
      });

      scheduleTimeout(() => {
        playTone({
          frequency: 622,
          duration: 0.16,
          type: "square",
          volume: 0.12,
        });
      }, 120);
    }

    if (pad.type === "scratch") {
      playWikiScratch(2.2);
      scheduleTimeout(() => playWikiScratch(1.7), 90);
    }

    if (pad.type === "laser") {
      playTone({
        startFrequency: 1800,
        endFrequency: 180,
        duration: 0.32,
        type: "sawtooth",
        volume: 0.13,
      });
    }

    if (pad.type === "drop") {
      playTone({
        startFrequency: 180,
        endFrequency: 38,
        duration: 0.55,
        type: "sine",
        volume: 0.23,
      });
    }

    if (pad.type === "crowd") {
      playNoise(0.45, 0.12);
    }

    if (pad.type === "rewind") {
      playWikiScratch(2.5);
      playTone({
        startFrequency: 1000,
        endFrequency: 240,
        duration: 0.38,
        type: "sawtooth",
        volume: 0.08,
      });
    }

    if (pad.type === "siren") {
      playTone({
        startFrequency: 600,
        endFrequency: 1200,
        duration: 0.24,
        type: "sine",
        volume: 0.1,
      });

      scheduleTimeout(() => {
        playTone({
          startFrequency: 1200,
          endFrequency: 500,
          duration: 0.24,
          type: "sine",
          volume: 0.1,
        });
      }, 230);
    }

    if (pad.type === "tag") {
      triggerClassicPad({ id: pad.id, type: "tag" });
    }
  };

  const getTargetSides = () => {
    return fxTarget === "AB" ? ["A", "B"] : [fxTarget];
  };

  const triggerFx = async (fxId) => {
    await unlockAudio();

    setActiveFx(fxId);
    scheduleTimeout(() => setActiveFx(""), 350);

    const fx = fxButtons.find((item) => item.id === fxId);
    const playedFxSample = await playSfxSample(fx, { volume: 0.8 });

    if (fxId === "echo" && !playedFxSample) {
      playTone({
        frequency: 420,
        duration: 0.1,
        type: "triangle",
        volume: 0.08,
      });

      scheduleTimeout(() => {
        playTone({
          frequency: 420,
          duration: 0.08,
          type: "triangle",
          volume: 0.045,
        });
      }, 150);

      scheduleTimeout(() => {
        playTone({
          frequency: 420,
          duration: 0.06,
          type: "triangle",
          volume: 0.025,
        });
      }, 300);
    }

    if (fxId === "reverb" && !playedFxSample) {
      playNoise(0.8, 0.055);
    }

    if (fxId === "filter" && !playedFxSample) {
      playTone({
        startFrequency: 220,
        endFrequency: 1500,
        duration: 0.45,
        type: "sawtooth",
        volume: 0.055,
      });
    }

    if (fxId === "flanger" && !playedFxSample) {
      playTone({
        startFrequency: 440,
        endFrequency: 520,
        duration: 0.18,
        type: "sine",
        volume: 0.05,
      });

      scheduleTimeout(() => {
        playTone({
          startFrequency: 520,
          endFrequency: 430,
          duration: 0.18,
          type: "sine",
          volume: 0.04,
        });
      }, 180);
    }

    if (fxId === "brake") {
      getTargetSides().forEach((side) => jumpDeck(side, -1));
    }

    if (fxId === "roll") {
      getTargetSides().forEach((side) => jumpDeck(side, -0.25));
    }

    if (fxId === "siren" && !playedFxSample) {
      triggerPad({ id: "fx-siren", type: "siren" });
    }

    if (fxId === "whoosh" && !playedFxSample) {
      triggerClassicPad({ id: "fx-whoosh", type: "whoosh" });
    }

    if (fxId === "stutter") {
      getTargetSides().forEach((side) => {
        const sound = getDeckHowl(side);
        const soundId = getValidSoundId(side);

        if (!sound) return;

        const now = Number(hasSoundId(soundId) ? sound.seek(soundId) : sound.seek()) || 0;

        [80, 160, 240].forEach((delay) => {
          scheduleTimeout(() => {
            if (deckHowlsRef.current[side] !== sound) return;
            if (hasSoundId(soundId)) sound.seek(now, soundId);
            else sound.seek(now);
            applyDeckControls(side);
          }, delay);
        });
      });
    }
  };

  const triggerLoop = (size) => {
    setActiveLoop(size);
    scheduleTimeout(() => setActiveLoop(""), 350);

    const beats = size === "1/2" ? 0.5 : Number(size);

    getTargetSides().forEach((side) => {
      jumpDeck(side, -0.18 * beats);
    });
  };

  const triggerStem = (stemId) => {
    setActiveStem(stemId);
    scheduleTimeout(() => setActiveStem(""), 550);

    const stem = stemButtons.find((item) => item.id === stemId);

    playSfxSample(stem, { volume: 0.8 }).then((playedSample) => {
      if (playedSample) return;

      if (stemId === "vocal") {
        playTone({
          frequency: 740,
          duration: 0.09,
          type: "sine",
          volume: 0.07,
        });
      }

      if (stemId === "drums") {
        triggerClassicPad({ id: "stem-drums", type: "beat" });
      }

      if (stemId === "bass") {
        playTone({
          startFrequency: 120,
          endFrequency: 62,
          duration: 0.2,
          type: "sine",
          volume: 0.16,
        });
      }

      if (stemId === "music") {
        playTone({
          frequency: 523,
          duration: 0.12,
          type: "triangle",
          volume: 0.075,
        });
      }
    });
  };

  const randomLoad = () => {
    if (!filteredSongs.length) return;

    const randomSong = filteredSongs[Math.floor(Math.random() * filteredSongs.length)];

    loadToDeck(randomSong, Math.random() > 0.5 ? "A" : "B");
  };

  const startRecording = async () => {
    await unlockAudio();

    setRecordingError("");

    try {
      const ctx = getAudioContext();

      if (!ctx || typeof MediaRecorder === "undefined") {
        setRecordingError("Recording is not supported in this browser.");
        return;
      }

      if (recordingUrlRef.current) {
        URL.revokeObjectURL(recordingUrlRef.current);
        recordingUrlRef.current = "";
      }

      recordedChunksRef.current = [];

      const destination = ctx.createMediaStreamDestination();
      recordingDestinationRef.current = destination;

      const recorder = new MediaRecorder(destination.stream);

      recorder.ondataavailable = (event) => {
        if (event.data?.size) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: "audio/webm",
        });

        if (!mountedRef.current) return;
        const nextUrl = URL.createObjectURL(blob);
        setRecordingUrl(nextUrl);
        recordingUrlRef.current = nextUrl;
        recordingDestinationRef.current = null;
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (error) {
      console.log("Recording failed:", error);
      setRecordingError("Could not start recording in this browser.");
      setIsRecording(false);
      recordingDestinationRef.current = null;
    }
  };

  const stopRecording = () => {
    try {
      if (mediaRecorderRef.current?.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    } catch (error) {
      console.log("Stop recording failed:", error);
    }

    setIsRecording(false);
  };

  useEffect(() => {
    if (deckA) {
      createWaveform("A", deckA);
    }
  }, [deckA]);

  useEffect(() => {
    if (deckB) {
      createWaveform("B", deckB);
    }
  }, [deckB]);

  useEffect(() => {
    progressTimerRef.current = window.setInterval(() => {
      ["A", "B"].forEach((side) => {
        const sound = getDeckHowl(side);

        if (!sound) return;

        const duration = sound.duration();

        if (!duration) return;

        const soundId = getValidSoundId(side);
        const isActuallyPlaying = hasSoundId(soundId)
          ? sound.playing(soundId)
          : sound.playing();

        const seek = Number(hasSoundId(soundId) ? sound.seek(soundId) : sound.seek()) || 0;
        const percentage = clamp((seek / duration) * 100, 0, 100);

        syncWaveformToTime(side, seek, duration);

        if (side === "A") {
          setPlayingA(isActuallyPlaying);
          setProgressA(percentage);
          setTimeA(seek);
          setDurationA(duration);
        } else {
          setPlayingB(isActuallyPlaying);
          setProgressB(percentage);
          setTimeB(seek);
          setDurationB(duration);
        }
      });
    }, 250);

    return () => {
      if (progressTimerRef.current) {
        window.clearInterval(progressTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const stopScratch = () => endScratch();

    window.addEventListener("mouseup", stopScratch);
    window.addEventListener("touchend", stopScratch);

    return () => {
      window.removeEventListener("mouseup", stopScratch);
      window.removeEventListener("touchend", stopScratch);

      unloadDeck("A");
      unloadDeck("B");

      if (recordingUrlRef.current) {
        URL.revokeObjectURL(recordingUrlRef.current);
        recordingUrlRef.current = "";
      }
    };
  }, []);

  const renderMiniClassic = () => {
    return (
      <div className="classic-dj-panel">
        <div className="classic-mobile-pads d-md-none">
          <span className="classic-mobile-label">Quick sound pads</span>

          <div className="classic-mobile-pad-grid">
            {classicAllButtons.map((item) => (
              <button
                key={item.id}
                type="button"
                className={
                  activePad === item.id ? "classic-mini active" : "classic-mini"
                }
                onClick={() => triggerClassicPad(item)}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>

        <div className="classic-side-buttons classic-desktop-pads d-none d-md-grid">
          {classicLeftButtons.map((item) => (
            <button
              key={item.id}
              type="button"
              className={
                activePad === item.id ? "classic-mini active" : "classic-mini"
              }
              onClick={() => triggerClassicPad(item)}
            >
              {item.name}
            </button>
          ))}
        </div>

        <div className="classic-color-grid">
          {classicColorPads.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`classic-color-pad ${item.color} ${
                activePad === item.id ? "active" : ""
              }`}
              onClick={() => triggerClassicPad(item)}
            >
              {item.name}
            </button>
          ))}
        </div>

        <div className="classic-side-buttons classic-desktop-pads d-none d-md-grid">
          {classicRightButtons.map((item) => (
            <button
              key={item.id}
              type="button"
              className={
                activePad === item.id ? "classic-mini active" : "classic-mini"
              }
              onClick={() => triggerClassicPad(item)}
            >
              {item.name}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderKnob = (label, value, setter, helperText = "") => {
    return (
      <label className="dj-knob-pro">
        <span>{label}</span>
        {helperText && <small className="dj-control-helper">{helperText}</small>}

        <input
          type="range"
          min="0"
          max="100"
          value={value}
          onChange={(event) => setter(Number(event.target.value))}
        />

        <b>{value}</b>
      </label>
    );
  };

  const renderDeck = ({
    side,
    deck,
    playing,
    loading,
    error,
    volume,
    setVolume,
    pitch,
    setPitch,
    progress,
    time,
    duration,
    gain,
    setGain,
    low,
    setLow,
    mid,
    setMid,
    high,
    setHigh,
  }) => {
    const waveStatus = side === "A" ? waveStatusA : waveStatusB;
    const image = deck ? getSongImage(deck) : "/fallback-cover.png";

    return (
      <div className={`dj-deck-pro deck-${side.toLowerCase()}`}>
        <div className="deck-top-pro">
          <div>
            <span className="deck-label-pro">Deck {side}</span>

            <h2>{deck ? getSongTitle(deck) : `Load Track ${side}`}</h2>

            <p>
              {deck
                ? `${getArtistName(deck)} · ${getSongBpm(deck)} BPM`
                : "Choose from your music crate"}
            </p>
          </div>

          <button
            type="button"
            className="headphone-button-pro"
            onClick={() => setFxTarget(side)}
            title={`Set FX target to Deck ${side}`}
          >
            <FaHeadphones />
          </button>
        </div>

        <div className="deck-display-pro">
          <div
            className="vinyl-pro"
            onMouseDown={(event) => startScratch(side, event)}
            onMouseMove={moveScratch}
            onMouseUp={endScratch}
            onMouseLeave={endScratch}
            onTouchStart={(event) => startScratch(side, event)}
            onTouchMove={moveScratch}
            onTouchEnd={endScratch}
            role="button"
            tabIndex={0}
          >
            <img
              src={image}
              alt={deck ? getSongTitle(deck) : `Deck ${side}`}
              onError={(event) => {
                event.currentTarget.src = "/fallback-cover.png";
              }}
            />
          </div>

          <div className="wave-wrap-pro">
            <div
              ref={(element) => {
                waveContainersRef.current[side] = element;
              }}
              className="waveform-pro"
            />

            <span className={`wave-status-pro ${waveStatus}`}>
              {WAVE_STATUS_LABELS[waveStatus] || "Waveform status unknown"}
            </span>
          </div>
        </div>

        <div className="time-row-pro">
          <span>{formatTime(time)}</span>

          <label className="visually-hidden" htmlFor={`seek-${side}`}>
            Track position
          </label>
          <input
            id={`seek-${side}`}
            aria-label={`Track position for Deck ${side}`}
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={(event) => seekDeck(side, event.target.value)}
          />

          <span>{formatTime(duration)}</span>
        </div>

        {error && <div className="deck-error-pro">{error}</div>}
        {loading && <div className="deck-loading-pro">Loading audio...</div>}

        <div className="transport-pro">
          <button
            type="button"
            onClick={() => jumpDeck(side, -5)}
            aria-label={`Jump Deck ${side} backward 5 seconds`}
          >
            <FaBackward />
          </button>

          <button
            type="button"
            onClick={() => restartDeck(side)}
            aria-label={`Restart Deck ${side}`}
          >
            <FaUndo />
          </button>

          <button
            type="button"
            className="play-main-pro"
            onClick={() => toggleDeck(side)}
            aria-label={playing ? `Pause Deck ${side}` : `Play Deck ${side}`}
          >
            {playing ? <FaPause /> : <FaPlay />}
          </button>

          <button
            type="button"
            onClick={() => stopDeck(side)}
            aria-label={`Stop Deck ${side}`}
          >
            <FaStop />
          </button>

          <button
            type="button"
            onClick={() => jumpDeck(side, 5)}
            aria-label={`Jump Deck ${side} forward 5 seconds`}
          >
            <FaRedo />
          </button>
        </div>

        <div className="cue-row-pro">
          {[1, 2, 3, 4].map((cue) => (
            <button
              key={cue}
              type="button"
              className={cuePoints[side]?.[cue] ? "cue-pro saved" : "cue-pro"}
              onClick={() => setOrJumpCue(side, cue)}
              onContextMenu={(event) => {
                event.preventDefault();
                clearCue(side, cue);
              }}
              title="Left click to jump/set cue. Right click to clear cue."
              aria-label={`Cue ${cue} on Deck ${side}. Left click to jump or set cue. Right click to clear cue.`}
            >
              {cuePoints[side]?.[cue]?.label || `Cue ${cue}`}
            </button>
          ))}
        </div>

        <div className="deck-controls-pro">
          {renderKnob("Deck Volume", volume, setVolume)}
          {renderKnob("Gain / Trim", gain, setGain)}

          <label className="dj-knob-pro">
            <span>Pitch / Speed</span>

            <input
              type="range"
              min="-25"
              max="25"
              value={pitch}
              onChange={(event) => setPitch(Number(event.target.value))}
            />

            <b>{pitch}%</b>
          </label>
        </div>

        <div className="eq-row-pro">
          {renderKnob("Low EQ", low, setLow)}
          {renderKnob("Mid EQ", mid, setMid)}
          {renderKnob("High EQ", high, setHigh)}
        </div>
      </div>
    );
  };

  const renderMixer = () => {
    return (
      <div className="dj-mixer-pro">
        <div className="mixer-header-pro">
          <FaSlidersH />

          <h2>Mixer</h2>

          <span>{fxTarget === "AB" ? "FX: A+B" : `FX: ${fxTarget}`}</span>
        </div>

        <div className="fx-target-row-pro">
          {[
            { id: "A", label: "Deck A" },
            { id: "AB", label: "Both" },
            { id: "B", label: "Deck B" },
          ].map((target) => (
            <button
              key={target.id}
              type="button"
              className={fxTarget === target.id ? "active" : ""}
              onClick={() => setFxTarget(target.id)}
            >
              {target.label}
            </button>
          ))}
        </div>

        <div className="crossfader-pro">
          <div className="cross-labels-pro">
            <span>Deck A</span>
            <span>Crossfader</span>
            <span>Deck B</span>
          </div>

          <p className="dj-helper-text">Move left for Deck A, right for Deck B.</p>

          <input
            type="range"
            min="0"
            max="100"
            value={crossfader}
            aria-label="Crossfader. Move left for Deck A, right for Deck B."
            onChange={(event) => setCrossfader(Number(event.target.value))}
          />

          <div className="cross-balance-pro">
            Current balance: <strong>{getCrossfaderBalanceLabel(crossfader)}</strong>
          </div>
        </div>

        <div className="loop-row-pro">
          {loopSizes.map((size) => (
            <button
              key={size}
              type="button"
              className={activeLoop === size ? "active" : ""}
              onClick={() => triggerLoop(size)}
            >
              {size}
            </button>
          ))}
        </div>

        <div className="record-box-pro">
          <button
            type="button"
            className={isRecording ? "recording active" : "recording"}
            onClick={isRecording ? stopRecording : startRecording}
          >
            <FaMicrophone /> {isRecording ? "Stop Rec" : "Record FX"}
          </button>

          {recordingUrl && (
            <a
              href={recordingUrl}
              download="dj-recording.webm"
              className="download-recording-pro"
            >
              <FaDownload /> Save
            </a>
          )}

          {recordingError && <p>{recordingError}</p>}
        </div>

        <button type="button" className="random-load-pro" onClick={randomLoad}>
          <FaRandom /> Random Load
        </button>
      </div>
    );
  };

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate("/");
  };

  return (
    <div className="dj-page-pro">
      <button
        type="button"
        className="dj-back-button-pro"
        onClick={handleGoBack}
        aria-label="Go back to previous page"
      >
        <span className="dj-back-icon-pro">
          <FaBackward />
        </span>
        <span>Back</span>
      </button>
      <div className="dj-hero-pro">
        <div>
          <span className="dj-kicker-pro">
            <FaBolt /> Pro DJ Studio
          </span>

          <h1>Mix, scratch, cue, loop, and trigger effects</h1>

          <p>
            Load two tracks from your library, use the crossfader, trigger pads,
            and perform with stable audio controls.
          </p>
        </div>

        <div className="hero-actions-pro">
          <button
            type="button"
            onClick={() => {
              stopDeck("A");
              stopDeck("B");
            }}
          >
            <FaVolumeMute /> Stop All
          </button>

          <button type="button" onClick={applyAllDeckControls}>
            <FaSyncAlt /> Sync Controls
          </button>
        </div>
      </div>

      <div className="mobile-tabs-pro">
        {[
          { id: "A", label: "Deck A" },
          { id: "M", label: "Mixer" },
          { id: "B", label: "Deck B" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={mobileView === tab.id ? "active" : ""}
            onClick={() => setMobileView(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {renderMiniClassic()}

      <div className="container-fluid px-0">
        <div className="row g-2 g-md-3 align-items-stretch dj-bootstrap-controller">
          <div
            className={`col-12 col-xl-5 mobile-panel ${
              mobileView === "A" ? "mobile-panel-active" : ""
            }`}
          >
            {renderDeck({
              side: "A",
              deck: deckA,
              playing: playingA,
              loading: loadingA,
              error: errorA,
              volume: volumeA,
              setVolume: setVolumeA,
              pitch: pitchA,
              setPitch: setPitchA,
              progress: progressA,
              time: timeA,
              duration: durationA,
              gain: gainA,
              setGain: setGainA,
              low: lowA,
              setLow: setLowA,
              mid: midA,
              setMid: setMidA,
              high: highA,
              setHigh: setHighA,
            })}
          </div>

          <div
            className={`col-12 col-xl-2 mobile-panel ${
              mobileView === "M" ? "mobile-panel-active" : ""
            }`}
          >
            {renderMixer()}
          </div>

          <div
            className={`col-12 col-xl-5 mobile-panel ${
              mobileView === "B" ? "mobile-panel-active" : ""
            }`}
          >
            {renderDeck({
              side: "B",
              deck: deckB,
              playing: playingB,
              loading: loadingB,
              error: errorB,
              volume: volumeB,
              setVolume: setVolumeB,
              pitch: pitchB,
              setPitch: setPitchB,
              progress: progressB,
              time: timeB,
              duration: durationB,
              gain: gainB,
              setGain: setGainB,
              low: lowB,
              setLow: setLowB,
              mid: midB,
              setMid: setMidB,
              high: highB,
              setHigh: setHighB,
            })}
          </div>
        </div>

        <div className="row g-2 g-md-3 mt-2 mt-md-3">
          <div className="col-12 col-xl-4">
            <div className="dj-panel-pro h-100">
              <div className="panel-title-pro">
                <div>
                  <span>Neural Style</span>

                  <h2>Stem Pads</h2>
                </div>

                <FaSlidersH />
              </div>

              <div className="row g-2">
                {stemButtons.map((stem) => {
                  const StemIcon = stem.icon;

                  return (
                    <div className="col-6" key={stem.id}>
                      <button
                        type="button"
                        className={
                          activeStem === stem.id
                            ? "stem-button-pro active"
                            : "stem-button-pro"
                        }
                        onClick={() => triggerStem(stem.id)}
                      >
                        <strong>
                          <StemIcon />
                        </strong>
                        <span>{stem.name}</span>
                      </button>
                    </div>
                  );
                })}
              </div>

              <p className="stem-note">
                Visual stem controls for a pro DJ feel. Real AI stem separation
                can be added later with backend audio processing.
              </p>
            </div>
          </div>

          <div className="col-12 col-xl-4">
            <div className="dj-panel-pro h-100">
              <div className="panel-title-pro">
                <div>
                  <span>FX Unit</span>

                  <h2>Performance FX</h2>
                </div>

                <FaSlidersH />
              </div>

              <div className="row g-2">
                {fxButtons.map((fx) => {
                  const FxIcon = fx.icon;

                  return (
                    <div className="col-4 col-md-4" key={fx.id}>
                      <button
                        type="button"
                        className={
                          activeFx === fx.id
                            ? "fx-button-pro active"
                            : "fx-button-pro"
                        }
                        onClick={() => triggerFx(fx.id)}
                      >
                        <strong>
                          <FxIcon />
                        </strong>

                        <span>{fx.name}</span>
                      </button>
                    </div>
                  );
                })}
              </div>

              <p className="stem-note">
                FX target:{" "}
                {fxTarget === "AB" ? "Deck A + Deck B" : `Deck ${fxTarget}`}
              </p>
            </div>
          </div>

          <div className="col-12 col-xl-4">
            <div className="dj-panel-pro h-100">
              <div className="panel-title-pro">
                <div>
                  <span>Sampler</span>

                  <h2>DJ Pads</h2>
                </div>

                <FaRecordVinyl />
              </div>

              <div className="row g-2">
                {djPads.map((pad) => {
                  const PadIcon = pad.icon;

                  return (
                    <div className="col-6 col-sm-4 col-xl-4" key={pad.id}>
                      <button
                        type="button"
                        className={activePad === pad.id ? "pad-pro active" : "pad-pro"}
                        onClick={() => triggerPad(pad)}
                      >
                        <strong>
                          <PadIcon />
                        </strong>

                        <span>{pad.name}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="dj-panel-pro mt-2 mt-md-3">
          <div className="row g-2 align-items-center mb-2">
            <div className="col-12 col-md-6">
              <div className="panel-title-pro mb-0">
                <div>
                  <span>Music Crate</span>

                  <h2>Load Songs Into Decks</h2>
                </div>
              </div>
            </div>

            <div className="col-12 col-md-6">
              <div className="dj-search-pro">
                <FaSearch />

                <input
                  type="text"
                  placeholder="Search your songs..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
            </div>
          </div>

          {filteredSongs.length === 0 ? (
            <div className="dj-empty-pro">
              <div>
                <h3>No tracks yet</h3>

                <p>
                  Upload songs to your music library, then load them into Deck A
                  or Deck B.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="song-count-helper-pro">
                Showing {Math.min(visibleSongCount, filteredSongs.length)} of{" "}
                {filteredSongs.length} songs
              </div>

              <div className="row g-2">
                {visibleSongs.map((song, index) => {
                  const loadedA = isSameSong(deckA, song);
                  const loadedB = isSameSong(deckB, song);

                  return (
                    <div
                      className="col-12 col-md-6 col-xl-4"
                      key={song._id || song.id || `${getSongTitle(song)}-${index}`}
                    >
                      <div
                        className={
                          loadedA || loadedB
                            ? "crate-song-card loaded"
                            : "crate-song-card"
                        }
                      >
                        <img
                          src={getSongImage(song)}
                          alt={getSongTitle(song)}
                          onError={(event) => {
                            event.currentTarget.src = "/fallback-cover.png";
                          }}
                        />

                        <div>
                          <h4>{getSongTitle(song)}</h4>

                          <p>
                            {getArtistName(song)} · {getSongBpm(song)} BPM
                          </p>
                        </div>

                        <div className="crate-actions">
                          <button
                            type="button"
                            className={loadedA ? "active" : ""}
                            onClick={() => loadToDeck(song, "A")}
                            aria-label={`Load ${getSongTitle(song)} to Deck A`}
                            title="Load to A"
                          >
                            Load to A
                          </button>

                          <button
                            type="button"
                            className={loadedB ? "active" : ""}
                            onClick={() => loadToDeck(song, "B")}
                            aria-label={`Load ${getSongTitle(song)} to Deck B`}
                            title="Load to B"
                          >
                            Load to B
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="load-more-songs-pro">
                {hasMoreSongs ? (
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleSongCount((count) =>
                        Math.min(count + 10, filteredSongs.length)
                      )
                    }
                  >
                    Load More Songs
                  </button>
                ) : (
                  <span>No more songs to show</span>
                )}
              </div>
            </>
          )}
        </div>

        <div className="future-api-pro">
          <FaBroadcastTower />

          <div>
            <h3>Audio Stability Fix Applied</h3>

            <p>
              FX and loops no longer reset the whole deck. Crossfader, pitch,
              cues, waveform seeking, and scratch controls are isolated and
              safer.
            </p>
          </div>

          <FaDownload className="d-none d-md-block" />
        </div>
      </div>
    </div>
  );
};

export default Dj;
