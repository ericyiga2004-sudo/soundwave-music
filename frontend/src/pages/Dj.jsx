import React, {
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
  } from "react";
  
  import {
    FaBackward,
    FaBolt,
    FaBroadcastTower,
    FaDownload,
    FaHeadphones,
    FaPause,
    FaPlay,
    FaRandom,
    FaRecordVinyl,
    FaRedo,
    FaSave,
    FaSearch,
    FaSlidersH,
    FaStop,
    FaSyncAlt,
    FaUndo,
    FaVolumeMute,
    FaVolumeUp,
  } from "react-icons/fa";
  
  import { Howl, Howler } from "howler";
  import Tuna from "tunajs";
  
  import { MusicContext } from "../context/ShopContext";
  
  import "./CSS/Dj.css";
  
  const djPads = [
    { id: "airhorn", name: "Air Horn", icon: "📯", type: "horn" },
    { id: "scratch", name: "Wiki Wiki", icon: "💿", type: "scratch" },
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
  ];
  
  const loopSizes = ["1/2", "1", "2", "4"];
  
  const clamp = (value, min, max) => {
    return Math.min(max, Math.max(min, Number(value)));
  };
  
  const getAudioFormat = (url) => {
    if (!url) return ["mp3"];
  
    const cleanUrl = url.split("?")[0].toLowerCase();
  
    if (cleanUrl.endsWith(".wav")) return ["wav"];
    if (cleanUrl.endsWith(".ogg")) return ["ogg"];
    if (cleanUrl.endsWith(".m4a")) return ["m4a", "mp4"];
    if (cleanUrl.endsWith(".aac")) return ["aac"];
    if (cleanUrl.endsWith(".mp4")) return ["mp4"];
  
    return ["mp3"];
  };
  
  const Dj = () => {
    const { songs } = useContext(MusicContext);
  
    const deckHowlsRef = useRef({
      A: null,
      B: null,
    });
  
    const deckSoundIdsRef = useRef({
      A: null,
      B: null,
    });
  
    const audioContextRef = useRef(null);
    const tunaRef = useRef(null);
    const howlerSamplesRef = useRef({});
    const progressTimerRef = useRef(null);
  
    const [deckA, setDeckA] = useState(null);
    const [deckB, setDeckB] = useState(null);
  
    const [loadingA, setLoadingA] = useState(false);
    const [loadingB, setLoadingB] = useState(false);
  
    const [playingA, setPlayingA] = useState(false);
    const [playingB, setPlayingB] = useState(false);
  
    const [volumeA, setVolumeA] = useState(85);
    const [volumeB, setVolumeB] = useState(85);
  
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
  
    const [searchTerm, setSearchTerm] = useState("");
    const [activePad, setActivePad] = useState("");
    const [activeFx, setActiveFx] = useState("");
    const [activeLoop, setActiveLoop] = useState("");
  
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
        null
      );
    };
  
    const getSongTitle = (song) => {
      return song?.title || song?.name || "Load Song";
    };
  
    const getArtistName = (song) => {
      if (!song?.artist) return "Choose song";
  
      if (typeof song.artist === "string") return song.artist;
  
      return song.artist.name || song.artist.artistName || "Unknown Artist";
    };
  
    const filteredSongs = useMemo(() => {
      const search = searchTerm.toLowerCase().trim();
  
      return (songs || []).filter((song) => {
        const title = getSongTitle(song).toLowerCase();
        const artist = getArtistName(song).toLowerCase();
  
        return title.includes(search) || artist.includes(search);
      });
    }, [songs, searchTerm]);
  
    const getAudioContext = () => {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;
  
      if (!audioContextRef.current && AudioContextClass) {
        audioContextRef.current = new AudioContextClass();
      }
  
      return audioContextRef.current;
    };
  
    const unlockAudio = async () => {
      try {
        Howler.autoUnlock = true;
        Howler.usingWebAudio = true;
  
        const ctx = getAudioContext();
  
        if (ctx && ctx.state === "suspended") {
          await ctx.resume();
        }
  
        if (Howler.ctx && Howler.ctx.state === "suspended") {
          await Howler.ctx.resume();
        }
  
        if (ctx && !tunaRef.current) {
          try {
            tunaRef.current = new Tuna(ctx);
          } catch (error) {
            console.log("Tuna init skipped:", error);
          }
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
  
    const getDeckFinalVolume = ({
      side,
      volume,
      gain,
      low,
      mid,
      high,
    }) => {
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
      if (side === "A") {
        return getDeckFinalVolume({
          side: "A",
          volume: volumeA,
          gain: gainA,
          low: lowA,
          mid: midA,
          high: highA,
        });
      }
  
      return getDeckFinalVolume({
        side: "B",
        volume: volumeB,
        gain: gainB,
        low: lowB,
        mid: midB,
        high: highB,
      });
    };
  
    const getSideRate = (side) => {
      const pitch = side === "A" ? pitchA : pitchB;
  
      return Math.max(0.5, 1 + pitch / 100);
    };
  
    const applyDeckControls = () => {
      ["A", "B"].forEach((side) => {
        const sound = getDeckHowl(side);
        const soundId = getDeckSoundId(side);
  
        if (!sound) return;
  
        const finalVolume = getSideVolume(side);
        const finalRate = getSideRate(side);
  
        try {
          if (soundId) {
            sound.volume(finalVolume, soundId);
            sound.rate(finalRate, soundId);
          } else {
            sound.volume(finalVolume);
            sound.rate(finalRate);
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
  
      deckHowlsRef.current[side] = null;
      deckSoundIdsRef.current[side] = null;
  
      if (side === "A") {
        setPlayingA(false);
        setProgressA(0);
        setLoadingA(false);
      } else {
        setPlayingB(false);
        setProgressB(0);
        setLoadingB(false);
      }
    };
  
    const createDeckHowl = (side, song) => {
      const audioUrl = getSongAudio(song);
  
      if (!audioUrl) return null;
  
      if (side === "A") {
        setLoadingA(true);
      } else {
        setLoadingB(true);
      }
  
      const sound = new Howl({
        src: [audioUrl],
        html5: false,
        preload: true,
        format: getAudioFormat(audioUrl),
        volume: getSideVolume(side),
        rate: getSideRate(side),
        xhr: {
          method: "GET",
          headers: {},
          withCredentials: false,
        },
        onload: () => {
          if (side === "A") {
            setLoadingA(false);
          } else {
            setLoadingB(false);
          }
  
          applyDeckControls();
        },
        onloaderror: (_, error) => {
          console.log(`Deck ${side} WebAudio load failed. Trying HTML5 fallback:`, error);
  
          try {
            sound.unload();
          } catch {
            /* empty */
          }
  
          const fallback = new Howl({
            src: [audioUrl],
            html5: true,
            preload: true,
            format: getAudioFormat(audioUrl),
            volume: getSideVolume(side),
            rate: getSideRate(side),
            onload: () => {
              if (side === "A") {
                setLoadingA(false);
              } else {
                setLoadingB(false);
              }
  
              applyDeckControls();
            },
            onloaderror: (_, fallbackError) => {
              console.log(`Deck ${side} fallback load failed:`, fallbackError);
  
              if (side === "A") {
                setLoadingA(false);
              } else {
                setLoadingB(false);
              }
            },
            onend: () => {
              if (side === "A") {
                setPlayingA(false);
                setProgressA(0);
              } else {
                setPlayingB(false);
                setProgressB(0);
              }
            },
          });
  
          deckHowlsRef.current[side] = fallback;
        },
        onplayerror: (_, error) => {
          console.log(`Deck ${side} play error:`, error);
  
          sound.once("unlock", () => {
            const id = sound.play();
            deckSoundIdsRef.current[side] = id;
            applyDeckControls();
          });
        },
        onend: () => {
          if (side === "A") {
            setPlayingA(false);
            setProgressA(0);
          } else {
            setPlayingB(false);
            setProgressB(0);
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
        setPlayingA(false);
        setProgressA(0);
      } else {
        setDeckB(song);
        setPlayingB(false);
        setProgressB(0);
      }
  
      setTimeout(() => {
        createDeckHowl(side, song);
      }, 0);
    };
  
    const toggleDeck = async (side) => {
      await unlockAudio();
  
      const deck = side === "A" ? deckA : deckB;
  
      if (!deck) return;
  
      let sound = getDeckHowl(side);
  
      if (!sound) {
        sound = createDeckHowl(side, deck);
      }
  
      if (!sound) return;
  
      const isPlaying = side === "A" ? playingA : playingB;
  
      if (isPlaying) {
        try {
          sound.pause(getDeckSoundId(side));
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
  
        sound.volume(getSideVolume(side), id);
        sound.rate(getSideRate(side), id);
  
        if (side === "A") {
          setPlayingA(true);
        } else {
          setPlayingB(true);
        }
      } catch (error) {
        console.log(`Deck ${side} play failed:`, error);
      }
    };
  
    const stopDeck = (side) => {
      const sound = getDeckHowl(side);
  
      if (!sound) return;
  
      try {
        sound.stop(getDeckSoundId(side));
        sound.seek(0);
      } catch {
        sound.stop();
      }
  
      deckSoundIdsRef.current[side] = null;
  
      if (side === "A") {
        setPlayingA(false);
        setProgressA(0);
      } else {
        setPlayingB(false);
        setProgressB(0);
      }
    };
  
    const restartDeck = (side) => {
      const sound = getDeckHowl(side);
  
      if (!sound) return;
  
      try {
        sound.seek(0, getDeckSoundId(side));
      } catch {
        sound.seek(0);
      }
  
      if (side === "A") {
        setProgressA(0);
      } else {
        setProgressB(0);
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
    };
  
    const seekDeck = (side, value) => {
      const sound = getDeckHowl(side);
  
      if (!sound) return;
  
      const duration = sound.duration();
  
      if (!duration) return;
  
      const nextTime = (Number(value) / 100) * duration;
  
      sound.seek(nextTime, getDeckSoundId(side));
  
      if (side === "A") {
        setProgressA(Number(value));
      } else {
        setProgressB(Number(value));
      }
    };
  
    useEffect(() => {
      progressTimerRef.current = window.setInterval(() => {
        ["A", "B"].forEach((side) => {
          const sound = getDeckHowl(side);
  
          if (!sound) return;
  
          const duration = sound.duration();
  
          if (!duration) return;
  
          const seek = Number(sound.seek(getDeckSoundId(side))) || 0;
          const percentage = clamp((seek / duration) * 100, 0, 100);
  
          if (side === "A") {
            setProgressA(percentage);
          } else {
            setProgressB(percentage);
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
      return () => {
        unloadDeck("A");
        unloadDeck("B");
  
        Object.values(howlerSamplesRef.current).forEach((sound) => {
          try {
            sound.unload();
          } catch (error) {
            console.log("Howler sample cleanup error:", error);
          }
        });
      };
    }, []);
  
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
  
      oscillator.start();
      oscillator.stop(ctx.currentTime + duration);
    };
  
    const playNoise = async (duration = 0.25, volume = 0.18) => {
      await unlockAudio();
  
      const ctx = getAudioContext();
  
      if (!ctx) return;
  
      const bufferSize = ctx.sampleRate * duration;
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
  
      noise.start();
      noise.stop(ctx.currentTime + duration);
    };
  
    const playHowlerSample = async (sampleKey, audioUrl, volume = 0.9) => {
      await unlockAudio();
  
      if (!audioUrl) return false;
  
      if (!howlerSamplesRef.current[sampleKey]) {
        howlerSamplesRef.current[sampleKey] = new Howl({
          src: [audioUrl],
          html5: false,
          preload: true,
          format: getAudioFormat(audioUrl),
          volume,
          onloaderror: (_, error) => {
            console.log("Howler sample load error:", error);
          },
          onplayerror: (_, error) => {
            console.log("Howler sample play error:", error);
          },
        });
      }
  
      howlerSamplesRef.current[sampleKey].volume(volume);
      howlerSamplesRef.current[sampleKey].play();
  
      return true;
    };
  
    const triggerPad = async (pad) => {
      await unlockAudio();
  
      setActivePad(pad.id);
  
      setTimeout(() => {
        setActivePad("");
      }, 180);
  
      if (pad.audioUrl) {
        const played = await playHowlerSample(pad.id, pad.audioUrl, 0.9);
  
        if (played) return;
      }
  
      if (pad.type === "horn") {
        playTone({
          startFrequency: 440,
          endFrequency: 880,
          duration: 0.45,
          type: "square",
        });
  
        setTimeout(() => {
          playTone({
            startFrequency: 380,
            endFrequency: 760,
            duration: 0.35,
            type: "square",
          });
        }, 120);
      }
  
      if (pad.type === "scratch") {
        playNoise(0.08, 0.2);
        setTimeout(() => playNoise(0.08, 0.2), 90);
        setTimeout(() => playNoise(0.08, 0.2), 180);
      }
  
      if (pad.type === "laser") {
        playTone({
          startFrequency: 1200,
          endFrequency: 160,
          duration: 0.35,
          type: "sawtooth",
        });
      }
  
      if (pad.type === "drop") {
        playTone({
          startFrequency: 180,
          endFrequency: 45,
          duration: 0.6,
          type: "sine",
          volume: 0.32,
        });
      }
  
      if (pad.type === "crowd") {
        playNoise(0.6, 0.16);
      }
  
      if (pad.type === "rewind") {
        playTone({
          startFrequency: 900,
          endFrequency: 220,
          duration: 0.5,
          type: "triangle",
        });
      }
  
      if (pad.type === "siren") {
        playTone({
          startFrequency: 500,
          endFrequency: 1000,
          duration: 0.35,
          type: "sawtooth",
        });
  
        setTimeout(() => {
          playTone({
            startFrequency: 1000,
            endFrequency: 500,
            duration: 0.35,
            type: "sawtooth",
          });
        }, 300);
      }
  
      if (pad.type === "tag") {
        playTone({
          frequency: 680,
          duration: 0.12,
          type: "square",
        });
  
        setTimeout(() => {
          playTone({
            frequency: 520,
            duration: 0.12,
            type: "square",
          });
        }, 140);
  
        setTimeout(() => {
          playTone({
            frequency: 760,
            duration: 0.16,
            type: "square",
          });
        }, 280);
      }
    };
  
    const triggerFx = async (fxId) => {
      await unlockAudio();
  
      setActiveFx(fxId);
  
      if (fxId === "echo") {
        playTone({
          frequency: 500,
          duration: 0.12,
          type: "triangle",
          volume: 0.12,
        });
  
        setTimeout(() => {
          playTone({
            frequency: 420,
            duration: 0.12,
            type: "triangle",
            volume: 0.08,
          });
        }, 170);
      }
  
      if (fxId === "reverb") {
        playNoise(0.35, 0.08);
      }
  
      if (fxId === "filter") {
        playTone({
          startFrequency: 220,
          endFrequency: 1100,
          duration: 0.45,
          type: "sawtooth",
          volume: 0.1,
        });
      }
  
      if (fxId === "flanger") {
        playTone({
          startFrequency: 700,
          endFrequency: 300,
          duration: 0.35,
          type: "square",
          volume: 0.1,
        });
      }
  
      if (fxId === "brake") {
        ["A", "B"].forEach((side) => {
          const sound = getDeckHowl(side);
  
          if (!sound || !sound.playing(getDeckSoundId(side))) return;
  
          const oldRate = getSideRate(side);
          const soundId = getDeckSoundId(side);
  
          sound.rate(Math.max(0.35, oldRate * 0.45), soundId);
  
          setTimeout(() => {
            sound.rate(oldRate, soundId);
          }, 500);
        });
  
        playTone({
          startFrequency: 600,
          endFrequency: 60,
          duration: 0.65,
          type: "triangle",
          volume: 0.12,
        });
      }
  
      if (fxId === "roll") {
        ["A", "B"].forEach((side) => {
          const sound = getDeckHowl(side);
  
          if (!sound || !sound.playing(getDeckSoundId(side))) return;
  
          const soundId = getDeckSoundId(side);
          const rollStart = Number(sound.seek(soundId)) || 0;
  
          setTimeout(() => {
            if (sound.playing(soundId)) sound.seek(rollStart, soundId);
          }, 110);
  
          setTimeout(() => {
            if (sound.playing(soundId)) sound.seek(rollStart, soundId);
          }, 220);
  
          setTimeout(() => {
            if (sound.playing(soundId)) sound.seek(rollStart, soundId);
          }, 330);
        });
  
        playNoise(0.08, 0.1);
        setTimeout(() => playNoise(0.08, 0.1), 110);
        setTimeout(() => playNoise(0.08, 0.1), 220);
        setTimeout(() => playNoise(0.08, 0.1), 330);
      }
  
      setTimeout(() => {
        setActiveFx("");
      }, 360);
    };
  
    const triggerLoop = async (size) => {
      await unlockAudio();
  
      setActiveLoop(size);
  
      const parsedSize = size === "1/2" ? 0.5 : Number(size);
      const frequency = 260 + parsedSize * 60;
  
      playTone({
        frequency,
        duration: 0.15,
        type: "square",
        volume: 0.12,
      });
  
      ["A", "B"].forEach((side) => {
        const sound = getDeckHowl(side);
  
        if (!sound || !sound.playing(getDeckSoundId(side))) return;
  
        const soundId = getDeckSoundId(side);
        const loopStart = Number(sound.seek(soundId)) || 0;
        const beatLength = 60 / 128;
        const loopLength = beatLength * parsedSize;
  
        setTimeout(() => {
          if (sound.playing(soundId)) {
            sound.seek(loopStart, soundId);
          }
        }, loopLength * 1000);
      });
  
      setTimeout(() => {
        setActiveLoop("");
      }, 240);
    };
  
    const syncBpm = async () => {
      await unlockAudio();
      setPitchB(pitchA);
      triggerFx("filter");
    };
  
    const muteDeckA = () => {
      setVolumeA((current) => (current === 0 ? 85 : 0));
    };
  
    const muteDeckB = () => {
      setVolumeB((current) => (current === 0 ? 85 : 0));
    };
  
    const resetMixer = () => {
      setVolumeA(85);
      setVolumeB(85);
      setPitchA(0);
      setPitchB(0);
      setGainA(50);
      setGainB(50);
      setLowA(50);
      setMidA(50);
      setHighA(50);
      setLowB(50);
      setMidB(50);
      setHighB(50);
      setCrossfader(50);
    };
  
    const saveMixSetup = () => {
      const mix = {
        deckA,
        deckB,
        volumeA,
        volumeB,
        pitchA,
        pitchB,
        gainA,
        gainB,
        lowA,
        midA,
        highA,
        lowB,
        midB,
        highB,
        crossfader,
        savedAt: new Date().toISOString(),
      };
  
      localStorage.setItem("dj-last-mix", JSON.stringify(mix));
  
      alert("DJ mix setup saved locally.");
    };
  
    const renderKnob = (label, value, setValue) => {
      return (
        <div className="dj-knob-control">
          <div
            className="dj-knob"
            style={{
              "--knob-value": `${value * 2.7}deg`,
            }}
          >
            <span />
          </div>
  
          <p>{label}</p>
  
          <input
            type="range"
            min="0"
            max="100"
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
          />
        </div>
      );
    };
  
    const renderDeck = ({
      side,
      deck,
      playing,
      loading,
      volume,
      setVolume,
      pitch,
      setPitch,
      progress,
      gain,
      setGain,
      low,
      setLow,
      mid,
      setMid,
      high,
      setHigh,
    }) => {
      const label = side === "A" ? "DECK A" : "DECK B";
  
      return (
        <div className="dj-deck-pro">
          <div className="deck-pro-header">
            <div className="min-w-0">
              <span>{label}</span>
  
              <h3>{deck ? getSongTitle(deck) : "Load Track"}</h3>
  
              <p className="d-none d-sm-block">
                {loading
                  ? "Loading audio..."
                  : deck
                    ? getArtistName(deck)
                    : "Select a song"}
              </p>
            </div>
  
            <div className="deck-bpm-pill">
              {128 + pitch}
              <small className="d-none d-md-block">BPM</small>
            </div>
          </div>
  
          <div className="deck-mobile-vinyl d-md-none">
            <div className={playing ? "vinyl-pro spinning" : "vinyl-pro"}>
              <img
                src={getSongImage(deck)}
                alt={getSongTitle(deck)}
                onError={(e) => {
                  e.currentTarget.src = "/fallback-cover.png";
                }}
              />
  
              <div className="vinyl-dot" />
            </div>
          </div>
  
          <div className="deck-body d-none d-md-grid">
            <div className="vinyl-pro-wrap">
              <div className={playing ? "vinyl-pro spinning" : "vinyl-pro"}>
                <img
                  src={getSongImage(deck)}
                  alt={getSongTitle(deck)}
                  onError={(e) => {
                    e.currentTarget.src = "/fallback-cover.png";
                  }}
                />
  
                <div className="vinyl-dot" />
              </div>
            </div>
  
            <div className="deck-wave-panel">
              <div className="fake-wave">
                {Array.from({ length: 32 }).map((_, index) => (
                  <span
                    key={index}
                    style={{
                      height: `${14 + ((index * 11) % 36)}px`,
                    }}
                  />
                ))}
              </div>
  
              <input
                className="deck-seek"
                type="range"
                min="0"
                max="100"
                value={progress}
                onChange={(e) => seekDeck(side, e.target.value)}
              />
            </div>
          </div>
  
          <input
            className="deck-seek d-md-none"
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={(e) => seekDeck(side, e.target.value)}
          />
  
          <div className="deck-transport">
            <button
              type="button"
              onClick={() => jumpDeck(side, -5)}
              disabled={!deck}
            >
              <FaBackward />
            </button>
  
            <button
              type="button"
              className="main-play"
              onClick={() => toggleDeck(side)}
              disabled={!deck || loading}
            >
              {playing ? <FaPause /> : <FaPlay />}
            </button>
  
            <button
              type="button"
              onClick={() => stopDeck(side)}
              disabled={!deck}
            >
              <FaStop />
            </button>
  
            <button
              type="button"
              onClick={() => restartDeck(side)}
              disabled={!deck}
            >
              <FaUndo />
            </button>
          </div>
  
          <div className="row g-1 g-md-2">
            <div className="col-6">
              <div className="deck-long-slider">
                <div>
                  <FaVolumeUp />
                  <span>Vol {volume}</span>
                </div>
  
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  onInput={(e) => setVolume(Number(e.currentTarget.value))}
                />
              </div>
            </div>
  
            <div className="col-6">
              <div className="deck-long-slider">
                <div>
                  <FaRandom />
                  <span>{pitch > 0 ? `+${pitch}` : pitch}%</span>
                </div>
  
                <input
                  type="range"
                  min="-30"
                  max="30"
                  value={pitch}
                  onChange={(e) => setPitch(Number(e.target.value))}
                  onInput={(e) => setPitch(Number(e.currentTarget.value))}
                />
              </div>
            </div>
          </div>
  
          <div className="row g-1 g-md-2 mt-1 mt-md-2">
            <div className="col-3">
              {renderKnob("Gain", gain, setGain)}
            </div>
  
            <div className="col-3">
              {renderKnob("Low", low, setLow)}
            </div>
  
            <div className="col-3">
              {renderKnob("Mid", mid, setMid)}
            </div>
  
            <div className="col-3">
              {renderKnob("High", high, setHigh)}
            </div>
          </div>
  
          <div className="row g-1 mt-1 mt-md-2">
            {[1, 2, 3, 4].map((cue) => (
              <div className="col-3" key={cue}>
                <button
                  type="button"
                  className="hotcue-btn"
                  onClick={() =>
                    playTone({
                      frequency: 300 + cue * 90,
                      duration: 0.12,
                      type: "square",
                      volume: 0.12,
                    })
                  }
                >
                  Cue {cue}
                </button>
              </div>
            ))}
          </div>
        </div>
      );
    };
  
    return (
      <div className="dj-page-pro">
        <div className="container-fluid px-2 px-md-3 px-xl-4">
          <div className="dj-topbar row align-items-center g-2 g-md-3">
            <div className="col-12 col-lg-8">
              <span className="dj-label-pro">SoundWave DJ Control Room</span>
  
              <h1>DJ Essentials</h1>
  
              <p>
                Two decks, mixer, EQ knobs, loops, FX rack, sampler pads, and your music library.
              </p>
            </div>
  
            <div className="col-12 col-lg-4 d-flex justify-content-lg-end gap-2 flex-wrap">
              <button
                type="button"
                className="dj-top-btn ghost"
                onClick={resetMixer}
              >
                <FaRedo />
                Reset
              </button>
  
              <button
                type="button"
                className="dj-top-btn"
                onClick={saveMixSetup}
              >
                <FaSave />
                Save
              </button>
            </div>
          </div>
  
          <div className="bootstrap-layout-warning">
            Bootstrap layout active: Deck A uses <b>col-5</b>, Mixer uses <b>col-2</b>, Deck B uses <b>col-5</b>.
          </div>
  
          <div className="row g-1 g-md-3 align-items-stretch dj-bootstrap-controller">
            <div className="col-5">
              {renderDeck({
                side: "A",
                deck: deckA,
                playing: playingA,
                loading: loadingA,
                volume: volumeA,
                setVolume: setVolumeA,
                pitch: pitchA,
                setPitch: setPitchA,
                progress: progressA,
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
  
            <div className="col-2">
              <div className="mixer-pro h-100">
                <div className="mixer-pro-title">
                  <FaHeadphones />
  
                  <span className="d-none d-md-inline">
                    Mixer
                  </span>
                </div>
  
                <div className="master-meter">
                  <span style={{ height: `${volumeA}%` }} />
                  <span style={{ height: `${volumeB}%` }} />
                </div>
  
                <div className="crossfader-pro">
                  <div>
                    <strong>A</strong>
                    <strong>B</strong>
                  </div>
  
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={crossfader}
                    onChange={(e) => setCrossfader(Number(e.target.value))}
                    onInput={(e) => setCrossfader(Number(e.currentTarget.value))}
                  />
                </div>
  
                <button
                  type="button"
                  className="sync-btn"
                  onClick={syncBpm}
                >
                  <FaSyncAlt />
  
                  <span className="d-none d-md-inline">
                    Sync
                  </span>
                </button>
  
                <div className="row g-1 mt-1 mt-md-2">
                  <div className="col-6">
                    <button
                      type="button"
                      className="mini-mute-btn"
                      onClick={muteDeckA}
                    >
                      <FaVolumeMute />
                      A
                    </button>
                  </div>
  
                  <div className="col-6">
                    <button
                      type="button"
                      className="mini-mute-btn"
                      onClick={muteDeckB}
                    >
                      <FaVolumeMute />
                      B
                    </button>
                  </div>
                </div>
  
                <div className="loop-box">
                  <h4 className="d-none d-md-block">
                    Loops
                  </h4>
  
                  <div className="row g-1">
                    {loopSizes.map((size) => (
                      <div className="col-6" key={size}>
                        <button
                          type="button"
                          className={activeLoop === size ? "active" : ""}
                          onClick={() => triggerLoop(size)}
                        >
                          {size}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
  
                <div className="fx-rack-mini d-none d-md-block">
                  <FaBolt />
  
                  <h4>FX Rack</h4>
  
                  <p>Ready</p>
                </div>
              </div>
            </div>
  
            <div className="col-5">
              {renderDeck({
                side: "B",
                deck: deckB,
                playing: playingB,
                loading: loadingB,
                volume: volumeB,
                setVolume: setVolumeB,
                pitch: pitchB,
                setPitch: setPitchB,
                progress: progressB,
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
            <div className="col-12 col-xl-5">
              <div className="dj-panel-pro h-100">
                <div className="panel-title-pro">
                  <div>
                    <span>FX Unit</span>
  
                    <h2>Performance Effects</h2>
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
              </div>
            </div>
  
            <div className="col-12 col-xl-7">
              <div className="dj-panel-pro h-100">
                <div className="panel-title-pro">
                  <div>
                    <span>Sampler</span>
  
                    <h2>DJ Sound Collection</h2>
                  </div>
  
                  <FaRecordVinyl />
                </div>
  
                <div className="row g-2">
                  {djPads.map((pad) => (
                    <div className="col-4 col-md-3" key={pad.id}>
                      <button
                        type="button"
                        className={activePad === pad.id ? "pad-pro active" : "pad-pro"}
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
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>
  
            {filteredSongs.length === 0 ? (
              <div className="dj-empty-pro">No songs found.</div>
            ) : (
              <div className="row g-2">
                {filteredSongs.map((song, index) => (
                  <div
                    className="col-12 col-md-6 col-xl-4"
                    key={song._id || song.id || `${getSongTitle(song)}-${index}`}
                  >
                    <div className="crate-song-card">
                      <img
                        src={getSongImage(song)}
                        alt={getSongTitle(song)}
                        onError={(e) => {
                          e.currentTarget.src = "/fallback-cover.png";
                        }}
                      />
  
                      <div>
                        <h4>{getSongTitle(song)}</h4>
  
                        <p>{getArtistName(song)}</p>
                      </div>
  
                      <div className="crate-actions">
                        <button
                          type="button"
                          onClick={() => loadToDeck(song, "A")}
                        >
                          A
                        </button>
  
                        <button
                          type="button"
                          onClick={() => loadToDeck(song, "B")}
                        >
                          B
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
  
          <div className="future-api-pro">
            <FaBroadcastTower />
  
            <div>
              <h3>DJ Sounds API Ready</h3>
  
              <p>
                Deck A, Deck B, sampler pads, generated tones, loops, volume, gain,
                pitch, mute, and crossfader now run through Howler/Web Audio first.
                If a browser blocks Web Audio loading, it falls back to HTML5 audio.
              </p>
            </div>
  
            <FaDownload className="d-none d-md-block" />
          </div>
        </div>
      </div>
    );
  };
  
  export default Dj;