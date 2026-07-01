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
    { id: "brake", name: "Vinyl Brake", icon: "🛑" },
    { id: "roll", name: "Beat Roll", icon: "🔁" },
  ];
  
  const loopSizes = ["1/2", "1", "2", "4", "8"];
  
  const Dj = () => {
    const { songs } = useContext(MusicContext);
  
    const deckARef = useRef(null);
    const deckBRef = useRef(null);
    const audioContextRef = useRef(null);
  
    const [deckA, setDeckA] = useState(null);
    const [deckB, setDeckB] = useState(null);
  
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
  
    const stopTouchSteal = (e) => {
      e.stopPropagation();
    };
  
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
        ""
      );
    };
  
    const getSongTitle = (song) => {
      return song?.title || song?.name || "Load a song";
    };
  
    const getArtistName = (song) => {
      if (!song?.artist) return "Choose from your library";
  
      if (typeof song.artist === "string") return song.artist;
  
      return (
        song.artist.name ||
        song.artist.artistName ||
        "Unknown Artist"
      );
    };
  
    const filteredSongs = useMemo(() => {
      const search = searchTerm.toLowerCase().trim();
  
      return (songs || []).filter((song) => {
        const title = getSongTitle(song).toLowerCase();
        const artist = getArtistName(song).toLowerCase();
  
        return title.includes(search) || artist.includes(search);
      });
    }, [songs, searchTerm]);
  
    const unlockAudio = async () => {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new window.AudioContext();
        }
  
        if (audioContextRef.current.state === "suspended") {
          await audioContextRef.current.resume();
        }
      } catch (error) {
        console.log("Audio unlock error:", error);
      }
    };
  
    const getAudioContext = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new window.AudioContext();
      }
  
      return audioContextRef.current;
    };
  
    const updateDeckVolumes = () => {
      const leftPower = (100 - crossfader) / 100;
      const rightPower = crossfader / 100;
  
      if (deckARef.current) {
        deckARef.current.volume = (volumeA / 100) * leftPower;
      }
  
      if (deckBRef.current) {
        deckBRef.current.volume = (volumeB / 100) * rightPower;
      }
    };
  
    const updateDeckSpeeds = () => {
      if (deckARef.current) {
        deckARef.current.playbackRate = Math.max(0.5, 1 + pitchA / 100);
      }
  
      if (deckBRef.current) {
        deckBRef.current.playbackRate = Math.max(0.5, 1 + pitchB / 100);
      }
    };
  
    useEffect(() => {
      updateDeckVolumes();
    }, [volumeA, volumeB, crossfader]);
  
    useEffect(() => {
      updateDeckSpeeds();
    }, [pitchA, pitchB]);
  
    const loadToDeck = async (song, deck) => {
      await unlockAudio();
  
      if (deck === "A") {
        setDeckA(song);
        setPlayingA(false);
        setProgressA(0);
  
        setTimeout(() => {
          deckARef.current?.load();
        }, 50);
      }
  
      if (deck === "B") {
        setDeckB(song);
        setPlayingB(false);
        setProgressB(0);
  
        setTimeout(() => {
          deckBRef.current?.load();
        }, 50);
      }
    };
  
    const toggleDeck = async (deck) => {
      await unlockAudio();
  
      if (deck === "A") {
        if (!deckA || !deckARef.current) return;
  
        if (playingA) {
          deckARef.current.pause();
          setPlayingA(false);
        } else {
          await deckARef.current.play();
          setPlayingA(true);
        }
      }
  
      if (deck === "B") {
        if (!deckB || !deckBRef.current) return;
  
        if (playingB) {
          deckBRef.current.pause();
          setPlayingB(false);
        } else {
          await deckBRef.current.play();
          setPlayingB(true);
        }
      }
    };
  
    const stopDeck = (deck) => {
      if (deck === "A" && deckARef.current) {
        deckARef.current.pause();
        deckARef.current.currentTime = 0;
        setPlayingA(false);
        setProgressA(0);
      }
  
      if (deck === "B" && deckBRef.current) {
        deckBRef.current.pause();
        deckBRef.current.currentTime = 0;
        setPlayingB(false);
        setProgressB(0);
      }
    };
  
    const restartDeck = (deck) => {
      if (deck === "A" && deckARef.current) {
        deckARef.current.currentTime = 0;
        setProgressA(0);
      }
  
      if (deck === "B" && deckBRef.current) {
        deckBRef.current.currentTime = 0;
        setProgressB(0);
      }
    };
  
    const jumpDeck = (deck, seconds) => {
      const audio = deck === "A" ? deckARef.current : deckBRef.current;
  
      if (!audio) return;
  
      audio.currentTime = Math.max(0, audio.currentTime + seconds);
    };
  
    const handleTimeUpdate = (deck) => {
      const audio = deck === "A" ? deckARef.current : deckBRef.current;
  
      if (!audio || !audio.duration) return;
  
      const percentage = (audio.currentTime / audio.duration) * 100;
  
      if (deck === "A") {
        setProgressA(percentage);
      } else {
        setProgressB(percentage);
      }
    };
  
    const seekDeck = (deck, value) => {
      const audio = deck === "A" ? deckARef.current : deckBRef.current;
  
      if (!audio || !audio.duration) return;
  
      audio.currentTime = (Number(value) / 100) * audio.duration;
  
      if (deck === "A") {
        setProgressA(Number(value));
      } else {
        setProgressB(Number(value));
      }
    };
  
    const playTone = async ({
      frequency = 440,
      duration = 0.3,
      type = "sine",
      startFrequency,
      endFrequency,
    }) => {
      await unlockAudio();
  
      const ctx = getAudioContext();
  
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
  
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(
        startFrequency || frequency,
        ctx.currentTime
      );
  
      if (endFrequency) {
        oscillator.frequency.exponentialRampToValueAtTime(
          endFrequency,
          ctx.currentTime + duration
        );
      }
  
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  
      oscillator.connect(gain);
      gain.connect(ctx.destination);
  
      oscillator.start();
      oscillator.stop(ctx.currentTime + duration);
    };
  
    const playNoise = async (duration = 0.25) => {
      await unlockAudio();
  
      const ctx = getAudioContext();
  
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
  
      for (let i = 0; i < bufferSize; i += 1) {
        data[i] = Math.random() * 2 - 1;
      }
  
      const noise = ctx.createBufferSource();
      const gain = ctx.createGain();
  
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  
      noise.buffer = buffer;
      noise.connect(gain);
      gain.connect(ctx.destination);
  
      noise.start();
    };
  
    const triggerPad = async (pad) => {
      await unlockAudio();
  
      setActivePad(pad.id);
  
      setTimeout(() => {
        setActivePad("");
      }, 180);
  
      if (pad.audioUrl) {
        const sample = new Audio(pad.audioUrl);
        sample.volume = 0.9;
        sample.play();
        return;
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
        playNoise(0.08);
        setTimeout(() => playNoise(0.08), 90);
        setTimeout(() => playNoise(0.08), 180);
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
        });
      }
  
      if (pad.type === "crowd") {
        playNoise(0.6);
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
        });
  
        setTimeout(() => {
          playTone({
            frequency: 420,
            duration: 0.12,
            type: "triangle",
          });
        }, 170);
      }
  
      if (fxId === "reverb") {
        playNoise(0.35);
      }
  
      if (fxId === "filter") {
        playTone({
          startFrequency: 220,
          endFrequency: 1100,
          duration: 0.45,
          type: "sawtooth",
        });
      }
  
      if (fxId === "flanger") {
        playTone({
          startFrequency: 700,
          endFrequency: 300,
          duration: 0.35,
          type: "square",
        });
      }
  
      if (fxId === "brake") {
        playTone({
          startFrequency: 600,
          endFrequency: 60,
          duration: 0.65,
          type: "triangle",
        });
      }
  
      if (fxId === "roll") {
        playNoise(0.08);
        setTimeout(() => playNoise(0.08), 110);
        setTimeout(() => playNoise(0.08), 220);
        setTimeout(() => playNoise(0.08), 330);
      }
  
      setTimeout(() => {
        setActiveFx("");
      }, 260);
    };
  
    const triggerLoop = async (size) => {
      await unlockAudio();
  
      setActiveLoop(size);
  
      playTone({
        frequency: 260 + Number(size.replace("/", "")) * 30,
        duration: 0.15,
        type: "square",
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
        <div
          className="dj-knob-control"
          onTouchStart={stopTouchSteal}
          onPointerDown={stopTouchSteal}
        >
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
            className="dj-touch-range"
            type="range"
            min="0"
            max="100"
            value={value}
            onTouchStart={stopTouchSteal}
            onPointerDown={stopTouchSteal}
            onChange={(e) => setValue(Number(e.target.value))}
          />
        </div>
      );
    };
  
    const renderDeck = ({
      side,
      deck,
      audioRef,
      playing,
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
            <div>
              <span>{label}</span>
  
              <h3>{deck ? getSongTitle(deck) : "Load Track"}</h3>
  
              <p>{deck ? getArtistName(deck) : "Select a song"}</p>
            </div>
  
            <div className="deck-bpm-pill">
              {128 + pitch}
              <small>BPM</small>
            </div>
          </div>
  
          <audio
            ref={audioRef}
            src={deck ? getSongAudio(deck) : ""}
            playsInline
            preload="metadata"
            onTimeUpdate={() => handleTimeUpdate(side)}
            onEnded={() => {
              if (side === "A") {
                setPlayingA(false);
              } else {
                setPlayingB(false);
              }
            }}
          />
  
          <div className="deck-body">
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
                className="deck-seek dj-touch-range"
                type="range"
                min="0"
                max="100"
                value={progress}
                onTouchStart={stopTouchSteal}
                onPointerDown={stopTouchSteal}
                onChange={(e) => seekDeck(side, e.target.value)}
              />
            </div>
          </div>
  
          <div className="deck-transport">
            <button
              type="button"
              onTouchStart={stopTouchSteal}
              onPointerDown={stopTouchSteal}
              onClick={() => jumpDeck(side, -5)}
              disabled={!deck}
            >
              <FaBackward />
            </button>
  
            <button
              type="button"
              className="main-play"
              onTouchStart={stopTouchSteal}
              onPointerDown={stopTouchSteal}
              onClick={() => toggleDeck(side)}
              disabled={!deck}
            >
              {playing ? <FaPause /> : <FaPlay />}
            </button>
  
            <button
              type="button"
              onTouchStart={stopTouchSteal}
              onPointerDown={stopTouchSteal}
              onClick={() => stopDeck(side)}
              disabled={!deck}
            >
              <FaStop />
            </button>
  
            <button
              type="button"
              onTouchStart={stopTouchSteal}
              onPointerDown={stopTouchSteal}
              onClick={() => restartDeck(side)}
              disabled={!deck}
            >
              <FaUndo />
            </button>
          </div>
  
          <div className="deck-pro-controls">
            <div className="deck-long-slider">
              <div>
                <FaVolumeUp />
                <span>Vol</span>
              </div>
  
              <input
                className="dj-touch-range"
                type="range"
                min="0"
                max="100"
                value={volume}
                onTouchStart={stopTouchSteal}
                onPointerDown={stopTouchSteal}
                onChange={(e) => setVolume(Number(e.target.value))}
              />
            </div>
  
            <div className="deck-long-slider">
              <div>
                <FaRandom />
                <span>{pitch > 0 ? `+${pitch}` : pitch}%</span>
              </div>
  
              <input
                className="dj-touch-range"
                type="range"
                min="-30"
                max="30"
                value={pitch}
                onTouchStart={stopTouchSteal}
                onPointerDown={stopTouchSteal}
                onChange={(e) => setPitch(Number(e.target.value))}
              />
            </div>
          </div>
  
          <div className="eq-row">
            {renderKnob("Gain", gain, setGain)}
            {renderKnob("Low", low, setLow)}
            {renderKnob("Mid", mid, setMid)}
            {renderKnob("High", high, setHigh)}
          </div>
  
          <div className="hotcue-row">
            {[1, 2, 3, 4].map((cue) => (
              <button
                type="button"
                key={cue}
                onTouchStart={stopTouchSteal}
                onPointerDown={stopTouchSteal}
                onClick={() =>
                  playTone({
                    frequency: 300 + cue * 90,
                    duration: 0.12,
                    type: "square",
                  })
                }
              >
                Cue {cue}
              </button>
            ))}
          </div>
        </div>
      );
    };
  
    return (
      <div className="dj-page-pro">
        <div className="container-fluid px-2 px-md-3 px-xl-4">
          <div className="dj-topbar row align-items-center g-2 g-md-3">
            <div className="col-lg-8">
              <span className="dj-label-pro">SoundWave DJ Control Room</span>
  
              <h1>DJ Essentials</h1>
  
              <p>
                Two decks, compact mixer, EQ knobs, loops, FX rack, sampler pads,
                and your music library.
              </p>
            </div>
  
            <div className="col-lg-4 d-flex justify-content-lg-end gap-2 flex-wrap">
              <button
                type="button"
                className="dj-top-btn ghost"
                onTouchStart={stopTouchSteal}
                onPointerDown={stopTouchSteal}
                onClick={resetMixer}
              >
                <FaRedo />
                Reset
              </button>
  
              <button
                type="button"
                className="dj-top-btn"
                onTouchStart={stopTouchSteal}
                onPointerDown={stopTouchSteal}
                onClick={saveMixSetup}
              >
                <FaSave />
                Save
              </button>
            </div>
          </div>
  
          <div className="mobile-landscape-hint">
            Swipe sideways to see the full DJ controller. Deck A, Mixer, and Deck B stay in one row.
          </div>
  
          <div className="dj-controller-scroll">
            <div className="dj-controller-wide">
              <div className="dj-controller-row">
                <div className="dj-deck-column">
                  {renderDeck({
                    side: "A",
                    deck: deckA,
                    audioRef: deckARef,
                    playing: playingA,
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
  
                <div className="dj-mixer-column">
                  <div className="mixer-pro">
                    <div className="mixer-pro-title">
                      <FaHeadphones />
                      <span>Mixer</span>
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
                        className="dj-touch-range"
                        type="range"
                        min="0"
                        max="100"
                        value={crossfader}
                        onTouchStart={stopTouchSteal}
                        onPointerDown={stopTouchSteal}
                        onChange={(e) => setCrossfader(Number(e.target.value))}
                      />
                    </div>
  
                    <button
                      type="button"
                      className="sync-btn"
                      onTouchStart={stopTouchSteal}
                      onPointerDown={stopTouchSteal}
                      onClick={syncBpm}
                    >
                      <FaSyncAlt />
                      Sync B
                    </button>
  
                    <div className="mini-mixer-buttons">
                      <button
                        type="button"
                        onTouchStart={stopTouchSteal}
                        onPointerDown={stopTouchSteal}
                        onClick={muteDeckA}
                      >
                        <FaVolumeMute />
                        A
                      </button>
  
                      <button
                        type="button"
                        onTouchStart={stopTouchSteal}
                        onPointerDown={stopTouchSteal}
                        onClick={muteDeckB}
                      >
                        <FaVolumeMute />
                        B
                      </button>
                    </div>
  
                    <div className="loop-box">
                      <h4>Loops</h4>
  
                      <div>
                        {loopSizes.map((size) => (
                          <button
                            type="button"
                            key={size}
                            className={activeLoop === size ? "active" : ""}
                            onTouchStart={stopTouchSteal}
                            onPointerDown={stopTouchSteal}
                            onClick={() => triggerLoop(size)}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
  
                    <div className="fx-rack-mini">
                      <FaBolt />
  
                      <h4>FX Rack</h4>
  
                      <p>Ready</p>
                    </div>
                  </div>
                </div>
  
                <div className="dj-deck-column">
                  {renderDeck({
                    side: "B",
                    deck: deckB,
                    audioRef: deckBRef,
                    playing: playingB,
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
  
                <div className="fx-grid-pro">
                  {fxButtons.map((fx) => (
                    <button
                      type="button"
                      key={fx.id}
                      className={
                        activeFx === fx.id
                          ? "fx-button-pro active"
                          : "fx-button-pro"
                      }
                      onTouchStart={stopTouchSteal}
                      onPointerDown={stopTouchSteal}
                      onClick={() => triggerFx(fx.id)}
                    >
                      <strong>{fx.icon}</strong>
  
                      <span>{fx.name}</span>
                    </button>
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
  
                <div className="pad-grid-pro">
                  {djPads.map((pad) => (
                    <button
                      type="button"
                      key={pad.id}
                      className={activePad === pad.id ? "pad-pro active" : "pad-pro"}
                      onTouchStart={stopTouchSteal}
                      onPointerDown={stopTouchSteal}
                      onClick={() => triggerPad(pad)}
                    >
                      <strong>{pad.icon}</strong>
  
                      <span>{pad.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
  
          <div className="dj-panel-pro mt-2 mt-md-3">
            <div className="panel-title-pro library-title-row">
              <div>
                <span>Music Crate</span>
  
                <h2>Load Songs Into Decks</h2>
              </div>
  
              <div className="dj-search-pro">
                <FaSearch />
  
                <input
                  type="text"
                  placeholder="Search your songs..."
                  value={searchTerm}
                  onTouchStart={stopTouchSteal}
                  onPointerDown={stopTouchSteal}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
  
            {filteredSongs.length === 0 ? (
              <div className="dj-empty-pro">No songs found.</div>
            ) : (
              <div className="song-crate-grid">
                {filteredSongs.map((song) => (
                  <div key={song._id} className="crate-song-card">
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
                        onTouchStart={stopTouchSteal}
                        onPointerDown={stopTouchSteal}
                        onClick={() => loadToDeck(song, "A")}
                      >
                        A
                      </button>
  
                      <button
                        type="button"
                        onTouchStart={stopTouchSteal}
                        onPointerDown={stopTouchSteal}
                        onClick={() => loadToDeck(song, "B")}
                      >
                        B
                      </button>
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
                Later your API can return uploaded samples with <code>audioUrl</code>.
                The sampler already supports real files when each pad has an audio URL.
              </p>
            </div>
  
            <FaDownload />
          </div>
        </div>
      </div>
    );
  };
  
  export default Dj;