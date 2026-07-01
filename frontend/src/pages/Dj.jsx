import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  FaBackward,
  FaBolt,
  FaBroadcastTower,
  FaDownload,
  FaHeadphones,
  FaMicrophone,
  FaPause,
  FaPlay,
  FaRandom,
  FaRecordVinyl,
  FaRedo,
  FaSearch,
  FaSlidersH,
  FaStop,
  FaSyncAlt,
  FaUndo,
  FaVolumeMute,
} from "react-icons/fa";
import { Howl, Howler } from "howler";
import WaveSurfer from "wavesurfer.js";
import { MusicContext } from "../context/ShopContext";
import "bootstrap/dist/css/bootstrap.min.css";
import "./CSS/Dj.css";

const djPads = [
  { id: "airhorn", name: "Air Horn", icon: "📯", type: "horn" },
  { id: "scratch", name: "Scratch", icon: "💿", type: "scratch" },
  { id: "laser", name: "Laser", icon: "🔫", type: "laser" },
  { id: "drop", name: "Bass Drop", icon: "💥", type: "drop" },
  { id: "crowd", name: "Crowd", icon: "🙌", type: "crowd" },
  { id: "rewind", name: "Rewind", icon: "⏪", type: "rewind" },
  { id: "siren", name: "Siren", icon: "🚨", type: "siren" },
  { id: "tag", name: "DJ Tag", icon: "🎤", type: "tag" },
  { id: "impact", name: "Impact", icon: "⚡", type: "drop" },
  { id: "vinylstop", name: "Vinyl Stop", icon: "🛑", type: "rewind" },
  { id: "transition", name: "Sweep", icon: "🌪️", type: "laser" },
  { id: "noise", name: "Noise", icon: "✨", type: "crowd" },
];

const fxButtons = [
  { id: "echo", name: "Echo", icon: "🔊" },
  { id: "reverb", name: "Reverb", icon: "🌌" },
  { id: "filter", name: "Filter", icon: "🌀" },
  { id: "flanger", name: "Flanger", icon: "⚙️" },
  { id: "brake", name: "Brake", icon: "🛑" },
  { id: "roll", name: "Roll", icon: "🔁" },
  { id: "siren", name: "Siren", icon: "🚨" },
  { id: "whoosh", name: "Whoosh", icon: "🌬️" },
  { id: "stutter", name: "Stutter", icon: "⚡" },
];

const stemButtons = [
  { id: "vocal", name: "Vocal", icon: "🎙️" },
  { id: "drums", name: "Drums", icon: "🥁" },
  { id: "bass", name: "Bass", icon: "🎚️" },
  { id: "music", name: "Music", icon: "🎹" },
];

const loopSizes = ["1/2", "1", "2", "4"];

const classicLeftButtons = [
  { id: "piano", name: "Piano", type: "tone", tone: 523 },
  { id: "yes", name: "YES", type: "tag" },
  { id: "pick", name: "Pick", type: "click" },
  { id: "duing", name: "Duing", type: "laser" },
  { id: "squeak", name: "Squeak", type: "squeak" },
  { id: "scratch-mini", name: "Scratch", type: "scratch" },
];

const classicRightButtons = [
  { id: "book", name: "Book", type: "click" },
  { id: "pick2", name: "Pick", type: "click" },
  { id: "walker", name: "Walker", type: "hey" },
  { id: "whoosh", name: "Whoosh", type: "whoosh" },
  { id: "drums", name: "Drums", type: "beat" },
  { id: "beat", name: "Beat", type: "beat" },
];

const classicAllButtons = [...classicLeftButtons, ...classicRightButtons];

const classicColorPads = [
  { id: "hat-a", name: "Hi Hat", type: "hihat", color: "pink" },
  { id: "trouble-a", name: "Trouble", type: "trouble", color: "lime" },
  { id: "laser-a", name: "Lazer", type: "laser", color: "orange" },
  { id: "hat-b", name: "Hi Hat", type: "hihat", color: "yellow" },
  { id: "trouble-b", name: "Trouble", type: "trouble", color: "green" },
  { id: "laser-b", name: "Lazer", type: "laser", color: "blue" },
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

const Dj = () => {
  const { songs = [] } = useContext(MusicContext) || {};

  const deckHowlsRef = useRef({ A: null, B: null });
  const deckSoundIdsRef = useRef({ A: null, B: null });
  const progressTimerRef = useRef(null);

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
    return song?.title || song?.name || "Load Track";
  };

  const getArtistName = (song) => {
    if (!song?.artist) return "Choose from library";
    if (typeof song.artist === "string") return song.artist;

    return song.artist.name || song.artist.artistName || "Unknown Artist";
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

  const filteredSongs = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();

    return songs.filter((song) => {
      const title = getSongTitle(song).toLowerCase();
      const artist = getArtistName(song).toLowerCase();

      return title.includes(search) || artist.includes(search);
    });
  }, [songs, searchTerm]);

  const getAudioContext = () => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!Howler.ctx && AudioContextClass) {
      Howler.ctx = new AudioContextClass();
    }

    return Howler.ctx || null;
  };

  const unlockAudio = async () => {
    try {
      Howler.autoUnlock = true;
      Howler.usingWebAudio = true;

      const ctx = getAudioContext();

      if (ctx?.state === "suspended") {
        await ctx.resume();
      }

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

  const getDeckData = (side) => {
    if (side === "A") {
      return {
        deck: deckA,
        volume: volumeA,
        gain: gainA,
        low: lowA,
        mid: midA,
        high: highA,
        pitch: pitchA,
      };
    }

    return {
      deck: deckB,
      volume: volumeB,
      gain: gainB,
      low: lowB,
      mid: midB,
      high: highB,
      pitch: pitchB,
    };
  };

  const getDeckFinalVolume = ({ side, volume, gain, low, mid, high }) => {
    const fadePosition = clamp(crossfader, 0, 100) / 100;

    const fadePower =
      side === "A"
        ? Math.cos(fadePosition * (Math.PI / 2))
        : Math.sin(fadePosition * (Math.PI / 2));

    const volumeAmount = clamp(volume, 0, 100) / 100;
    const gainAmount = clamp(gain, 0, 100) / 50;

    const eqMovement =
      (Number(low) - 50 + Number(mid) - 50 + Number(high) - 50) / 500;

    const eqTrim = clamp(1 + eqMovement, 0.65, 1.25);

    return clamp(volumeAmount * gainAmount * fadePower * eqTrim, 0, 1);
  };

  const getSideVolume = (side) => {
    return getDeckFinalVolume({
      side,
      ...getDeckData(side),
    });
  };

  const getSideRate = (side) => {
    const pitch = side === "A" ? pitchA : pitchB;
    return Math.max(0.5, 1 + pitch / 100);
  };

  const setSoundVolume = (side, volume) => {
    const sound = getDeckHowl(side);
    const soundId = getDeckSoundId(side);

    if (!sound) return;

    try {
      if (hasSoundId(soundId)) {
        sound.volume(volume, soundId);
      }

      sound.volume(volume);
    } catch (error) {
      console.log(`Volume apply failed on deck ${side}:`, error);
    }
  };

  const applyDeckControls = () => {
    ["A", "B"].forEach((side) => {
      const sound = getDeckHowl(side);
      const soundId = getDeckSoundId(side);

      if (!sound) return;

      try {
        setSoundVolume(side, getSideVolume(side));

        if (hasSoundId(soundId)) {
          sound.rate(getSideRate(side), soundId);
        } else {
          sound.rate(getSideRate(side));
        }
      } catch (error) {
        console.log(`Apply controls failed on deck ${side}:`, error);
      }
    });
  };

  useEffect(() => {
    applyDeckControls();
  }, [
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
      window.clearTimeout(waveCreateTimerRef.current[side]);
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
    setWaveStatus(side, "empty");
  };

  const syncWaveformToTime = (side, currentTime, duration) => {
    const wave = waveSurfersRef.current[side];

    if (!wave || !duration) return;

    try {
      waveSyncingRef.current[side] = true;
      wave.seekTo(clamp(currentTime / duration, 0, 1));

      window.setTimeout(() => {
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

    sound.seek(nextTime, getDeckSoundId(side));
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
      waveCreateTimerRef.current[side] = window.setTimeout(() => {
        createWaveform(side, song);
      }, 150);
      return;
    }

    destroyWaveform(side);
    setWaveStatus(side, "loading");

    waveCreateTimerRef.current[side] = window.setTimeout(() => {
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
          setWaveStatus(side, "fallback");
        });

        waveSurfersRef.current[side] = wave;
      } catch (error) {
        console.log(`Waveform create failed on deck ${side}:`, error);
        setWaveStatus(side, "fallback");
      }
    }, 150);
  };

  const unloadDeck = (side) => {
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

    deckHowlsRef.current[side] = null;
    deckSoundIdsRef.current[side] = null;

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

  const createDeckHowl = (side, song) => {
    const audioUrl = getSongAudio(song);

    if (!audioUrl) {
      if (side === "A") {
        setErrorA("This track has no audio URL.");
        setLoadingA(false);
      } else {
        setErrorB("This track has no audio URL.");
        setLoadingB(false);
      }

      return null;
    }

    if (side === "A") {
      setLoadingA(true);
      setErrorA("");
    } else {
      setLoadingB(true);
      setErrorB("");
    }

    const sound = new Howl({
      src: [audioUrl],
      html5: true,
      preload: true,
      format: getAudioFormat(audioUrl),
      volume: getSideVolume(side),
      rate: getSideRate(side),
      pool: 1,
      onload: () => {
        const duration = sound.duration() || 0;

        if (side === "A") {
          setLoadingA(false);
          setDurationA(duration);
          setErrorA("");
        } else {
          setLoadingB(false);
          setDurationB(duration);
          setErrorB("");
        }

        applyDeckControls();
      },
      onloaderror: (_, error) => {
        console.log(`Deck ${side} load failed:`, error);

        const message =
          "Audio could not preload. Press Play again, or check the audio URL/CORS.";

        if (side === "A") {
          setLoadingA(false);
          setErrorA(message);
        } else {
          setLoadingB(false);
          setErrorB(message);
        }
      },
      onplay: (soundId) => {
        deckSoundIdsRef.current[side] = soundId;

        if (side === "A") {
          setPlayingA(true);
          setLoadingA(false);
          setErrorA("");
        } else {
          setPlayingB(true);
          setLoadingB(false);
          setErrorB("");
        }

        applyDeckControls();
      },
      onplayerror: (_, error) => {
        console.log(`Deck ${side} play error:`, error);

        const message = "Could not play. Check audio URL, CORS, or file format.";

        if (side === "A") {
          setPlayingA(false);
          setLoadingA(false);
          setErrorA(message);
        } else {
          setPlayingB(false);
          setLoadingB(false);
          setErrorB(message);
        }
      },
      onpause: () => {
        if (side === "A") setPlayingA(false);
        else setPlayingB(false);
      },
      onstop: () => {
        if (side === "A") setPlayingA(false);
        else setPlayingB(false);
      },
      onend: () => {
        if (side === "A") {
          setPlayingA(false);
          setProgressA(0);
          setTimeA(0);
        } else {
          setPlayingB(false);
          setProgressB(0);
          setTimeB(0);
        }
      },
    });

    deckHowlsRef.current[side] = sound;

    return sound;
  };

  const loadToDeck = async (song, side) => {
    await unlockAudio();

    unloadDeck(side);

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

    window.setTimeout(() => {
      createDeckHowl(side, song);
    }, 80);
  };

  const toggleDeck = async (side) => {
    await unlockAudio();

    const deck = side === "A" ? deckA : deckB;
    const isPlaying = side === "A" ? playingA : playingB;

    if (!deck) {
      if (side === "A") {
        setErrorA("Load a song into Deck A first.");
      } else {
        setErrorB("Load a song into Deck B first.");
      }

      return;
    }

    let sound = getDeckHowl(side);

    if (!sound) {
      sound = createDeckHowl(side, deck);
    }

    if (!sound) return;

    if (isPlaying) {
      try {
        if (hasSoundId(getDeckSoundId(side))) {
          sound.pause(getDeckSoundId(side));
        } else {
          sound.pause();
        }
      } catch {
        sound.pause();
      }

      if (side === "A") {
        setPlayingA(false);
      } else {
        setPlayingB(false);
      }

      return;
    }

    try {
      const id = sound.play();
      deckSoundIdsRef.current[side] = id;

      setSoundVolume(side, getSideVolume(side));

      if (hasSoundId(id)) {
        sound.rate(getSideRate(side), id);
      }

      if (side === "A") {
        setPlayingA(true);
        setLoadingA(false);
        setErrorA("");
      } else {
        setPlayingB(true);
        setLoadingB(false);
        setErrorB("");
      }
    } catch (error) {
      console.log(`Deck ${side} play failed:`, error);

      if (side === "A") {
        setPlayingA(false);
        setLoadingA(false);
        setErrorA("Could not start playback.");
      } else {
        setPlayingB(false);
        setLoadingB(false);
        setErrorB("Could not start playback.");
      }
    }
  };

  const stopDeck = (side) => {
    const sound = getDeckHowl(side);

    if (!sound) return;

    try {
      if (hasSoundId(getDeckSoundId(side))) {
        sound.stop(getDeckSoundId(side));
      } else {
        sound.stop();
      }

      sound.seek(0);
    } catch {
      sound.stop();
    }

    deckSoundIdsRef.current[side] = null;
    syncWaveformToTime(side, 0, sound.duration() || 1);

    if (side === "A") {
      setPlayingA(false);
      setProgressA(0);
      setTimeA(0);
    } else {
      setPlayingB(false);
      setProgressB(0);
      setTimeB(0);
    }
  };

  const restartDeck = (side) => {
    const sound = getDeckHowl(side);

    if (!sound) return;

    try {
      if (hasSoundId(getDeckSoundId(side))) {
        sound.seek(0, getDeckSoundId(side));
      } else {
        sound.seek(0);
      }
    } catch {
      sound.seek(0);
    }

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

    const current = Number(sound.seek(getDeckSoundId(side))) || 0;
    const next = clamp(current + seconds, 0, duration);

    sound.seek(next, getDeckSoundId(side));
    syncWaveformToTime(side, next, duration);
  };

  const setOrJumpCue = (side, cueNumber) => {
    const sound = getDeckHowl(side);

    if (!sound) return;

    const soundId = getDeckSoundId(side);
    const currentTime = Number(sound.seek(soundId)) || 0;
    const savedCue = cuePoints[side]?.[cueNumber];

    if (savedCue !== undefined) {
      const cueTime =
        typeof savedCue === "object" && savedCue !== null
          ? savedCue.time
          : savedCue;

      sound.seek(cueTime, soundId);
      syncWaveformToTime(side, cueTime, sound.duration() || 1);

      const percentage = clamp(
        (cueTime / (sound.duration() || 1)) * 100,
        0,
        100
      );

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

    scratchRef.current = {
      active: true,
      side,
      lastX: point.x,
      lastY: point.y,
      lastTime: Number(sound.seek(getDeckSoundId(side))) || 0,
    };

    document.body.classList.add("dj-scratching-now");
  };

  const moveScratch = (event) => {
    const scratch = scratchRef.current;

    if (!scratch.active || !scratch.side) return;

    const sound = getDeckHowl(scratch.side);
    const soundId = getDeckSoundId(scratch.side);

    if (!sound) return;

    const point = getPointerPosition(event);
    const dx = point.x - scratch.lastX;
    const dy = point.y - scratch.lastY;
    const movement = dx + dy * 0.35;

    if (Math.abs(movement) < 2) return;

    const duration = sound.duration() || 0;
    const currentTime = Number(sound.seek(soundId)) || scratch.lastTime || 0;
    const nextTime = clamp(
      currentTime + movement * 0.012,
      0,
      duration || currentTime
    );

    try {
      sound.seek(nextTime, soundId);

      const scratchRate = clamp(1 + movement * 0.018, 0.35, 2.4);
      sound.rate(scratchRate, soundId);
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
    const soundId = getDeckSoundId(scratch.side);

    if (sound) {
      try {
        sound.rate(getSideRate(scratch.side), soundId);
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
    window.setTimeout(() => setActivePad(""), 180);

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

      window.setTimeout(() => {
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
      window.setTimeout(() => playWikiScratch(1.6), 80);
      window.setTimeout(() => playWikiScratch(1.9), 160);
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

      window.setTimeout(() => {
        playTone({
          frequency: 520,
          duration: 0.08,
          type: "square",
          volume: 0.08,
        });
      }, 85);

      window.setTimeout(() => playNoise(0.1, 0.045), 160);
    }

    if (item.type === "beat") {
      playTone({
        startFrequency: 160,
        endFrequency: 55,
        duration: 0.16,
        type: "sine",
        volume: 0.18,
      });

      window.setTimeout(() => playNoise(0.045, 0.07), 110);
    }

    if (item.type === "click") {
      playTone({
        frequency: 1700,
        duration: 0.025,
        type: "square",
        volume: 0.075,
      });

      window.setTimeout(() => {
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
    window.setTimeout(() => setActivePad(""), 220);

    if (pad.type === "horn") {
      playTone({
        frequency: 466,
        duration: 0.12,
        type: "square",
        volume: 0.13,
      });

      window.setTimeout(() => {
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
      window.setTimeout(() => playWikiScratch(1.7), 90);
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

      window.setTimeout(() => {
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
    window.setTimeout(() => setActiveFx(""), 350);

    if (fxId === "echo") {
      playTone({
        frequency: 420,
        duration: 0.1,
        type: "triangle",
        volume: 0.08,
      });

      window.setTimeout(() => {
        playTone({
          frequency: 420,
          duration: 0.08,
          type: "triangle",
          volume: 0.045,
        });
      }, 150);

      window.setTimeout(() => {
        playTone({
          frequency: 420,
          duration: 0.06,
          type: "triangle",
          volume: 0.025,
        });
      }, 300);
    }

    if (fxId === "reverb") {
      playNoise(0.8, 0.055);
    }

    if (fxId === "filter") {
      playTone({
        startFrequency: 220,
        endFrequency: 1500,
        duration: 0.45,
        type: "sawtooth",
        volume: 0.055,
      });
    }

    if (fxId === "flanger") {
      playTone({
        startFrequency: 440,
        endFrequency: 520,
        duration: 0.18,
        type: "sine",
        volume: 0.05,
      });

      window.setTimeout(() => {
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

    if (fxId === "siren") {
      triggerPad({ id: "fx-siren", type: "siren" });
    }

    if (fxId === "whoosh") {
      triggerClassicPad({ id: "fx-whoosh", type: "whoosh" });
    }

    if (fxId === "stutter") {
      getTargetSides().forEach((side) => {
        const sound = getDeckHowl(side);
        const soundId = getDeckSoundId(side);

        if (!sound) return;

        const now = Number(sound.seek(soundId)) || 0;

        [80, 160, 240].forEach((delay) => {
          window.setTimeout(() => {
            sound.seek(now, soundId);
          }, delay);
        });
      });
    }
  };

  const triggerLoop = (size) => {
    setActiveLoop(size);
    window.setTimeout(() => setActiveLoop(""), 350);

    const beats = size === "1/2" ? 0.5 : Number(size);

    getTargetSides().forEach((side) => {
      jumpDeck(side, -0.18 * beats);
    });
  };

  const triggerStem = (stemId) => {
    setActiveStem(stemId);
    window.setTimeout(() => setActiveStem(""), 550);

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
  };

  const randomLoad = () => {
    if (!filteredSongs.length) return;

    const randomSong =
      filteredSongs[Math.floor(Math.random() * filteredSongs.length)];

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

      if (recordingUrl) {
        URL.revokeObjectURL(recordingUrl);
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

        setRecordingUrl(URL.createObjectURL(blob));
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
  }, [deckA, mobileView]);

  useEffect(() => {
    if (deckB) {
      createWaveform("B", deckB);
    }
  }, [deckB, mobileView]);

  useEffect(() => {
    progressTimerRef.current = window.setInterval(() => {
      ["A", "B"].forEach((side) => {
        const sound = getDeckHowl(side);

        if (!sound) return;

        const duration = sound.duration();

        if (!duration) return;

        const soundId = getDeckSoundId(side);
        const isActuallyPlaying = hasSoundId(soundId)
          ? sound.playing(soundId)
          : sound.playing();

        const seek = Number(sound.seek(soundId)) || 0;
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

      if (recordingUrl) {
        URL.revokeObjectURL(recordingUrl);
      }
    };
  }, []);

  const renderMiniClassic = () => {
    return (
      <div className="classic-dj-panel">
        <div className="classic-mobile-dropdown d-md-none">
          <label htmlFor="classicPadSelect" className="classic-mobile-label">
            Quick sound pads
          </label>

          <select
            id="classicPadSelect"
            className="form-select classic-pad-select"
            defaultValue=""
            onChange={(event) => {
              const item = classicAllButtons.find(
                (button) => button.id === event.target.value
              );

              if (item) {
                triggerClassicPad(item);
              }

              event.target.value = "";
            }}
          >
            <option value="" disabled>
              Piano to Beat
            </option>

            {classicAllButtons.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
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

  const renderKnob = (label, value, setter) => {
    return (
      <label className="dj-knob-pro">
        <span>{label}</span>

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
              {waveStatus}
            </span>
          </div>
        </div>

        <div className="time-row-pro">
          <span>{formatTime(time)}</span>

          <input
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
          <button type="button" onClick={() => jumpDeck(side, -5)}>
            <FaBackward />
          </button>

          <button type="button" onClick={() => restartDeck(side)}>
            <FaUndo />
          </button>

          <button
            type="button"
            className="play-main-pro"
            onClick={() => toggleDeck(side)}
          >
            {playing ? <FaPause /> : <FaPlay />}
          </button>

          <button type="button" onClick={() => stopDeck(side)}>
            <FaStop />
          </button>

          <button type="button" onClick={() => jumpDeck(side, 5)}>
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
            >
              {cuePoints[side]?.[cue]?.label || `Cue ${cue}`}
            </button>
          ))}
        </div>

        <div className="deck-controls-pro">
          {renderKnob("Vol", volume, setVolume)}
          {renderKnob("Gain", gain, setGain)}

          <label className="dj-knob-pro">
            <span>Pitch</span>

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
          {renderKnob("Low", low, setLow)}
          {renderKnob("Mid", mid, setMid)}
          {renderKnob("High", high, setHigh)}
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
            <span>A</span>
            <span>Crossfader</span>
            <span>B</span>
          </div>

          <input
            type="range"
            min="0"
            max="100"
            value={crossfader}
            onChange={(event) => setCrossfader(Number(event.target.value))}
          />
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

  return (
    <div className="dj-page-pro">
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

          <button type="button" onClick={applyDeckControls}>
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
                {stemButtons.map((stem) => (
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
                      <strong>{stem.icon}</strong>
                      <span>{stem.name}</span>
                    </button>
                  </div>
                ))}
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
                {fxButtons.map((fx) => (
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
                      <strong>{fx.icon}</strong>

                      <span>{fx.name}</span>
                    </button>
                  </div>
                ))}
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
                {djPads.map((pad) => (
                  <div className="col-6 col-sm-4 col-xl-4" key={pad.id}>
                    <button
                      type="button"
                      className={
                        activePad === pad.id ? "pad-pro active" : "pad-pro"
                      }
                      onClick={() => triggerPad(pad)}
                    >
                      <strong>{pad.icon}</strong>

                      <span>{pad.name}</span>
                    </button>
                  </div>
                ))}
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
            <div className="row g-2">
              {filteredSongs.map((song, index) => {
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
                        >
                          A
                        </button>

                        <button
                          type="button"
                          className={loadedB ? "active" : ""}
                          onClick={() => loadToDeck(song, "B")}
                        >
                          B
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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