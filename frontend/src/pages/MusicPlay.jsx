import React, { useContext, useEffect, useRef, useState } from "react";
import {
  FaPlay,
  FaPause,
  FaForward,
  FaBackward,
  FaStepForward,
  FaStepBackward,
  FaChevronUp,
  FaChevronDown,
} from "react-icons/fa";
import { IoClose } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import "./CSS/MusicPlay.css";
import { MusicPlayerContext } from "../context/MainPlayerContext";

const formatTime = (seconds = 0) => {
  const safeSeconds = Number(seconds);

  if (
    !safeSeconds ||
    Number.isNaN(safeSeconds) ||
    !Number.isFinite(safeSeconds)
  ) {
    return "0:00";
  }

  const mins = Math.floor(safeSeconds / 60);
  const secs = Math.floor(safeSeconds % 60);

  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const getArtistName = (song) =>
  song?.artist?.name || song?.artistName || song?.artist || "Unknown Artist";

const getSongDuration = (song) => {
  const possibleDuration =
    song?.durationInSeconds ||
    song?.durationSeconds ||
    song?.duration ||
    song?.length ||
    song?.audioDuration;

  const numericDuration = Number(possibleDuration);

  if (
    numericDuration &&
    !Number.isNaN(numericDuration) &&
    Number.isFinite(numericDuration)
  ) {
    return numericDuration;
  }

  return 0;
};

const MusicPlayer = () => {
  const hiddenAudioRef = useRef(null);
  const bufferOverlayTimerRef = useRef(null);
  const seekSuppressTimerRef = useRef(null);

  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [showBufferOverlay, setShowBufferOverlay] = useState(false);
  const [bufferOverlayDismissed, setBufferOverlayDismissed] = useState(false);

  const [localProgress, setLocalProgress] = useState(0);
  const [localDuration, setLocalDuration] = useState(0);

  const [isUserSeeking, setIsUserSeeking] = useState(false);
  const [suppressSeekBuffering, setSuppressSeekBuffering] = useState(false);
  const [audioIsActuallyPlaying, setAudioIsActuallyPlaying] = useState(false);
  const [audioIsActuallyWaiting, setAudioIsActuallyWaiting] = useState(false);

  const navigate = useNavigate();

  const {
    registerAudioElement,
    currentSong,
    playlist,
    isPlaying,
    isBuffering,
    bufferMessage,
    progress,
    duration,
    togglePlay,
    seekTo,
    skipForward,
    skipBackward,
    nextSong,
    prevSong,
    loading,
  } = useContext(MusicPlayerContext);

  useEffect(() => {
    if (hiddenAudioRef.current && typeof registerAudioElement === "function") {
      registerAudioElement(hiddenAudioRef.current);
    }

    return () => {
      if (typeof registerAudioElement === "function") {
        registerAudioElement(null);
      }
    };
  }, [registerAudioElement]);

  useEffect(() => {
    setBufferOverlayDismissed(false);
    setShowBufferOverlay(false);
    setLocalProgress(0);
    setIsUserSeeking(false);
    setSuppressSeekBuffering(false);
    setAudioIsActuallyWaiting(false);

    const songDuration = getSongDuration(currentSong);
    setLocalDuration(songDuration);
  }, [currentSong?._id, currentSong]);

  useEffect(() => {
    const audio = hiddenAudioRef.current;
    if (!audio) return undefined;

    const updateDuration = () => {
      const audioDuration = Number(audio.duration);

      if (
        audioDuration &&
        !Number.isNaN(audioDuration) &&
        Number.isFinite(audioDuration)
      ) {
        setLocalDuration(audioDuration);
        return;
      }

      const songDuration = getSongDuration(currentSong);
      setLocalDuration(songDuration);
    };

    const updateProgress = () => {
      const audioCurrentTime = Number(audio.currentTime);

      if (
        !Number.isNaN(audioCurrentTime) &&
        Number.isFinite(audioCurrentTime)
      ) {
        setLocalProgress(audioCurrentTime);
      }
    };

    const markPlaying = () => {
      setAudioIsActuallyPlaying(true);
      setAudioIsActuallyWaiting(false);
      setShowBufferOverlay(false);

      if (seekSuppressTimerRef.current) {
        window.clearTimeout(seekSuppressTimerRef.current);
      }

      seekSuppressTimerRef.current = window.setTimeout(() => {
        setSuppressSeekBuffering(false);
      }, 600);
    };

    const markPaused = () => {
      setAudioIsActuallyPlaying(false);
    };

    const markWaiting = () => {
      setAudioIsActuallyWaiting(true);
    };

    const markCanPlay = () => {
      setAudioIsActuallyWaiting(false);
      updateDuration();

      if (!audio.paused && !audio.ended) {
        setAudioIsActuallyPlaying(true);
      }
    };

    updateDuration();
    updateProgress();

    if (!audio.paused && !audio.ended) {
      setAudioIsActuallyPlaying(true);
    }

    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("durationchange", updateDuration);
    audio.addEventListener("canplay", markCanPlay);
    audio.addEventListener("canplaythrough", markCanPlay);
    audio.addEventListener("playing", markPlaying);
    audio.addEventListener("play", markPlaying);
    audio.addEventListener("pause", markPaused);
    audio.addEventListener("ended", markPaused);
    audio.addEventListener("waiting", markWaiting);
    audio.addEventListener("stalled", markWaiting);
    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("seeking", updateProgress);
    audio.addEventListener("seeked", updateProgress);

    return () => {
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("durationchange", updateDuration);
      audio.removeEventListener("canplay", markCanPlay);
      audio.removeEventListener("canplaythrough", markCanPlay);
      audio.removeEventListener("playing", markPlaying);
      audio.removeEventListener("play", markPlaying);
      audio.removeEventListener("pause", markPaused);
      audio.removeEventListener("ended", markPaused);
      audio.removeEventListener("waiting", markWaiting);
      audio.removeEventListener("stalled", markWaiting);
      audio.removeEventListener("timeupdate", updateProgress);
      audio.removeEventListener("seeking", updateProgress);
      audio.removeEventListener("seeked", updateProgress);
    };
  }, [currentSong]);

  const startSeekBufferSuppress = () => {
    setSuppressSeekBuffering(true);
    setShowBufferOverlay(false);

    if (bufferOverlayTimerRef.current) {
      window.clearTimeout(bufferOverlayTimerRef.current);
    }

    if (seekSuppressTimerRef.current) {
      window.clearTimeout(seekSuppressTimerRef.current);
    }

    seekSuppressTimerRef.current = window.setTimeout(() => {
      setSuppressSeekBuffering(false);
    }, 2500);
  };

  useEffect(() => {
    return () => {
      if (seekSuppressTimerRef.current) {
        window.clearTimeout(seekSuppressTimerRef.current);
      }
    };
  }, []);

  const effectiveIsPlaying = isPlaying || audioIsActuallyPlaying;

  const effectiveIsBuffering =
    isBuffering &&
    audioIsActuallyWaiting &&
    !audioIsActuallyPlaying &&
    !isUserSeeking &&
    !suppressSeekBuffering;

  useEffect(() => {
    if (effectiveIsBuffering && currentSong && !bufferOverlayDismissed) {
      bufferOverlayTimerRef.current = window.setTimeout(() => {
        setShowBufferOverlay(true);
      }, 1200);
    } else {
      if (bufferOverlayTimerRef.current) {
        window.clearTimeout(bufferOverlayTimerRef.current);
      }

      setShowBufferOverlay(false);
    }

    return () => {
      if (bufferOverlayTimerRef.current) {
        window.clearTimeout(bufferOverlayTimerRef.current);
      }
    };
  }, [effectiveIsBuffering, currentSong, bufferOverlayDismissed]);

  const closeBufferOverlay = () => {
    if (bufferOverlayTimerRef.current) {
      window.clearTimeout(bufferOverlayTimerRef.current);
    }

    setShowBufferOverlay(false);
    setBufferOverlayDismissed(true);
  };

  const openCurrentSongDetails = () => {
    if (!currentSong?._id) return;

    navigate(`/song/${currentSong._id}`, {
      state: {
        playlist,
      },
    });

    window.scrollTo(0, 0);
  };

  const handleSeekStart = () => {
    setIsUserSeeking(true);
    startSeekBufferSuppress();
  };

  const handleSeekEnd = () => {
    setIsUserSeeking(false);
    startSeekBufferSuppress();
  };

  const handleSeek = (e) => {
    const newTime = Number(e.target.value);

    if (Number.isNaN(newTime) || !Number.isFinite(newTime)) return;

    setLocalProgress(newTime);
    startSeekBufferSuppress();

    if (hiddenAudioRef.current) {
      hiddenAudioRef.current.currentTime = newTime;

      if (!hiddenAudioRef.current.paused && !hiddenAudioRef.current.ended) {
        setAudioIsActuallyPlaying(true);
      }
    }

    if (typeof seekTo === "function") {
      seekTo(newTime);
    }
  };

  const handleSkipBackward = (seconds) => {
    startSeekBufferSuppress();

    if (typeof skipBackward === "function") {
      skipBackward(seconds);
    }
  };

  const handleSkipForward = (seconds) => {
    startSeekBufferSuppress();

    if (typeof skipForward === "function") {
      skipForward(seconds);
    }
  };

  const audioElement = (
    <audio
      ref={hiddenAudioRef}
      preload="metadata"
      playsInline
      style={{
        position: "fixed",
        width: "1px",
        height: "1px",
        opacity: 0,
        pointerEvents: "none",
        left: "-9999px",
        bottom: 0,
      }}
    />
  );

  const bufferingOverlay = showBufferOverlay && currentSong && (
    <div className="buffer-overlay" role="status" aria-live="polite">
      <button
        type="button"
        className="buffer-close"
        onClick={closeBufferOverlay}
        aria-label="Close buffering message"
        title="Close"
      >
        <IoClose />
      </button>

      <div className="buffer-bg">
        <img src={currentSong?.imageUrl || "/fallback.jpg"} alt="" />
      </div>

      <div className="buffer-card">
        <img
          src={currentSong?.imageUrl || "/fallback.jpg"}
          alt={currentSong?.title || "song cover"}
          className="buffer-cover"
        />

        <div className="buffer-spinner" aria-hidden="true"></div>

        <h3>{bufferMessage || "Buffering song..."}</h3>
        <p>{currentSong?.title || "Please wait"}</p>
        <small>Stabilizing audio for smoother playback</small>
      </div>
    </div>
  );

  if (loading) {
    return (
      <>
        {audioElement}
        <div className="player-loading">Loading player...</div>
      </>
    );
  }

  if (!currentSong) {
    return <>{audioElement}</>;
  }

  const contextProgress = Number(progress);
  const contextDuration = Number(duration);

  const safeDuration =
    contextDuration &&
    !Number.isNaN(contextDuration) &&
    Number.isFinite(contextDuration)
      ? contextDuration
      : localDuration;

  const safeProgress =
    contextProgress &&
    !Number.isNaN(contextProgress) &&
    Number.isFinite(contextProgress)
      ? contextProgress
      : localProgress;

  const clampedProgress =
    safeDuration > 0 ? Math.min(Math.max(safeProgress, 0), safeDuration) : 0;

  const progressPercent =
    safeDuration > 0 ? (clampedProgress / safeDuration) * 100 : 0;

  return (
    <>
      {audioElement}
      {bufferingOverlay}

      <button
        type="button"
        className={`player-toggle ${isPlayerOpen ? "active" : ""} ${
          effectiveIsPlaying ? "is-playing" : ""
        } ${effectiveIsBuffering ? "is-buffering" : ""}`}
        onClick={() => setIsPlayerOpen((prev) => !prev)}
        aria-label={isPlayerOpen ? "Hide music player" : "Show music player"}
        title={isPlayerOpen ? "Hide player" : "Show player"}
      >
        <span className="toggle-arrow">
          {isPlayerOpen ? <FaChevronDown /> : <FaChevronUp />}
        </span>

        <span className="toggle-content">
          <span className="toggle-title">
            {isPlayerOpen ? "Hide Player" : "Open Player"}
          </span>

          <span className="toggle-song">
            {effectiveIsBuffering
              ? bufferMessage || "Buffering..."
              : currentSong?.title || "Now Playing"}
          </span>
        </span>

        <span className="toggle-equalizer">
          <i></i>
          <i></i>
          <i></i>
        </span>
      </button>

      <div className={`player-shell ${isPlayerOpen ? "show" : "hide"}`}>
        <div
          className={`player container-fluid ${
            effectiveIsBuffering ? "player-buffering" : ""
          }`}
        >
          <div className="row g-2 g-md-3 align-items-center">
            <div className="col-12 col-md-4">
              <div className="player-info">
                <button
                  type="button"
                  className="cover-button"
                  onClick={openCurrentSongDetails}
                  aria-label={`Open ${
                    currentSong?.title || "current song"
                  } details`}
                  title="Open song details"
                >
                  <img
                    src={currentSong?.imageUrl || "/fallback.jpg"}
                    alt={currentSong?.title || "song cover"}
                    className={
                      effectiveIsPlaying ? "cover playing-cover" : "cover"
                    }
                  />
                </button>

                <div className="info-text">
                  <h4>{currentSong?.title || "Unknown Song"}</h4>
                  <p>
                    {effectiveIsBuffering
                      ? bufferMessage || "Buffering audio..."
                      : getArtistName(currentSong)}
                  </p>
                </div>
              </div>
            </div>

            <div className="col-12 col-md-5">
              <div className="controls">
                <button
                  type="button"
                  className="control-btn track-btn"
                  onClick={prevSong}
                  aria-label="Previous song"
                  title="Previous song"
                >
                  <FaStepBackward />
                </button>

                <button
                  type="button"
                  className="control-btn skip-btn"
                  onClick={() => handleSkipBackward(30)}
                  aria-label="Skip backward 30 seconds"
                  title="Back 30 seconds"
                >
                  <FaBackward />
                  <span>30</span>
                </button>

                <button
                  type="button"
                  className="control-btn skip-btn"
                  onClick={() => handleSkipBackward(15)}
                  aria-label="Skip backward 15 seconds"
                  title="Back 15 seconds"
                >
                  <FaBackward />
                  <span>15</span>
                </button>

                <button
                  type="button"
                  className={`play ${
                    effectiveIsBuffering ? "play-loading" : ""
                  }`}
                  onClick={togglePlay}
                  aria-label={effectiveIsPlaying ? "Pause song" : "Play song"}
                  title={effectiveIsPlaying ? "Pause" : "Play"}
                >
                  {effectiveIsBuffering ? (
                    <span className="play-spinner" aria-hidden="true"></span>
                  ) : effectiveIsPlaying ? (
                    <FaPause />
                  ) : (
                    <FaPlay />
                  )}
                </button>

                <button
                  type="button"
                  className="control-btn skip-btn"
                  onClick={() => handleSkipForward(15)}
                  aria-label="Skip forward 15 seconds"
                  title="Forward 15 seconds"
                >
                  <FaForward />
                  <span>15</span>
                </button>

                <button
                  type="button"
                  className="control-btn skip-btn"
                  onClick={() => handleSkipForward(30)}
                  aria-label="Skip forward 30 seconds"
                  title="Forward 30 seconds"
                >
                  <FaForward />
                  <span>30</span>
                </button>

                <button
                  type="button"
                  className="control-btn track-btn"
                  onClick={nextSong}
                  aria-label="Next song"
                  title="Next song"
                >
                  <FaStepForward />
                </button>
              </div>
            </div>

            <div className="col-12 col-md-3">
              <div className="seek">
                <div className="time-row">
                  <span>{formatTime(clampedProgress)}</span>
                  <span>{formatTime(safeDuration)}</span>
                </div>

                <input
                  type="range"
                  min="0"
                  max={safeDuration || 0}
                  step="0.01"
                  value={clampedProgress}
                  onMouseDown={handleSeekStart}
                  onMouseUp={handleSeekEnd}
                  onTouchStart={handleSeekStart}
                  onTouchEnd={handleSeekEnd}
                  onKeyDown={handleSeekStart}
                  onKeyUp={handleSeekEnd}
                  onChange={handleSeek}
                  disabled={!safeDuration}
                  style={{
                    background: `linear-gradient(to right, #5cf680 ${progressPercent}%, #2a2a35 ${progressPercent}%)`,
                  }}
                  aria-label="Seek song position"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MusicPlayer;