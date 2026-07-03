import React, { useEffect, useMemo, useRef, useState } from "react";
import "./CSS/DrumSequencer.css";

const STEPS = 16;
const STEPS_PER_BAR = 4;

const drumRows = [
  { id: "kick", name: "Kick", short: "KCK", color: "orange" },
  { id: "snare", name: "Snare", short: "SNR", color: "pink" },
  { id: "clap", name: "Clap", short: "CLP", color: "blue" },
  { id: "hihat", name: "Hi Hat", short: "HAT", color: "green" },
  { id: "openhat", name: "Open Hat", short: "OHT", color: "cyan" },
  { id: "perc", name: "Perc", short: "PRC", color: "purple" },
  { id: "rim", name: "Rim", short: "RIM", color: "yellow" },
];

const presets = {
  Afrobeats: {
    kick: [0, 3, 6, 10, 12],
    snare: [4, 12],
    clap: [4, 12],
    hihat: [0, 2, 4, 6, 8, 10, 12, 14],
    openhat: [7, 15],
    perc: [3, 5, 11, 13],
    rim: [2, 9],
  },
  Amapiano: {
    kick: [0, 6, 8, 14],
    snare: [4, 12],
    clap: [4, 12],
    hihat: [2, 6, 10, 14],
    openhat: [7, 15],
    perc: [3, 11, 13],
    rim: [5, 9],
  },
  Dancehall: {
    kick: [0, 3, 8, 11],
    snare: [4, 12],
    clap: [4, 12],
    hihat: [0, 2, 4, 6, 8, 10, 12, 14],
    openhat: [6, 14],
    perc: [1, 7, 9, 15],
    rim: [5, 13],
  },
  Trap: {
    kick: [0, 7, 10],
    snare: [4, 12],
    clap: [4, 12],
    hihat: [0, 1, 2, 3, 6, 7, 8, 9, 12, 13, 14, 15],
    openhat: [11],
    perc: [5, 15],
    rim: [2, 10],
  },
};

const createEmptyPattern = () => {
  return drumRows.reduce((pattern, row) => {
    pattern[row.id] = Array(STEPS).fill(false);
    return pattern;
  }, {});
};

const createPatternFromPreset = (presetName) => {
  const pattern = createEmptyPattern();
  const preset = presets[presetName] || presets.Afrobeats;

  Object.entries(preset).forEach(([rowId, steps]) => {
    steps.forEach((step) => {
      if (pattern[rowId] && step < STEPS) pattern[rowId][step] = true;
    });
  });

  return pattern;
};

const getBarIndex = (step) => Math.floor(step / STEPS_PER_BAR);

const DrumSequencer = () => {
  const [bpm, setBpm] = useState(120);
  const [swing, setSwing] = useState(8);
  const [masterVolume, setMasterVolume] = useState(88);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [pattern, setPattern] = useState(() => createPatternFromPreset("Afrobeats"));
  const [selectedPreset, setSelectedPreset] = useState("Afrobeats");
  const [selectedTrack, setSelectedTrack] = useState("kick");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [editorOpen, setEditorOpen] = useState(true);
  const [trackVolumes, setTrackVolumes] = useState(() =>
    drumRows.reduce((volumes, row) => {
      volumes[row.id] = 90;
      return volumes;
    }, {})
  );
  const [mutedTracks, setMutedTracks] = useState({});
  const [soloTracks, setSoloTracks] = useState({});

  const audioContextRef = useRef(null);
  const timerRef = useRef(null);
  const stepRef = useRef(0);
  const patternRef = useRef(pattern);
  const bpmRef = useRef(bpm);
  const swingRef = useRef(swing);
  const volumeRef = useRef(masterVolume);
  const trackVolumesRef = useRef(trackVolumes);
  const mutedTracksRef = useRef(mutedTracks);
  const soloTracksRef = useRef(soloTracks);

  const activeBar = getBarIndex(currentStep);
  const selectedRow = drumRows.find((row) => row.id === selectedTrack) || drumRows[0];
  const hasSolo = Object.values(soloTracks).some(Boolean);

  const rowCounts = useMemo(() => {
    return drumRows.reduce((counts, row) => {
      counts[row.id] = pattern[row.id].filter(Boolean).length;
      return counts;
    }, {});
  }, [pattern]);

  const activeCellCount = useMemo(() => {
    return drumRows.reduce((total, row) => total + rowCounts[row.id], 0);
  }, [rowCounts]);

  useEffect(() => {
    patternRef.current = pattern;
  }, [pattern]);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  useEffect(() => {
    swingRef.current = swing;
  }, [swing]);

  useEffect(() => {
    volumeRef.current = masterVolume;
  }, [masterVolume]);

  useEffect(() => {
    trackVolumesRef.current = trackVolumes;
  }, [trackVolumes]);

  useEffect(() => {
    mutedTracksRef.current = mutedTracks;
  }, [mutedTracks]);

  useEffect(() => {
    soloTracksRef.current = soloTracks;
  }, [soloTracks]);

  useEffect(() => {
    return () => {
      window.clearTimeout(timerRef.current);

      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const getAudioContext = async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();
    }

    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }

    return audioContextRef.current;
  };

  const makeNoiseBuffer = (ctx, duration) => {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }

    return buffer;
  };

  const getTrackOutput = (drumId) => {
    const soloState = soloTracksRef.current;
    const muteState = mutedTracksRef.current;
    const anySolo = Object.values(soloState).some(Boolean);

    if (anySolo && !soloState[drumId]) return 0;
    if (muteState[drumId]) return 0;

    return (
      (volumeRef.current / 100) *
      ((trackVolumesRef.current[drumId] ?? 90) / 100)
    );
  };

  const playGeneratedDrum = async (drumId) => {
    const ctx = await getAudioContext();
    const now = ctx.currentTime;
    const volume = Math.max(0.001, getTrackOutput(drumId));

    if (volume <= 0.001) return;

    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    if (drumId === "kick") {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.18);
      gain.gain.setValueAtTime(0.95 * volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.24);
      return;
    }

    if (drumId === "snare") {
      const noise = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      noise.buffer = makeNoiseBuffer(ctx, 0.18);
      filter.type = "highpass";
      filter.frequency.value = 850;
      gain.gain.setValueAtTime(0.48 * volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      noise.connect(filter);
      filter.connect(gain);
      noise.start(now);
      noise.stop(now + 0.18);
      return;
    }

    if (drumId === "clap") {
      [0, 0.025, 0.05].forEach((delay) => {
        const noise = ctx.createBufferSource();
        const clapGain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        noise.buffer = makeNoiseBuffer(ctx, 0.09);
        filter.type = "bandpass";
        filter.frequency.value = 1350;
        clapGain.gain.setValueAtTime(0.28 * volume, now + delay);
        clapGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.08);
        noise.connect(filter);
        filter.connect(clapGain);
        clapGain.connect(ctx.destination);
        noise.start(now + delay);
        noise.stop(now + delay + 0.09);
      });
      return;
    }

    if (drumId === "hihat" || drumId === "openhat") {
      const length = drumId === "openhat" ? 0.22 : 0.055;
      const noise = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      noise.buffer = makeNoiseBuffer(ctx, length);
      filter.type = "highpass";
      filter.frequency.value = drumId === "openhat" ? 5200 : 7200;
      gain.gain.setValueAtTime((drumId === "openhat" ? 0.2 : 0.24) * volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + length);
      noise.connect(filter);
      filter.connect(gain);
      noise.start(now);
      noise.stop(now + length + 0.02);
      return;
    }

    if (drumId === "perc" || drumId === "rim") {
      const osc = ctx.createOscillator();
      osc.type = drumId === "rim" ? "square" : "triangle";
      osc.frequency.setValueAtTime(drumId === "rim" ? 760 : 520, now);
      osc.frequency.exponentialRampToValueAtTime(drumId === "rim" ? 360 : 190, now + 0.08);
      gain.gain.setValueAtTime((drumId === "rim" ? 0.16 : 0.22) * volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.1);
    }
  };

  const playStep = (step) => {
    drumRows.forEach((row) => {
      if (patternRef.current[row.id][step]) {
        playGeneratedDrum(row.id);
      }
    });
  };

  const getStepDelay = (step) => {
    const baseStepTime = (60 / bpmRef.current / 4) * 1000;
    const swingAmount = swingRef.current / 100;

    if (step % 2 === 1) return baseStepTime + baseStepTime * swingAmount * 0.35;
    return baseStepTime - baseStepTime * swingAmount * 0.15;
  };

  const scheduleNextStep = () => {
    timerRef.current = window.setTimeout(() => {
      const nextStep = (stepRef.current + 1) % STEPS;
      stepRef.current = nextStep;
      setCurrentStep(nextStep);
      playStep(nextStep);
      scheduleNextStep();
    }, getStepDelay(stepRef.current));
  };

  const handlePlay = async () => {
    await getAudioContext();

    if (isPlaying) {
      window.clearTimeout(timerRef.current);
      setIsPlaying(false);
      return;
    }

    stepRef.current = currentStep;
    setIsPlaying(true);
    playStep(stepRef.current);
    scheduleNextStep();
  };

  const handleStop = () => {
    window.clearTimeout(timerRef.current);
    stepRef.current = 0;
    setCurrentStep(0);
    setIsPlaying(false);
  };

  const toggleCell = (rowId, stepIndex) => {
    setSelectedTrack(rowId);
    setPattern((prev) => ({
      ...prev,
      [rowId]: prev[rowId].map((active, index) =>
        index === stepIndex ? !active : active
      ),
    }));
  };

  const loadPreset = (presetName) => {
    setSelectedPreset(presetName);
    setPattern(createPatternFromPreset(presetName));
    handleStop();
  };

  const clearPattern = () => {
    setPattern(createEmptyPattern());
    handleStop();
  };

  const duplicateSelectedTrack = () => {
    setPattern((prev) => ({
      ...prev,
      [selectedTrack]: [...prev[selectedTrack]],
    }));
  };

  const randomizeSelectedTrack = () => {
    setPattern((prev) => ({
      ...prev,
      [selectedTrack]: prev[selectedTrack].map(() => Math.random() > 0.68),
    }));
  };

  const shiftSelectedTrack = (direction) => {
    setPattern((prev) => {
      const row = [...prev[selectedTrack]];
      const next =
        direction === "right"
          ? [row[row.length - 1], ...row.slice(0, -1)]
          : [...row.slice(1), row[0]];

      return {
        ...prev,
        [selectedTrack]: next,
      };
    });
  };

  return (
    <main className="sw-daw">
      <header className="sw-topbar">
        <div className="sw-brand">
          <button type="button" onClick={() => setLeftOpen((value) => !value)}>
            ☰
          </button>
          <div>
            <strong>Soundwave Studio</strong>
            <span>Drum Sequencer Project</span>
          </div>
        </div>

        <div className="sw-transport">
          <button type="button" onClick={handlePlay} className={isPlaying ? "pause" : ""}>
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button type="button" onClick={handleStop}>Stop</button>
          <button type="button" onClick={() => playStep(currentStep)}>Preview Step</button>
        </div>

        <div className="sw-global-controls">
          <label>
            BPM
            <input
              type="number"
              min="60"
              max="180"
              value={bpm}
              onChange={(event) => setBpm(Number(event.target.value))}
            />
          </label>
          <button type="button" onClick={() => setRightOpen((value) => !value)}>
            Inspector
          </button>
        </div>
      </header>

      <section className="sw-workspace">
        <aside className={leftOpen ? "sw-left open" : "sw-left"}>
          <div className="sw-panel-head">
            <span>Tracks</span>
            <button type="button" onClick={() => setLeftOpen(false)}>Hide</button>
          </div>

          <div className="sw-add-track">+ Add Drum Track</div>

          <div className="sw-track-list">
            {drumRows.map((row) => (
              <button
                key={row.id}
                type="button"
                className={[
                  "sw-track",
                  row.color,
                  selectedTrack === row.id ? "selected" : "",
                ].join(" ")}
                onClick={() => setSelectedTrack(row.id)}
              >
                <span className="sw-track-dot" />
                <strong>{row.name}</strong>
                <small>{rowCounts[row.id]} hits</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="sw-arrangement">
          <div className="sw-ruler">
            <div className="sw-track-spacer">Pattern</div>
            <div className="sw-ruler-bars">
              {[0, 1, 2, 3].map((bar) => (
                <div
                  key={bar}
                  className={activeBar === bar && isPlaying ? "active" : ""}
                >
                  <span>Bar {bar + 1}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="sw-step-ruler">
            <span />
            <div>
              {Array.from({ length: STEPS }).map((_, index) => (
                <span
                  key={index}
                  className={[
                    index % STEPS_PER_BAR === 0 ? "bar-start" : "",
                    currentStep === index && isPlaying ? "playing" : "",
                    activeBar === getBarIndex(index) && isPlaying ? "bar-active" : "",
                  ].join(" ")}
                >
                  {(index % STEPS_PER_BAR) + 1}
                </span>
              ))}
            </div>
          </div>

          <div className="sw-grid">
            {drumRows.map((row) => (
              <div className="sw-grid-row" key={row.id}>
                <div className={`sw-row-head ${row.color}`}>
                  <button type="button" onClick={() => playGeneratedDrum(row.id)}>
                    {row.short}
                  </button>
                  <div>
                    <strong>{row.name}</strong>
                    <span>Vol {trackVolumes[row.id]}%</span>
                  </div>
                </div>

                <div className="sw-cells">
                  {pattern[row.id].map((active, stepIndex) => (
                    <button
                      type="button"
                      key={`${row.id}-${stepIndex}`}
                      className={[
                        "sw-cell",
                        row.color,
                        active ? "active" : "",
                        stepIndex % STEPS_PER_BAR === 0 ? "bar-start" : "",
                        stepIndex % STEPS_PER_BAR === 3 ? "bar-end" : "",
                        activeBar === getBarIndex(stepIndex) && isPlaying ? "active-bar" : "",
                        currentStep === stepIndex && isPlaying ? "playing" : "",
                      ].join(" ")}
                      onClick={() => toggleCell(row.id, stepIndex)}
                    >
                      <span />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className={rightOpen ? "sw-right open" : "sw-right"}>
          <div className="sw-panel-head">
            <span>Inspector</span>
            <button type="button" onClick={() => setRightOpen(false)}>Hide</button>
          </div>

          <div className="sw-inspector-card">
            <span>Selected Track</span>
            <h3>{selectedRow.name}</h3>
            <p>{rowCounts[selectedTrack]} active hits in this pattern.</p>
          </div>

          <label className="sw-slider-line">
            Track Volume
            <strong>{trackVolumes[selectedTrack]}%</strong>
            <input
              type="range"
              min="0"
              max="100"
              value={trackVolumes[selectedTrack]}
              onChange={(event) =>
                setTrackVolumes((prev) => ({
                  ...prev,
                  [selectedTrack]: Number(event.target.value),
                }))
              }
            />
          </label>

          <div className="sw-two-buttons">
            <button
              type="button"
              className={mutedTracks[selectedTrack] ? "active" : ""}
              onClick={() =>
                setMutedTracks((prev) => ({
                  ...prev,
                  [selectedTrack]: !prev[selectedTrack],
                }))
              }
            >
              Mute
            </button>
            <button
              type="button"
              className={soloTracks[selectedTrack] ? "active" : ""}
              onClick={() =>
                setSoloTracks((prev) => ({
                  ...prev,
                  [selectedTrack]: !prev[selectedTrack],
                }))
              }
            >
              Solo
            </button>
          </div>

          <div className="sw-inspector-actions">
            <button type="button" onClick={randomizeSelectedTrack}>Randomize Row</button>
            <button type="button" onClick={() => shiftSelectedTrack("left")}>Shift Left</button>
            <button type="button" onClick={() => shiftSelectedTrack("right")}>Shift Right</button>
            <button type="button" onClick={duplicateSelectedTrack}>Duplicate Row</button>
          </div>

          <div className="sw-project-stats">
            <div>
              <strong>{activeCellCount}</strong>
              <span>Total Hits</span>
            </div>
            <div>
              <strong>{hasSolo ? "On" : "Off"}</strong>
              <span>Solo Mode</span>
            </div>
          </div>
        </aside>
      </section>

      <footer className={editorOpen ? "sw-bottom-editor open" : "sw-bottom-editor"}>
        <div className="sw-editor-head">
          <div>
            <strong>Drum Row Editor</strong>
            <span>{selectedRow.name} pattern, piano-roll style lane</span>
          </div>
          <div className="sw-editor-actions">
            <button type="button" onClick={() => setEditorOpen((value) => !value)}>
              {editorOpen ? "Hide Editor" : "Open Editor"}
            </button>
            <button type="button" onClick={clearPattern}>Clear All</button>
            {Object.keys(presets).map((preset) => (
              <button
                type="button"
                key={preset}
                className={selectedPreset === preset ? "active" : ""}
                onClick={() => loadPreset(preset)}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {editorOpen && (
          <div className="sw-editor-body">
            <div className={`sw-editor-key ${selectedRow.color}`}>
              <strong>{selectedRow.short}</strong>
              <span>{selectedRow.name}</span>
            </div>

            <div className="sw-editor-cells">
              {pattern[selectedTrack].map((active, stepIndex) => (
                <button
                  type="button"
                  key={`editor-${selectedTrack}-${stepIndex}`}
                  className={[
                    "sw-editor-cell",
                    selectedRow.color,
                    active ? "active" : "",
                    stepIndex % STEPS_PER_BAR === 0 ? "bar-start" : "",
                    currentStep === stepIndex && isPlaying ? "playing" : "",
                  ].join(" ")}
                  onClick={() => toggleCell(selectedTrack, stepIndex)}
                >
                  <small>{stepIndex + 1}</small>
                  <span />
                </button>
              ))}
            </div>
          </div>
        )}
      </footer>

      {!leftOpen && (
        <button type="button" className="sw-floating left" onClick={() => setLeftOpen(true)}>
          Tracks
        </button>
      )}

      {!rightOpen && (
        <button type="button" className="sw-floating right" onClick={() => setRightOpen(true)}>
          Inspector
        </button>
      )}
    </main>
  );
};

export default DrumSequencer;
