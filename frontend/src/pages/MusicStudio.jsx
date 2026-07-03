import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FaBars,
  FaCircle,
  FaCopy,
  FaDownload,
  FaMicrophone,
  FaPause,
  FaPlay,
  FaSave,
  FaStop,
  FaTrash,
  FaUndo,
  FaRedo,
  FaArrowRight,
  FaVolumeMute,
  FaVolumeUp,
} from "react-icons/fa";
import { GiDrumKit, GiGuitarBassHead } from "react-icons/gi";
import { IoClose, IoSettingsSharp } from "react-icons/io5";
import { MdGraphicEq, MdPiano } from "react-icons/md";
import { TbPiano, TbWaveSine } from "react-icons/tb";
import "./CSS/MusicStudio.css";

const TOTAL_BARS = 32;
const STEPS_PER_BAR = 4;
const TOTAL_STEPS = TOTAL_BARS * STEPS_PER_BAR;
const TRACK_HEIGHT = 72;
const TRACK_HEADER_WIDTH = 190;
const NOTE_LABEL_WIDTH = 68;
const NOTE_ROW_HEIGHT = 22;
const NOTE_STEP_PX = 34;
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_SEC = 0.12;
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const MIDI_C1 = 24;
const MIDI_C8 = 108;
const MIN_PIANO_STEPS = 16;

const ZOOM_LEVELS = [
  { name: "16 bars", stepPx: 8, showSixteenths: false, showBeats: false, showBars: false, showFourBars: true, showEightBars: true, showSixteenBars: true },
  { name: "8 bars", stepPx: 14, showSixteenths: false, showBeats: false, showBars: true, showFourBars: true, showEightBars: true, showSixteenBars: true },
  { name: "4 bars", stepPx: 24, showSixteenths: false, showBeats: true, showBars: true, showFourBars: true, showEightBars: true, showSixteenBars: true },
  { name: "1 bar", stepPx: 42, showSixteenths: true, showBeats: true, showBars: true, showFourBars: true, showEightBars: true, showSixteenBars: true },
  { name: "detail", stepPx: 64, showSixteenths: true, showBeats: true, showBars: true, showFourBars: true, showEightBars: true, showSixteenBars: true },
];

const tracks = [
  { id: "drums", name: "Drums", Icon: GiDrumKit, color: "red", type: "drums" },
  { id: "piano", name: "Piano", Icon: MdPiano, color: "blue", type: "piano" },
  { id: "bass", name: "Bass", Icon: GiGuitarBassHead, color: "green", type: "bass" },
  { id: "synth", name: "Synth", Icon: TbWaveSine, color: "purple", type: "synth" },
  { id: "vocals", name: "Vox", Icon: FaMicrophone, color: "pink", type: "audio" },
  { id: "fx", name: "FX", Icon: MdGraphicEq, color: "orange", type: "fx" },
];

const libraryItems = tracks.map((track) => ({
  label: track.name,
  Icon: track.Icon,
  type: track.type,
  trackId: track.id,
  color: track.color,
}));

const drumRows = [
  { id: "kick", label: "Kick", short: "K" },
  { id: "snare", label: "Snare", short: "S" },
  { id: "clap", label: "Clap", short: "C" },
  { id: "hat", label: "Hi Hat", short: "H" },
  { id: "openhat", label: "Open Hat", short: "O" },
  { id: "perc", label: "Perc", short: "P" },
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const uid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const stepMs = (bpm) => (60 / bpm / STEPS_PER_BAR) * 1000;
const stepSeconds = (bpm) => stepMs(bpm) / 1000;
const isMidiClip = (clip) => ["piano", "bass", "synth"].includes(clip?.type);
const isTypingTarget = (target) =>
  ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName) || target?.isContentEditable;

const midiToNote = (midi) => {
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[midi % 12]}${octave}`;
};

const noteToMidi = (note) => {
  const match = /^([A-G]#?)(-?\d+)$/.exec(note);
  if (!match) return 60;
  const [, name, octaveText] = match;
  return (Number(octaveText) + 1) * 12 + NOTE_NAMES.indexOf(name);
};

const midiToFrequency = (midi) => 440 * 2 ** ((midi - 69) / 12);
const noteToFrequency = (note) => midiToFrequency(noteToMidi(note));
const isBlackKey = (note) => note.includes("#");
const noteRange = Array.from({ length: MIDI_C8 - MIDI_C1 + 1 }, (_, index) => midiToNote(MIDI_C8 - index));

const stepToBars = (step) => {
  const bar = Math.floor(step / STEPS_PER_BAR) + 1;
  const beat = (step % STEPS_PER_BAR) + 1;
  return `${bar}.${beat}.1`;
};

const timeText = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const tenths = Math.floor((seconds % 1) * 10);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${tenths}`;
};

const makeDrumPattern = (preset = "afro") => {
  const pattern = drumRows.reduce((next, row) => ({ ...next, [row.id]: Array(16).fill(false) }), {});
  const hit = (row, steps) => steps.forEach((step) => (pattern[row][step] = true));

  if (preset === "amapiano") {
    hit("kick", [0, 6, 8, 14]);
    hit("snare", [4, 12]);
    hit("clap", [4, 12]);
    hit("hat", [2, 6, 10, 14]);
    hit("openhat", [7, 15]);
    hit("perc", [3, 11, 13]);
    return pattern;
  }

  if (preset === "trap") {
    hit("kick", [0, 7, 10]);
    hit("snare", [4, 12]);
    hit("clap", [4, 12]);
    hit("hat", [0, 1, 2, 3, 6, 7, 8, 9, 12, 13, 14, 15]);
    hit("openhat", [11]);
    hit("perc", [5, 15]);
    return pattern;
  }

  hit("kick", [0, 3, 6, 10, 12]);
  hit("snare", [4, 12]);
  hit("clap", [4, 12]);
  hit("hat", [0, 2, 4, 6, 8, 10, 12, 14]);
  hit("openhat", [7, 15]);
  hit("perc", [3, 5, 11, 13]);
  return pattern;
};

const makeNotes = (type = "piano") => {
  if (type === "bass") {
    return [
      { id: uid("note"), note: "C2", start: 0, length: 4 },
      { id: uid("note"), note: "G2", start: 8, length: 4 },
      { id: uid("note"), note: "A#2", start: 16, length: 4 },
      { id: uid("note"), note: "F2", start: 24, length: 4 },
    ];
  }

  if (type === "synth") {
    return [
      { id: uid("note"), note: "C5", start: 0, length: 8 },
      { id: uid("note"), note: "D#5", start: 8, length: 8 },
      { id: uid("note"), note: "G5", start: 16, length: 8 },
      { id: uid("note"), note: "A#5", start: 24, length: 8 },
    ];
  }

  return [
    { id: uid("note"), note: "C4", start: 0, length: 3 },
    { id: uid("note"), note: "D#4", start: 4, length: 3 },
    { id: uid("note"), note: "G4", start: 8, length: 4 },
    { id: uid("note"), note: "C5", start: 14, length: 4 },
  ];
};

const makeClip = ({ type, trackId, color, name, start = 0, length }) => {
  const base = {
    id: uid("clip"),
    trackId,
    type,
    name,
    start,
    length: length || (type === "fx" ? 4 : 16),
    color,
  };

  if (type === "drums") return { ...base, data: { pattern: makeDrumPattern() } };
  if (["piano", "bass", "synth"].includes(type)) return { ...base, data: { notes: makeNotes(type) } };
  return { ...base, data: { hits: [0] } };
};

const initialClips = [
  makeClip({ type: "drums", trackId: "drums", color: "red", name: "Afro Drums", start: 0, length: 16 }),
  makeClip({ type: "piano", trackId: "piano", color: "blue", name: "Main Keys", start: 16, length: 16 }),
  makeClip({ type: "bass", trackId: "bass", color: "green", name: "Bassline", start: 0, length: 32 }),
  makeClip({ type: "synth", trackId: "synth", color: "purple", name: "Pad", start: 24, length: 24 }),
  makeClip({ type: "fx", trackId: "fx", color: "orange", name: "Rise", start: 44, length: 8 }),
];

const clipAtStep = (clip, step) => step >= clip.start && step < clip.start + clip.length;
const localStep = (clip, step) => step - clip.start;
const pitchPreviewY = (note) => {
  const midi = noteToMidi(note);
  return clamp(100 - ((midi - MIDI_C1) / (MIDI_C8 - MIDI_C1)) * 100, 8, 84);
};

const MusicStudio = () => {
  const [projectName, setProjectName] = useState("New Project");
  const [clips, setClips] = useState(initialClips);
  const [selectedClipId, setSelectedClipId] = useState(initialClips[0].id);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [bpm, setBpm] = useState(120);
  const [currentStep, setCurrentStep] = useState(0);
  const [patternStep, setPatternStep] = useState(0);
  const [playMode, setPlayMode] = useState("playlist");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [loopEnabled, setLoopEnabled] = useState(true);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [masterVolume, setMasterVolume] = useState(84);
  const [trackVolumes, setTrackVolumes] = useState(() => tracks.reduce((next, track) => ({ ...next, [track.id]: 88 }), {}));
  const [muted, setMuted] = useState({});
  const [solo, setSolo] = useState({});
  const [armed, setArmed] = useState({});
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [timerOpen, setTimerOpen] = useState(false);
  const [seekValue, setSeekValue] = useState("");
  const [activeKeys, setActiveKeys] = useState({});
  const [keyboardOctave, setKeyboardOctave] = useState(4);
  const [zoomIndex, setZoomIndex] = useState(3);
  const [followPlayhead, setFollowPlayhead] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [toast, setToast] = useState("");
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [pianoRollOpen, setPianoRollOpen] = useState(false);
  const [pianoRollModal, setPianoRollModal] = useState({ x: 180, y: 120, width: 900, height: 520, maximized: false });

  const audioCtxRef = useRef(null);
  const schedulerRef = useRef(null);
  const nextNoteTimeRef = useRef(0);
  const scheduledStepRef = useRef(0);
  const currentStepRef = useRef(0);
  const patternStepRef = useRef(0);
  const isPlayingRef = useRef(false);
  const playModeRef = useRef("playlist");
  const clipsRef = useRef(clips);
  const selectedClipIdRef = useRef(selectedClipId);
  const transportRef = useRef({});
  const timelineScrollRef = useRef(null);
  const pianoRollScrollRef = useRef(null);
  const pianoRollGridRef = useRef(null);
  const dragRef = useRef(null);
  const noteDragRef = useRef(null);
  const modalDragRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingStartStepRef = useRef(0);
  const recordedBuffersRef = useRef({});
  const lastPreviewNoteRef = useRef(null);
  const userScrollPauseRef = useRef(false);
  const userScrollTimerRef = useRef(null);

  const selectedClip = clips.find((clip) => clip.id === selectedClipId) || null;
  const selectedNote = selectedClip?.data?.notes?.find((note) => note.id === selectedNoteId) || null;
  const selectedTrackId = selectedClip?.trackId || "piano";
  const selectedTrack = tracks.find((track) => track.id === selectedTrackId) || tracks[1];
  const isMidiSelected = isMidiClip(selectedClip);
  const zoom = ZOOM_LEVELS[zoomIndex];
  const stepPx = zoom.stepPx;
  const pianoStepPx = NOTE_STEP_PX;
  const pianoStepCount = selectedClip ? Math.max(MIN_PIANO_STEPS, selectedClip.length) : 64;
  const pianoRollWidth = pianoStepCount * pianoStepPx;
  const timelineWidth = TOTAL_STEPS * stepPx;
  const projectSeconds = (currentStep * stepMs(bpm)) / 1000;
  const keyboardNotes = useMemo(() => Array.from({ length: 12 }, (_, index) => midiToNote((keyboardOctave + 1) * 12 + index)), [keyboardOctave]);
  const pianoRollPlayStep = useMemo(() => {
    if (!selectedClip) return 0;
    if (playMode === "pattern") return clamp(patternStep, 0, Math.max(0, pianoStepCount - 1));
    if (!clipAtStep(selectedClip, currentStep)) return currentStep < selectedClip.start ? 0 : selectedClip.length;
    return clamp(currentStep - selectedClip.start, 0, selectedClip.length);
  }, [currentStep, patternStep, playMode, selectedClip, pianoStepCount]);
  const drumEditorStep = selectedClip?.type === "drums"
    ? playMode === "pattern"
      ? patternStep % 16
      : clipAtStep(selectedClip, currentStep)
        ? (currentStep - selectedClip.start) % 16
        : -1
    : -1;

  useEffect(() => {
    clipsRef.current = clips;
  }, [clips]);

  useEffect(() => {
    selectedClipIdRef.current = selectedClipId;
  }, [selectedClipId]);

  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  useEffect(() => {
    patternStepRef.current = patternStep;
  }, [patternStep]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    playModeRef.current = playMode;
  }, [playMode]);

  useEffect(() => {
    transportRef.current = { bpm, masterVolume, trackVolumes, muted, solo, metronomeEnabled, loopEnabled, playMode };
  }, [bpm, masterVolume, trackVolumes, muted, solo, metronomeEnabled, loopEnabled, playMode]);

  const getTimelineStepFromClientX = (clientX) => {
    const container = timelineScrollRef.current;
    if (!container) return currentStepRef.current;
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left + container.scrollLeft - TRACK_HEADER_WIDTH;
    return clamp(Math.round(x / stepPx), 0, TOTAL_STEPS - 1);
  };

  const getPianoStepFromClientX = (clientX) => {
    const container = pianoRollScrollRef.current;
    if (!container) return patternStepRef.current;
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left + container.scrollLeft - NOTE_LABEL_WIDTH;
    return clamp(Math.round(x / pianoStepPx), 0, pianoStepCount - 1);
  };

  const seekPianoRollLocal = (localStep) => {
    const local = clamp(Math.round(localStep), 0, pianoStepCount - 1);
    if (!selectedClip) return;
    if (playModeRef.current === "pattern") seekPatternToStep(local);
    else seekToStep(selectedClip.start + local);
  };

  useEffect(() => {
    const onPointerMove = (event) => {
      if (dragRef.current?.type === "playhead") {
        seekToStep(getTimelineStepFromClientX(event.clientX));
        return;
      }

      if (dragRef.current?.type === "piano-playhead") {
        seekPianoRollLocal(getPianoStepFromClientX(event.clientX));
        return;
      }

      if (dragRef.current?.type === "clip") {
        const { clipId, mode, grabOffset = 0, startValue, startLength } = dragRef.current;
        const pointerStep = getTimelineStepFromClientX(event.clientX);
        setClips((prev) =>
          prev.map((clip) => {
            if (clip.id !== clipId) return clip;
            const minLength = clip.type === "fx" || clip.type === "audio" ? 1 : 4;
            if (mode === "resize-right") return { ...clip, length: clamp(pointerStep - clip.start, minLength, TOTAL_STEPS - clip.start) };
            if (mode === "resize-left") {
              const end = startValue + startLength;
              const nextStart = clamp(pointerStep, 0, end - minLength);
              return { ...clip, start: nextStart, length: end - nextStart };
            }
            return { ...clip, start: clamp(pointerStep - grabOffset, 0, TOTAL_STEPS - clip.length) };
          })
        );
      }

      if (noteDragRef.current) {
        const { noteId, startX, startY, startStart, startLength, startMidi, mode } = noteDragRef.current;
        const stepDelta = Math.round((event.clientX - startX) / pianoStepPx);
        const midiDelta = -Math.round((event.clientY - startY) / NOTE_ROW_HEIGHT);
        const nextNoteName = midiToNote(clamp(startMidi + midiDelta, MIDI_C1, MIDI_C8));

        if (mode === "move" && nextNoteName !== lastPreviewNoteRef.current) {
          lastPreviewNoteRef.current = nextNoteName;
          playPiano(nextNoteName, undefined, selectedClip?.trackId || "piano");
        }

        updateNote(noteId, (note) => {
          if (mode === "resize-right") return { ...note, length: clamp(startLength + stepDelta, 1, pianoStepCount - startStart) };
          if (mode === "resize-left") {
            const originalEnd = startStart + startLength;
            const nextStart = clamp(startStart + stepDelta, 0, originalEnd - 1);
            return { ...note, start: nextStart, length: originalEnd - nextStart };
          }
          return {
            ...note,
            start: clamp(startStart + stepDelta, 0, pianoStepCount - note.length),
            note: nextNoteName,
          };
        }, false);
      }

      if (modalDragRef.current) {
        const { startX, startY, startModal, mode } = modalDragRef.current;
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        setPianoRollModal((prev) => {
          if (prev.maximized) return prev;
          if (mode === "resize") {
            return {
              ...prev,
              width: clamp(startModal.width + dx, 480, window.innerWidth - 24),
              height: clamp(startModal.height + dy, 300, window.innerHeight - 90),
            };
          }
          return {
            ...prev,
            x: clamp(startModal.x + dx, 8, window.innerWidth - startModal.width - 8),
            y: clamp(startModal.y + dy, 72, window.innerHeight - startModal.height - 8),
          };
        });
      }
    };

    const clearDrag = () => {
      dragRef.current = null;
      noteDragRef.current = null;
      modalDragRef.current = null;
      lastPreviewNoteRef.current = null;
      document.body.classList.remove("is-dragging");
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", clearDrag);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", clearDrag);
    };
  }, [selectedClipId, stepPx]);

  useEffect(() => {
    if (!followPlayhead || !timelineScrollRef.current || !isPlaying || userScrollPauseRef.current) return;
    if (playMode !== "playlist") return;
    const container = timelineScrollRef.current;
    const playheadX = TRACK_HEADER_WIDTH + currentStep * stepPx;
    const visibleLeft = container.scrollLeft;
    const visibleRight = visibleLeft + container.clientWidth;
    const margin = container.clientWidth * 0.35;
    if (playheadX > visibleRight - margin) {
      container.scrollTo({ left: Math.max(0, playheadX - container.clientWidth * 0.45), behavior: "smooth" });
    } else if (playheadX < visibleLeft + margin) {
      container.scrollTo({ left: Math.max(0, playheadX - container.clientWidth * 0.25), behavior: "smooth" });
    }
  }, [currentStep, stepPx, followPlayhead, isPlaying, playMode]);

  useEffect(() => {
    if (!followPlayhead || !pianoRollOpen || !pianoRollScrollRef.current || !isPlaying || userScrollPauseRef.current) return;
    const container = pianoRollScrollRef.current;
    const playheadX = NOTE_LABEL_WIDTH + pianoRollPlayStep * pianoStepPx;
    const visibleLeft = container.scrollLeft;
    const visibleRight = visibleLeft + container.clientWidth;
    const margin = container.clientWidth * 0.35;
    if (playheadX > visibleRight - margin) {
      container.scrollTo({ left: Math.max(0, playheadX - container.clientWidth * 0.45), behavior: "smooth" });
    } else if (playheadX < visibleLeft + margin) {
      container.scrollTo({ left: Math.max(0, playheadX - container.clientWidth * 0.25), behavior: "smooth" });
    }
  }, [pianoRollPlayStep, pianoRollOpen, followPlayhead, isPlaying, pianoStepPx]);

  useEffect(() => {
    if (!selectedNoteId || !pianoRollScrollRef.current || !selectedClip?.data?.notes) return;
    const note = selectedClip.data.notes.find((item) => item.id === selectedNoteId);
    if (!note) return;
    const rowIndex = noteRange.indexOf(note.note);
    if (rowIndex < 0) return;
    const container = pianoRollScrollRef.current;
    const noteY = 28 + rowIndex * NOTE_ROW_HEIGHT;
    if (noteY < container.scrollTop || noteY > container.scrollTop + container.clientHeight - 60) {
      container.scrollTo({ top: Math.max(0, noteY - container.clientHeight * 0.45), behavior: "smooth" });
    }
  }, [selectedNoteId, selectedClip]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      const typing = isTypingTarget(target);

      if ((event.code === "Space" || event.key === " ") && !typing) {
        event.preventDefault();
        togglePlay();
        return;
      }

      if (event.key === "Enter" && timerOpen) {
        event.preventDefault();
        seekToStep(parseSeek(seekValue));
        setTimerOpen(false);
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveProject();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateClip();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && (event.key === "+" || event.key === "=")) {
        event.preventDefault();
        setZoomIndex((value) => clamp(value + 1, 0, ZOOM_LEVELS.length - 1));
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === "-") {
        event.preventDefault();
        setZoomIndex((value) => clamp(value - 1, 0, ZOOM_LEVELS.length - 1));
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === "0") {
        event.preventDefault();
        zoomToFit();
        return;
      }

      if (event.key === "Escape") {
        closePianoRoll();
        setTimerOpen(false);
        setRightOpen(false);
        return;
      }

      if ((event.key === "Delete" || event.key === "Backspace") && !typing) {
        event.preventDefault();
        if (selectedNoteId && isMidiSelected) deleteNoteById(selectedNoteId);
        else deleteClip();
        return;
      }

      const keyMap = { a: "C4", w: "C#4", s: "D4", e: "D#4", d: "E4", f: "F4", t: "F#4", g: "G4", y: "G#4", h: "A4", u: "A#4", j: "B4", k: "C5" };
      const note = keyMap[event.key.toLowerCase()];
      if (!typing && note && !event.repeat) {
        setActiveKeys((prev) => ({ ...prev, [note]: true }));
        playPiano(note, undefined, "piano");
      }
    };

    const onKeyUp = (event) => {
      const keyMap = { a: "C4", w: "C#4", s: "D4", e: "D#4", d: "E4", f: "F4", t: "F#4", g: "G4", y: "G#4", h: "A4", u: "A#4", j: "B4", k: "C5" };
      const note = keyMap[event.key.toLowerCase()];
      if (note) setActiveKeys((prev) => ({ ...prev, [note]: false }));
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [isPlaying, timerOpen, seekValue, selectedNoteId, selectedClipId, isMidiSelected]);

  useEffect(() => {
    return () => {
      stopScheduler();
      mediaRecorderRef.current?.stop?.();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, []);

  const snapshot = (sourceClips = clipsRef.current) => ({
    clips: JSON.parse(JSON.stringify(sourceClips)),
    selectedClipId,
  });

  const pushHistory = () => {
    setUndoStack((prev) => [...prev.slice(-24), snapshot()]);
    setRedoStack([]);
  };

  const undo = () => {
    setUndoStack((prev) => {
      if (!prev.length) return prev;
      const last = prev[prev.length - 1];
      setRedoStack((redoPrev) => [...redoPrev.slice(-24), snapshot()]);
      setClips(last.clips);
      setSelectedClipId(last.clips.some((clip) => clip.id === last.selectedClipId) ? last.selectedClipId : last.clips[0]?.id || null);
      return prev.slice(0, -1);
    });
  };

  const redo = () => {
    setRedoStack((prev) => {
      if (!prev.length) return prev;
      const next = prev[prev.length - 1];
      setUndoStack((undoPrev) => [...undoPrev.slice(-24), snapshot()]);
      setClips(next.clips);
      setSelectedClipId(next.clips.some((clip) => clip.id === next.selectedClipId) ? next.selectedClipId : next.clips[0]?.id || null);
      return prev.slice(0, -1);
    });
  };

  const getAudioContext = async () => {
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtxRef.current.state === "suspended") await audioCtxRef.current.resume();
    return audioCtxRef.current;
  };

  const trackOutput = (trackId) => {
    const state = transportRef.current;
    const anySolo = Object.values(state.solo || {}).some(Boolean);
    if (anySolo && !state.solo[trackId]) return 0;
    if (state.muted?.[trackId]) return 0;
    return ((state.masterVolume || 80) / 100) * (((state.trackVolumes || {})[trackId] || 80) / 100);
  };

  const makeNoise = (ctx, duration) => {
    const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * duration)), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
    return buffer;
  };

  const playTone = async ({ frequency, time, duration = 0.22, type = "triangle", volume = 0.25, trackId = "piano" }) => {
    const ctx = await getAudioContext();
    const start = time ?? ctx.currentTime;
    const output = trackOutput(trackId);
    if (output <= 0) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(volume * output, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  };

  const playPiano = (note, time, trackId = "piano", velocity = 0.85) => {
    playTone({ frequency: noteToFrequency(note), time, duration: 0.32, type: trackId === "bass" ? "sawtooth" : "triangle", volume: 0.24 * velocity, trackId });
  };

  const playDrum = async (drumId, time) => {
    const ctx = await getAudioContext();
    const start = time ?? ctx.currentTime;
    const output = trackOutput("drums");
    if (output <= 0) return;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    if (drumId === "kick") {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(145, start);
      osc.frequency.exponentialRampToValueAtTime(42, start + 0.18);
      gain.gain.setValueAtTime(0.95 * output, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
      osc.connect(gain);
      osc.start(start);
      osc.stop(start + 0.24);
      return;
    }

    if (["snare", "clap", "hat", "openhat"].includes(drumId)) {
      const length = drumId === "openhat" ? 0.22 : drumId === "clap" ? 0.11 : 0.07;
      const noise = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      noise.buffer = makeNoise(ctx, length);
      filter.type = drumId === "snare" ? "highpass" : "bandpass";
      filter.frequency.value = drumId === "hat" ? 7200 : drumId === "openhat" ? 5200 : 1400;
      gain.gain.setValueAtTime((drumId === "hat" ? 0.22 : 0.36) * output, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + length);
      noise.connect(filter);
      filter.connect(gain);
      noise.start(start);
      noise.stop(start + length + 0.02);
      return;
    }

    playTone({ frequency: 560, time: start, duration: 0.08, type: "square", volume: 0.16, trackId: "drums" });
  };

  const playAudioBuffer = async (audioId, time, trackId = "vocals") => {
    const buffer = recordedBuffersRef.current[audioId];
    if (!buffer) return;
    const ctx = await getAudioContext();
    const start = time ?? ctx.currentTime;
    const output = trackOutput(trackId);
    if (output <= 0) return;
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(0.9 * output, start);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(start);
  };

  const playMetronome = (time, strong) => {
    if (!transportRef.current.metronomeEnabled) return;
    playTone({ frequency: strong ? 1200 : 880, time, duration: 0.05, type: "square", volume: 0.08, trackId: "fx" });
  };

  const scheduleClipLocal = (clip, local, time) => {
    if (!clip) return;

    if (clip.type === "drums") {
      const pattern = clip.data?.pattern || {};
      drumRows.forEach((row) => {
        const rowPattern = pattern[row.id] || [];
        if (rowPattern[local % rowPattern.length]) playDrum(row.id, time);
      });
      return;
    }

    if (isMidiClip(clip)) {
      (clip.data?.notes || []).forEach((note) => {
        if (note.start === local) playPiano(note.note, time, clip.trackId, note.velocity || 0.85);
      });
      return;
    }

    if (clip.type === "audio" && clip.data?.audioId && local === 0) {
      playAudioBuffer(clip.data.audioId, time, clip.trackId);
      return;
    }

    if (clip.data?.hits?.includes(local)) {
      playTone({ frequency: clip.type === "fx" ? 980 : 420, time, duration: 0.18, type: "sawtooth", volume: 0.12, trackId: clip.trackId });
    }
  };

  const scheduleStep = (step, time) => {
    playMetronome(time, step % STEPS_PER_BAR === 0);
    if (transportRef.current.playMode === "pattern") {
      const clip = clipsRef.current.find((item) => item.id === selectedClipIdRef.current);
      scheduleClipLocal(clip, step % Math.max(1, clip?.length || 16), time);
      return;
    }

    clipsRef.current.forEach((clip) => {
      if (clipAtStep(clip, step)) scheduleClipLocal(clip, localStep(clip, step), time);
    });
  };

  const stopScheduler = () => {
    window.clearInterval(schedulerRef.current);
    schedulerRef.current = null;
    nextNoteTimeRef.current = 0;
  };

  const startScheduler = async (fromStepArg) => {
    if (playModeRef.current === "pattern" && !clipsRef.current.find((clip) => clip.id === selectedClipIdRef.current)) {
      stopScheduler();
      isPlayingRef.current = false;
      setIsPlaying(false);
      setToast("Select a clip to play pattern.");
      window.setTimeout(() => setToast(""), 1800);
      return;
    }

    const ctx = await getAudioContext();
    stopScheduler();
    const mode = playModeRef.current;
    const fromStep = typeof fromStepArg === "number"
      ? fromStepArg
      : mode === "pattern"
        ? patternStepRef.current
        : currentStepRef.current;

    scheduledStepRef.current = fromStep;
    if (mode === "pattern") {
      patternStepRef.current = fromStep;
      setPatternStep(fromStep);
    } else {
      currentStepRef.current = fromStep;
      setCurrentStep(fromStep);
    }

    nextNoteTimeRef.current = ctx.currentTime + 0.04;
    scheduleStep(fromStep, nextNoteTimeRef.current);

    schedulerRef.current = window.setInterval(() => {
      const latestCtx = audioCtxRef.current;
      if (!latestCtx) return;
      while (nextNoteTimeRef.current < latestCtx.currentTime + SCHEDULE_AHEAD_SEC) {
        const state = transportRef.current;
        const modeNow = state.playMode;
        const clip = clipsRef.current.find((item) => item.id === selectedClipIdRef.current);
        if (modeNow === "pattern" && !clip) {
          stopScheduler();
          isPlayingRef.current = false;
          setIsPlaying(false);
          setToast("Select a clip to play pattern.");
          window.setTimeout(() => setToast(""), 1800);
          break;
        }
        const maxStep = modeNow === "pattern" ? Math.max(1, clip?.length || 16) : TOTAL_STEPS;
        let nextStep = scheduledStepRef.current + 1;

        if (nextStep >= maxStep) {
          if (state.loopEnabled || modeNow === "pattern") {
            nextStep = 0;
          } else {
            stopScheduler();
            isPlayingRef.current = false;
            setIsPlaying(false);
            break;
          }
        }

        scheduledStepRef.current = nextStep;
        if (modeNow === "pattern") {
          patternStepRef.current = nextStep;
          setPatternStep(nextStep);
        } else {
          currentStepRef.current = nextStep;
          setCurrentStep(nextStep);
        }
        nextNoteTimeRef.current += stepSeconds(state.bpm || bpm);
        scheduleStep(nextStep, nextNoteTimeRef.current);
      }
    }, LOOKAHEAD_MS);
  };

  const togglePlay = async () => {
    if (isPlayingRef.current) {
      stopScheduler();
      isPlayingRef.current = false;
      setIsPlaying(false);
      return;
    }
    const startStep = playModeRef.current === "pattern" ? patternStepRef.current : currentStepRef.current;
    await startScheduler(startStep);
    isPlayingRef.current = true;
    setIsPlaying(true);
  };

  const stopPlayback = () => {
    stopScheduler();
    isPlayingRef.current = false;
    setIsPlaying(false);

    if (playModeRef.current === "pattern") {
      patternStepRef.current = 0;
      scheduledStepRef.current = 0;
      setPatternStep(0);
    } else {
      currentStepRef.current = 0;
      scheduledStepRef.current = 0;
      setCurrentStep(0);
    }
  };

  const seekToStep = (step) => {
    const nextStep = clamp(Math.round(step), 0, TOTAL_STEPS - 1);
    currentStepRef.current = nextStep;
    setCurrentStep(nextStep);
    if (playModeRef.current === "playlist") scheduledStepRef.current = nextStep;
    if (isPlayingRef.current && playModeRef.current === "playlist") startScheduler(nextStep);
  };

  const seekPatternToStep = (step) => {
    const clip = clipsRef.current.find((item) => item.id === selectedClipIdRef.current);
    const max = Math.max(1, clip?.length || pianoStepCount);
    const nextStep = clamp(Math.round(step), 0, max - 1);
    patternStepRef.current = nextStep;
    scheduledStepRef.current = nextStep;
    setPatternStep(nextStep);
    if (isPlayingRef.current && playModeRef.current === "pattern") startScheduler(nextStep);
  };

  const togglePlayMode = () => {
    stopScheduler();
    isPlayingRef.current = false;
    setIsPlaying(false);
    setPlayMode((mode) => {
      const next = mode === "playlist" ? "pattern" : "playlist";
      playModeRef.current = next;
      if (next === "pattern") {
        patternStepRef.current = 0;
        scheduledStepRef.current = 0;
        setPatternStep(0);
      } else {
        scheduledStepRef.current = currentStepRef.current;
      }
      return next;
    });
  };

  const parseSeek = (value) => {
    if (value.includes(":")) {
      const [minText, secText] = value.split(":");
      const seconds = Number(minText) * 60 + Number(secText);
      return clamp(Math.round(seconds / stepSeconds(bpm)), 0, TOTAL_STEPS - 1);
    }
    const [barText, beatText] = value.split(".");
    return clamp(((Math.max(1, Number(barText) || 1) - 1) * STEPS_PER_BAR) + (Math.max(1, Number(beatText) || 1) - 1), 0, TOTAL_STEPS - 1);
  };

  const addClip = ({ type, trackId, color, label, start }) => {
    const clip = makeClip({ type, trackId, color, name: label, start: clamp(start, 0, TOTAL_STEPS - 4), length: type === "fx" ? 4 : 16 });
    pushHistory();
    setClips((prev) => [...prev, clip]);
    setSelectedClipId(clip.id);
    selectedClipIdRef.current = clip.id;
    if (isMidiClip(clip)) setPianoRollOpen(true);
    if (clip.type === "drums") playDrum("kick");
    if (isMidiClip(clip)) playPiano(clip.data?.notes?.[0]?.note || "C4", undefined, clip.trackId);
    if (clip.type === "fx") playTone({ frequency: 980, duration: 0.18, type: "sawtooth", volume: 0.12, trackId: clip.trackId });
  };

  const handleDrop = (event, trackId) => {
    event.preventDefault();
    let payload = {};
    try {
      payload = JSON.parse(event.dataTransfer.getData("application/json") || "{}");
    } catch {
      payload = {};
    }
    const start = getTimelineStepFromClientX(event.clientX);
    const track = tracks.find((item) => item.id === trackId) || tracks[0];
    addClip({ type: payload.type || track.type, trackId, color: payload.color || track.color, label: payload.label || track.name, start });
  };

  const duplicateClip = () => {
    if (!selectedClip) return;
    pushHistory();
    const clone = {
      ...selectedClip,
      id: uid("clip"),
      name: `${selectedClip.name} Copy`,
      start: clamp(selectedClip.start + selectedClip.length, 0, TOTAL_STEPS - selectedClip.length),
      data: JSON.parse(JSON.stringify(selectedClip.data || {})),
    };
    setClips((prev) => [...prev, clone]);
    setSelectedClipId(clone.id);
  };

  const deleteClip = () => {
    if (!selectedClip) return;
    pushHistory();
    if (playModeRef.current === "pattern" && selectedClip.id === selectedClipIdRef.current) stopPlayback();
    setClips((prev) => prev.filter((clip) => clip.id !== selectedClipId));
    setSelectedClipId(null);
  };

  const updateClip = (updater, saveHistory = true) => {
    if (saveHistory) pushHistory();
    setClips((prev) => prev.map((clip) => (clip.id === selectedClipId ? updater(clip) : clip)));
  };

  const updateNote = (noteId, updater, saveHistory = true) => {
    updateClip((clip) => ({
      ...clip,
      data: {
        ...clip.data,
        notes: (clip.data?.notes || []).map((note) => (note.id === noteId ? updater(note) : note)),
      },
    }), saveHistory);
  };

  const deleteNoteById = (noteId) => {
    const clipId = selectedClipIdRef.current;
    if (!clipId) return;
    pushHistory();
    setClips((prev) =>
      prev.map((clip) => {
        if (clip.id !== clipId || !isMidiClip(clip)) return clip;
        return {
          ...clip,
          data: {
            ...clip.data,
            notes: (clip.data?.notes || []).filter((note) => note.id !== noteId),
          },
        };
      })
    );
    setSelectedNoteId((current) => (current === noteId ? null : current));
  };

  const toggleDrumCell = (rowId, step) => {
    if (selectedClip?.type !== "drums") return;
    const currentPattern = selectedClip.data?.pattern || makeDrumPattern();
    const willTurnOn = !currentPattern[rowId]?.[step];
    updateClip((clip) => {
      const pattern = clip.data?.pattern || makeDrumPattern();
      return {
        ...clip,
        data: {
          ...clip.data,
          pattern: {
            ...pattern,
            [rowId]: (pattern[rowId] || Array(16).fill(false)).map((active, index) => (index === step ? !active : active)),
          },
        },
      };
    });
    if (willTurnOn) playDrum(rowId);
  };

  const addOrRemoveNote = (noteName, step) => {
    if (!isMidiSelected) return;
    const existing = (selectedClip.data?.notes || []).find((note) => note.note === noteName && note.start === step);
    if (existing) {
      deleteNoteById(existing.id);
      return;
    }
    const newNote = { id: uid("note"), note: noteName, start: step, length: Math.min(2, Math.max(1, pianoStepCount - step)), velocity: 0.85 };
    updateClip((clip) => ({ ...clip, data: { ...clip.data, notes: [...(clip.data?.notes || []), newNote] } }));
    setSelectedNoteId(newNote.id);
    playPiano(noteName, undefined, selectedClip.trackId);
  };

  const updateSelectedNoteVelocity = (velocity) => {
    if (!selectedNoteId) return;
    updateNote(selectedNoteId, (note) => ({ ...note, velocity }), true);
  };

  const openPianoRoll = () => {
    if (!isMidiSelected) {
      setToast("Select a Piano, Bass, or Synth clip to edit MIDI.");
      window.setTimeout(() => setToast(""), 2200);
      return;
    }
    setPianoRollOpen(true);
  };

  const saveProject = () => {
    localStorage.setItem("soundwave-studio-project", JSON.stringify({ projectName, clips, bpm, trackVolumes, muted, solo }));
    setToast("Project saved");
    window.setTimeout(() => setToast(""), 1500);
  };

  const exportProject = () => {
    const blob = new Blob([JSON.stringify({ projectName, clips, bpm, trackVolumes }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${projectName || "soundwave-project"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const recordClip = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setToast("Recording is not supported in this browser.");
      return;
    }

    try {
      await getAudioContext();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recordingChunksRef.current = [];
      recordingStartStepRef.current = currentStep;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (!recordingChunksRef.current.length) return;
        const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const buffer = await (await getAudioContext()).decodeAudioData(await blob.arrayBuffer());
        const audioId = uid("audio");
        recordedBuffersRef.current[audioId] = buffer;
        const start = recordingStartStepRef.current;
        const length = clamp(Math.ceil(buffer.duration / stepSeconds(bpm)), 1, TOTAL_STEPS - start);
        const clip = makeClip({ type: "audio", trackId: "vocals", color: "pink", name: "Recorded Take", start, length });
        pushHistory();
        setClips((prev) => [...prev, { ...clip, data: { audioId } }]);
        setSelectedClipId(clip.id);
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      setIsRecording(false);
      setToast("Microphone recording could not start.");
    }
  };

  const handleTimelineClick = (event) => {
    if (
      event.target.closest(".clip-block") ||
      event.target.closest(".clip-resize-left") ||
      event.target.closest(".clip-resize-right") ||
      event.target.closest(".track-head") ||
      event.target.closest("button")
    ) {
      return;
    }
    seekToStep(getTimelineStepFromClientX(event.clientX));
  };

  const handleLaneDoubleClick = (event, track) => {
    if (event.target.closest(".clip-block") || event.target.closest("button")) return;
    const start = getTimelineStepFromClientX(event.clientX);
    addClip({ type: track.type, trackId: track.id, color: track.color, label: `${track.name} Clip`, start });
  };

  const startDrag = (event, data) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    document.body.classList.add("is-dragging");
    dragRef.current = data;
  };

  const startNoteDrag = (event, data) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    document.body.classList.add("is-dragging");
    noteDragRef.current = data;
  };

  const startModalDrag = (event, mode) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    document.body.classList.add("is-dragging");
    modalDragRef.current = { mode, startX: event.clientX, startY: event.clientY, startModal: pianoRollModal };
  };

  const closePianoRoll = () => {
    modalDragRef.current = null;
    document.body.classList.remove("is-dragging");
    setPianoRollOpen(false);
  };

  const zoomToFit = () => {
    const containerWidth = Math.max(320, (timelineScrollRef.current?.clientWidth || window.innerWidth) - TRACK_HEADER_WIDTH);
    const desiredStep = containerWidth / TOTAL_STEPS;
    let bestIndex = 0;
    let bestDistance = Infinity;
    ZOOM_LEVELS.forEach((level, index) => {
      const distance = Math.abs(level.stepPx - desiredStep);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    setZoomIndex(bestIndex);
  };

  const pauseAutoFollow = () => {
    userScrollPauseRef.current = true;
    window.clearTimeout(userScrollTimerRef.current);
    userScrollTimerRef.current = window.setTimeout(() => {
      userScrollPauseRef.current = false;
    }, 1600);
  };

  const shouldShowBarLabel = (barIndex) => {
    if (zoom.name === "16 bars") return barIndex % 16 === 0;
    if (zoom.name === "8 bars") return barIndex % 8 === 0;
    if (zoom.name === "4 bars") return barIndex % 4 === 0;
    return true;
  };

  const renderGridLines = (totalSteps, width, height, px = stepPx) => (
    <div className="grid-lines" style={{ width, height }}>
      {Array.from({ length: totalSteps + 1 }).map((_, step) => {
        const isBar = step % STEPS_PER_BAR === 0;
        const bar = step / STEPS_PER_BAR;
        const isFourBar = isBar && bar % 4 === 0;
        const isEightBar = isBar && bar % 8 === 0;
        const isSixteenBar = isBar && bar % 16 === 0;
        let className = "grid-line";

        if (isSixteenBar && zoom.showSixteenBars) className += " sixteen-bar";
        else if (isEightBar && zoom.showEightBars) className += " eight-bar";
        else if (isFourBar && zoom.showFourBars) className += " four-bar";
        else if (isBar && zoom.showBars) className += " bar";
        else if (step % STEPS_PER_BAR !== 0 && zoom.showBeats) className += " beat";
        else if (zoom.showSixteenths) className += " step";
        else return null;

        return <span key={step} className={className} style={{ left: step * px }} />;
      })}
    </div>
  );

  const renderClipPreview = (clip) => {
    if (isMidiClip(clip)) {
      return (
        <div className="midi-preview">
          {(clip.data?.notes || []).map((note) => (
            <span
              key={note.id}
              className="midi-preview-note"
              style={{
                left: `${(note.start / Math.max(1, clip.length)) * 100}%`,
                width: `${Math.max(4, (note.length / Math.max(1, clip.length)) * 100)}%`,
                top: `${pitchPreviewY(note.note)}%`,
              }}
            />
          ))}
        </div>
      );
    }

    if (clip.type === "drums") {
      return (
        <div className="drum-preview">
          {drumRows.slice(0, 4).map((row, rowIndex) =>
            (clip.data?.pattern?.[row.id] || []).map((active, step) =>
              active ? <span key={`${row.id}-${step}`} style={{ left: `${(step / 16) * 100}%`, top: `${rowIndex * 24 + 10}%` }} /> : null
            )
          )}
        </div>
      );
    }

    return <div className="audio-preview"><span /><span /><span /></div>;
  };

  const modalStyle = pianoRollModal.maximized
    ? { left: 12, right: 12, top: 76, bottom: 12, width: "auto", height: "auto" }
    : { left: pianoRollModal.x, top: pianoRollModal.y, width: pianoRollModal.width, height: pianoRollModal.height };
  const patternGhostStep = playMode === "pattern" && selectedClip ? selectedClip.start + patternStep : null;

  return (
    <main className="music-studio d-flex flex-column text-white">
      <header className="studio-top sticky-top container-fluid">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-lg-3 d-flex align-items-center gap-2">
            <button type="button" title="Toggle library" onClick={() => setLeftOpen((value) => !value)}><FaBars /></button>
            <input value={projectName} onChange={(event) => setProjectName(event.target.value)} title="Project name" />
          </div>

          <div className="col-12 col-lg-4 d-flex justify-content-lg-center gap-2 studio-transport">
            <button type="button" title="Play / Pause" onClick={togglePlay}>{isPlaying ? <FaPause /> : <FaPlay />}</button>
            <button type="button" title="Stop" onClick={stopPlayback}><FaStop /></button>
            <button type="button" title="Record" className={isRecording ? "active record" : "record"} onClick={recordClip}><FaCircle /></button>
            <button type="button" title="Toggle playlist/pattern mode" className={playMode === "pattern" ? "active" : ""} onClick={togglePlayMode}>{playMode === "playlist" ? "PL" : "PT"}</button>
            <button type="button" title="Metronome" className={metronomeEnabled ? "active" : ""} onClick={() => setMetronomeEnabled((value) => !value)}><MdGraphicEq /></button>
          </div>

          <div className="col-12 col-lg-5 d-flex justify-content-lg-end flex-wrap gap-2 studio-status">
            <label title="BPM">BPM<input type="number" min="60" max="180" value={bpm} onChange={(event) => setBpm(Number(event.target.value))} /></label>
            <button type="button" title="Timer / Seek" onClick={() => setTimerOpen((value) => !value)}>{timeText(projectSeconds)} · {playMode === "pattern" ? `P${patternStep + 1}` : stepToBars(currentStep)}</button>
            <button type="button" title="Follow playhead" className={followPlayhead ? "active" : ""} onClick={() => setFollowPlayhead((value) => !value)}><FaArrowRight /></button>
            <button type="button" title="Snap to grid" className={snapToGrid ? "active" : ""} onClick={() => setSnapToGrid((value) => !value)}>Snap</button>
            <button type="button" title="Zoom out" onClick={() => setZoomIndex((value) => clamp(value - 1, 0, ZOOM_LEVELS.length - 1))}>−</button>
            <button type="button" title={`Zoom: ${zoom.name}`}>{zoom.name}</button>
            <button type="button" title="Zoom in" onClick={() => setZoomIndex((value) => clamp(value + 1, 0, ZOOM_LEVELS.length - 1))}>+</button>
            <button type="button" title="Zoom to fit" onClick={zoomToFit}>Fit</button>
            <button type="button" title="Open Piano Roll" onClick={openPianoRoll}><TbPiano /></button>
            <button type="button" title="Undo" onClick={undo} disabled={!undoStack.length}><FaUndo /></button>
            <button type="button" title="Redo" onClick={redo} disabled={!redoStack.length}><FaRedo /></button>
            <button type="button" title="Save" onClick={saveProject}><FaSave /></button>
            <button type="button" title="Export" onClick={exportProject}><FaDownload /></button>
            <button type="button" title="Inspector" onClick={() => setRightOpen((value) => !value)}><IoSettingsSharp /></button>
          </div>
        </div>

        {timerOpen && (
          <div className="timer-popover">
            <input placeholder="5.1.1 or 00:12" value={seekValue} onChange={(event) => setSeekValue(event.target.value)} />
            <button type="button" onClick={() => { seekToStep(parseSeek(seekValue)); setTimerOpen(false); }}>Go</button>
          </div>
        )}
      </header>

      <section className="studio-shell container-fluid flex-grow-1 overflow-hidden">
        <div className="row g-0 h-100">
          {leftOpen && (
            <aside className="studio-left col-12 col-lg-auto">
              <div className="panel-head"><span>Library</span><button type="button" title="Close library" onClick={() => setLeftOpen(false)}><IoClose /></button></div>
              <div className="row g-2 p-2">
                {libraryItems.map((item) => {
                  const Icon = item.Icon;
                  return (
                    <div className="col-4 col-lg-6" key={`${item.trackId}-${item.type}`}>
                      <button
                        draggable
                        type="button"
                        title={`Drag or tap ${item.label}`}
                        className={`library-item ${item.color}`}
                        onClick={() => addClip({ ...item, start: currentStep })}
                        onDragStart={(event) => event.dataTransfer.setData("application/json", JSON.stringify(item))}
                      >
                        <strong><Icon /></strong><span>{item.label}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="mini-section">
                <span>Drum Presets</span>
                {["afro", "amapiano", "trap"].map((preset) => (
                  <button key={preset} type="button" disabled={selectedClip?.type !== "drums"} onClick={() => { updateClip((clip) => ({ ...clip, data: { ...clip.data, pattern: makeDrumPattern(preset) } })); playDrum("kick"); }}>{preset}</button>
                ))}
              </div>
            </aside>
          )}

          <section className="timeline-wrap col min-w-0" ref={timelineScrollRef} onClick={handleTimelineClick} onScroll={pauseAutoFollow}>
            <div className="timeline-inner" style={{ width: `${190 + timelineWidth}px` }}>
              <div className="timeline-minimap" style={{ width: `${190 + timelineWidth}px` }}>
                <div className="track-spacer">Map</div>
                <div className="minimap-lane" style={{ width: timelineWidth }} onClick={(event) => seekToStep(getTimelineStepFromClientX(event.clientX))}>
                  {clips.map((clip) => (
                    <span key={clip.id} className={`mini-clip ${clip.color}`} style={{ left: `${clip.start * stepPx}px`, width: `${Math.max(4, clip.length * stepPx)}px` }} />
                  ))}
                </div>
              </div>
              <div className="timeline-ruler">
                <div className="track-spacer">Tracks</div>
                <div className="ruler-grid" style={{ width: timelineWidth }}>
                  {Array.from({ length: TOTAL_BARS }).map((_, bar) => (
                    shouldShowBarLabel(bar) ? <button key={bar} type="button" className={Math.floor(currentStep / STEPS_PER_BAR) === bar && playMode === "playlist" ? "active" : ""} style={{ left: `${bar * STEPS_PER_BAR * stepPx}px`, width: `${STEPS_PER_BAR * stepPx}px` }} onClick={(event) => { event.stopPropagation(); seekToStep(bar * STEPS_PER_BAR); }}>{bar + 1}</button> : null
                  ))}
                  {renderGridLines(TOTAL_STEPS, timelineWidth, TRACK_HEIGHT, stepPx)}
                </div>
              </div>

              <div className="timeline-grid" style={{ minHeight: tracks.length * TRACK_HEIGHT }}>
                <div
                  className="playhead"
                  style={{ left: `${190 + currentStep * stepPx}px` }}
                  onPointerDown={(event) => startDrag(event, { type: "playhead" })}
                >
                  <span />
                </div>
                {patternGhostStep !== null && (
                  <div
                    className="playhead pattern-ghost"
                    style={{ left: `${190 + patternGhostStep * stepPx}px` }}
                    aria-hidden="true"
                  />
                )}

                {tracks.map((track) => {
                  const Icon = track.Icon;
                  return (
                    <div className="timeline-row" key={track.id}>
                      <div className={`track-head ${track.color}`}>
                        <Icon />
                        <div><strong>{track.name}</strong><span>{trackVolumes[track.id]}%</span></div>
                        <button type="button" title="Mute" className={muted[track.id] ? "active" : ""} onClick={(event) => { event.stopPropagation(); setMuted((prev) => ({ ...prev, [track.id]: !prev[track.id] })); }}>{muted[track.id] ? <FaVolumeMute /> : <FaVolumeUp />}</button>
                        <button type="button" title="Solo" className={solo[track.id] ? "active" : ""} onClick={(event) => { event.stopPropagation(); setSolo((prev) => ({ ...prev, [track.id]: !prev[track.id] })); }}>S</button>
                        <button type="button" title="Arm track" className={armed[track.id] ? "active" : ""} onClick={(event) => { event.stopPropagation(); setArmed((prev) => ({ ...prev, [track.id]: !prev[track.id] })); }}><FaCircle /></button>
                      </div>
                      <div className="track-lane" style={{ width: timelineWidth }} onDoubleClick={(event) => handleLaneDoubleClick(event, track)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleDrop(event, track.id)}>
                        {renderGridLines(TOTAL_STEPS, timelineWidth, TRACK_HEIGHT, stepPx)}
                        {clips.filter((clip) => clip.trackId === track.id).map((clip) => (
                          <div
                            key={clip.id}
                            draggable={false}
                            className={`clip-block ${clip.color} ${selectedClipId === clip.id ? "selected" : ""}`}
                            style={{ left: `${clip.start * stepPx}px`, width: `${clip.length * stepPx}px` }}
                            onDoubleClick={(event) => { event.stopPropagation(); setSelectedClipId(clip.id); if (isMidiClip(clip)) setPianoRollOpen(true); }}
                          >
                            <button className="clip-resize-left" type="button" title="Resize clip left" onPointerDown={(event) => {
                              setSelectedClipId(clip.id);
                              pushHistory();
                              startDrag(event, { type: "clip", clipId: clip.id, mode: "resize-left", startValue: clip.start, startLength: clip.length });
                            }} />
                            <div
                              className="clip-body"
                              onPointerDown={(event) => {
                                setSelectedClipId(clip.id);
                                setSelectedNoteId(null);
                                pushHistory();
                                const pointerStep = getTimelineStepFromClientX(event.clientX);
                                startDrag(event, { type: "clip", clipId: clip.id, mode: "move", grabOffset: pointerStep - clip.start, startValue: clip.start, startLength: clip.length });
                              }}
                            >
                              <span>{clip.name}</span>
                            </div>
                            {renderClipPreview(clip)}
                            <button className="clip-resize-right" type="button" title="Resize clip right" onPointerDown={(event) => {
                              setSelectedClipId(clip.id);
                              pushHistory();
                              startDrag(event, { type: "clip", clipId: clip.id, mode: "resize-right", startValue: clip.start, startLength: clip.length });
                            }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {rightOpen && (
            <aside className="studio-right col-12 col-xl-auto">
              <div className="panel-head"><span>Inspector</span><button type="button" title="Close inspector" onClick={() => setRightOpen(false)}><IoClose /></button></div>
              <div className="inspector-card">
                <small>Selected Clip</small>
                <input value={selectedClip?.name || ""} disabled={!selectedClip} onChange={(event) => updateClip((clip) => ({ ...clip, name: event.target.value }))} />
                <p>{selectedClip ? `${selectedClip.type} · starts ${stepToBars(selectedClip.start)} · ${selectedClip.length} steps` : "Select a clip or create one from the library."}</p>
              </div>
              <label className="range-line">Master<strong>{masterVolume}%</strong><input type="range" min="0" max="100" value={masterVolume} onChange={(event) => setMasterVolume(Number(event.target.value))} /></label>
              <label className="range-line">Track<strong>{trackVolumes[selectedTrackId]}%</strong><input type="range" min="0" max="100" value={trackVolumes[selectedTrackId] || 0} onChange={(event) => setTrackVolumes((prev) => ({ ...prev, [selectedTrackId]: Number(event.target.value) }))} /></label>
              <div className="inspector-actions">
                <button type="button" title="Duplicate clip" onClick={duplicateClip} disabled={!selectedClip}><FaCopy /></button>
                <button type="button" title="Delete clip" onClick={deleteClip} disabled={!selectedClip}><FaTrash /></button>
                <button type="button" title="Open Piano Roll" onClick={openPianoRoll}><TbPiano /></button>
              </div>
            </aside>
          )}
        </div>
      </section>

      <section className="studio-bottom container-fluid">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-lg-auto d-flex gap-2 align-items-center">
            <button type="button" title="Octave down" onClick={() => setKeyboardOctave((value) => clamp(value - 1, 1, 7))}>−</button>
            <span>Oct {keyboardOctave}</span>
            <button type="button" title="Octave up" onClick={() => setKeyboardOctave((value) => clamp(value + 1, 1, 7))}>+</button>
          </div>
          <div className="col keyboard-scroll">
            <div className="keyboard">
              {keyboardNotes.map((note) => (
                <button
                  type="button"
                  key={note}
                  className={`${isBlackKey(note) ? "black" : "white"} ${activeKeys[note] ? "active" : ""}`}
                  onPointerDown={() => { setActiveKeys((prev) => ({ ...prev, [note]: true })); playPiano(note); }}
                  onPointerUp={() => setActiveKeys((prev) => ({ ...prev, [note]: false }))}
                >
                  {note}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {pianoRollOpen && (
        <section className={`piano-roll-modal ${pianoRollModal.maximized ? "maximized" : ""}`} style={modalStyle}>
          <header className="piano-roll-modal-header">
            <div className="piano-roll-drag-handle" onPointerDown={(event) => startModalDrag(event, "move")}>
              <TbPiano /><strong>Piano Roll</strong><span>{selectedClip?.name || "No MIDI clip"}</span>
            </div>
            <div className="piano-roll-window-actions">
              <button type="button" title="Play selected pattern" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); if (playModeRef.current === "pattern") { togglePlay(); return; } togglePlayMode(); window.setTimeout(() => { if (!isPlayingRef.current) togglePlay(); }, 0); }}>{playMode === "pattern" && isPlaying ? <FaPause /> : <FaPlay />}</button>
              <button type="button" title="Stop selected pattern" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); if (playModeRef.current !== "pattern") togglePlayMode(); stopPlayback(); }}><FaStop /></button>
              <button type="button" title="Toggle playlist/pattern mode" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); togglePlayMode(); }}>{playMode === "playlist" ? "PL" : "PT"}</button>
              <span>{selectedNote ? `${selectedNote.note} · ${stepToBars(selectedNote.start)} · ${selectedNote.length} · ${Math.round((selectedNote.velocity || 0.85) * 100)}%` : playMode === "pattern" ? `Step ${patternStep + 1}` : stepToBars(currentStep)}</span>
              {selectedNote && (
                <input
                  type="range"
                  title="Note velocity"
                  min="0.2"
                  max="1"
                  step="0.05"
                  value={selectedNote.velocity || 0.85}
                  onPointerDown={(event) => event.stopPropagation()}
                  onChange={(event) => updateSelectedNoteVelocity(Number(event.target.value))}
                />
              )}
              <button type="button" title="Maximize" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setPianoRollModal((prev) => ({ ...prev, maximized: !prev.maximized })); }}>□</button>
              <button type="button" title="Close" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); closePianoRoll(); }}><IoClose /></button>
            </div>
          </header>

          <div className="piano-roll-modal-body" ref={pianoRollScrollRef} onScroll={pauseAutoFollow}>
            {!isMidiSelected ? (
              <div className="empty-midi-state">
                <TbPiano />
                <h3>Select a MIDI clip</h3>
                <p>Choose a Piano, Bass, or Synth clip to add notes.</p>
              </div>
            ) : (
              <div className="piano-roll">
                <div className="note-labels">
                  <div className="note-label-spacer" />
                  {noteRange.map((note) => (
                    <button type="button" key={note} className={`${isBlackKey(note) ? "black" : "white"} ${note.startsWith("C") && !note.includes("#") ? "root" : ""}`} onClick={() => playPiano(note, undefined, selectedClip.trackId)}>{note}</button>
                  ))}
                </div>
                <div className="piano-roll-editor">
                  <div className="piano-roll-time-ruler" style={{ width: `${pianoRollWidth}px` }}>
                    {Array.from({ length: Math.ceil(pianoStepCount / STEPS_PER_BAR) }).map((_, bar) => (
                      <button
                        type="button"
                        key={bar}
                        style={{ left: `${bar * STEPS_PER_BAR * pianoStepPx}px`, width: `${STEPS_PER_BAR * pianoStepPx}px` }}
                        onClick={(event) => {
                          event.stopPropagation();
                          const local = bar * STEPS_PER_BAR;
                          if (playModeRef.current === "pattern") seekPatternToStep(local);
                          else if (selectedClip) seekToStep(selectedClip.start + local);
                        }}
                      >
                        {bar + 1}
                      </button>
                    ))}
                  </div>
                <div ref={pianoRollGridRef} className="note-grid" style={{ width: `${pianoRollWidth}px`, height: `${noteRange.length * NOTE_ROW_HEIGHT}px` }}>
                  <div className="piano-roll-playhead" style={{ left: `${pianoRollPlayStep * pianoStepPx}px` }}>
                    <button type="button" title="Drag piano roll playhead" onPointerDown={(event) => startDrag(event, { type: "piano-playhead" })} />
                  </div>
                  {renderGridLines(pianoStepCount, pianoRollWidth, noteRange.length * NOTE_ROW_HEIGHT, pianoStepPx)}
                  {noteRange.map((note) => (
                    <div className={`note-row ${isBlackKey(note) ? "black" : "white"} ${note.startsWith("C") && !note.includes("#") ? "root" : ""}`} key={note}>
                      {Array.from({ length: pianoStepCount }).map((_, step) => (
                        <button type="button" key={`${note}-${step}`} className={step % STEPS_PER_BAR === 0 ? "bar-start" : ""} onClick={() => addOrRemoveNote(note, step)} />
                      ))}
                    </div>
                  ))}
                  {(selectedClip.data?.notes || []).map((note) => {
                    const rowIndex = noteRange.indexOf(note.note);
                    if (rowIndex < 0) return null;
                    return (
                      <div
                        key={note.id}
                        className={`note-block ${selectedNoteId === note.id ? "selected" : ""}`}
                        style={{ left: `${note.start * pianoStepPx}px`, top: `${rowIndex * NOTE_ROW_HEIGHT + 3}px`, width: `${note.length * pianoStepPx}px`, opacity: clamp(note.velocity || 0.85, 0.35, 1) }}
                      >
                        <button type="button" className="note-resize-left" title="Resize note left" onPointerDown={(event) => {
                          event.stopPropagation();
                          setSelectedNoteId(note.id);
                          pushHistory();
                          startNoteDrag(event, { noteId: note.id, mode: "resize-left", startX: event.clientX, startY: event.clientY, startStart: note.start, startLength: note.length, startMidi: noteToMidi(note.note) });
                        }} />
                        <span className="note-body" onPointerDown={(event) => {
                          event.stopPropagation();
                          setSelectedNoteId(note.id);
                          playPiano(note.note, undefined, selectedClip.trackId, note.velocity || 0.85);
                          pushHistory();
                          startNoteDrag(event, { noteId: note.id, mode: "move", startX: event.clientX, startY: event.clientY, startStart: note.start, startLength: note.length, startMidi: noteToMidi(note.note) });
                        }}>{note.note}</span>
                        <button type="button" className="note-delete" title="Delete note" onPointerDown={(event) => { event.stopPropagation(); event.preventDefault(); }} onClick={(event) => { event.stopPropagation(); event.preventDefault(); deleteNoteById(note.id); }}>×</button>
                        <button type="button" className="note-resize-right" title="Resize note right" onPointerDown={(event) => {
                          event.stopPropagation();
                          setSelectedNoteId(note.id);
                          pushHistory();
                          startNoteDrag(event, { noteId: note.id, mode: "resize-right", startX: event.clientX, startY: event.clientY, startStart: note.start, startLength: note.length, startMidi: noteToMidi(note.note) });
                        }} />
                      </div>
                    );
                  })}
                </div>
                </div>
              </div>
            )}
          </div>
          <button type="button" className="modal-resize" title="Resize piano roll" onPointerDown={(event) => startModalDrag(event, "resize")} />
        </section>
      )}

      {selectedClip?.type === "drums" && (
        <section className="drum-dock container-fluid">
          {drumRows.map((row) => (
            <div className="drum-edit-row" key={row.id}>
              <button type="button" title={row.label} onClick={() => playDrum(row.id)}>{row.short}</button>
              <div>
                {Array.from({ length: 16 }).map((_, step) => (
                  <button type="button" key={`${row.id}-${step}`} className={`${selectedClip.data?.pattern?.[row.id]?.[step] ? "active" : ""} ${step % 4 === 0 ? "bar-start" : ""} ${step === drumEditorStep ? "playing" : ""}`} onClick={() => toggleDrumCell(row.id, step)} />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {!leftOpen && <button type="button" className="panel-float left" title="Open library" onClick={() => setLeftOpen(true)}><FaBars /></button>}
      {!rightOpen && <button type="button" className="panel-float right" title="Open inspector" onClick={() => setRightOpen(true)}><IoSettingsSharp /></button>}
      <button type="button" className="panel-float bottom" title="Open Piano Roll" onClick={openPianoRoll}><TbPiano /></button>
      {toast && <div className="studio-toast">{toast}</div>}
    </main>
  );
};

export default MusicStudio;
