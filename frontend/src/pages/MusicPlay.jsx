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
import { useNavigate } from "react-router-dom";
import "./CSS/MusicPlay.css";
import { MusicPlayerContext } from "../context/MainPlayerContext";

const formatTime = (seconds = 0) => {
  if (!seconds || Number.isNaN(seconds)) return "0:00";

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const getArtistName = (song) =>
  song?.artist?.name || song?.artistName || song?.artist || "Unknown Artist";

const MusicPlayer = () => {
  const hiddenAudioRef = useRef(null);
  const bufferOverlayTimerRef = useRef(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [showBufferOverlay, setShowBufferOverlay] = useState(false);
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
    if (isBuffering && currentSong) {
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
  }, [isBuffering, currentSong]);

  const openCurrentSongDetails = () => {
    if (!currentSong?._id) return;

    navigate(`/song/${currentSong._id}`, {
      state: {
        playlist,
      },
    });
  };

  const audioElement = (
    <audio
      ref={hiddenAudioRef}
      preload="auto"
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

  const safeProgress = progress || 0;
  const safeDuration = duration || 0;

  const progressPercent =
    safeDuration > 0 ? (safeProgress / safeDuration) * 100 : 0;

  return (
    <>
      {audioElement}
      {bufferingOverlay}

      <button
        type="button"
        className={`player-toggle ${isPlayerOpen ? "active" : ""} ${
          isPlaying ? "is-playing" : ""
        } ${isBuffering ? "is-buffering" : ""}`}
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
            {isBuffering
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
        <div className={`player container-fluid ${isBuffering ? "player-buffering" : ""}`}>
          <div className="row g-2 g-md-3 align-items-center">
            <div className="col-12 col-md-4">
              <div className="player-info">
                <button
                  type="button"
                  className="cover-button"
                  onClick={openCurrentSongDetails}
                  aria-label={`Open ${currentSong?.title || "current song"} details`}
                  title="Open song details"
                >
                  <img
                    src={currentSong?.imageUrl || "/fallback.jpg"}
                    alt={currentSong?.title || "song cover"}
                    className={isPlaying ? "cover playing-cover" : "cover"}
                  />
                </button>

                <div className="info-text">
                  <h4>{currentSong?.title || "Unknown Song"}</h4>
                  <p>
                    {isBuffering
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
                  onClick={() => skipBackward(30)}
                  aria-label="Skip backward 30 seconds"
                  title="Back 30 seconds"
                >
                  <FaBackward />
                  <span>30</span>
                </button>

                <button
                  type="button"
                  className="control-btn skip-btn"
                  onClick={() => skipBackward(15)}
                  aria-label="Skip backward 15 seconds"
                  title="Back 15 seconds"
                >
                  <FaBackward />
                  <span>15</span>
                </button>

                <button
                  type="button"
                  className={`play ${isBuffering ? "play-loading" : ""}`}
                  onClick={togglePlay}
                  aria-label={isPlaying ? "Pause song" : "Play song"}
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isBuffering ? (
                    <span className="play-spinner" aria-hidden="true"></span>
                  ) : isPlaying ? (
                    <FaPause />
                  ) : (
                    <FaPlay />
                  )}
                </button>

                <button
                  type="button"
                  className="control-btn skip-btn"
                  onClick={() => skipForward(15)}
                  aria-label="Skip forward 15 seconds"
                  title="Forward 15 seconds"
                >
                  <FaForward />
                  <span>15</span>
                </button>

                <button
                  type="button"
                  className="control-btn skip-btn"
                  onClick={() => skipForward(30)}
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
                  <span>{formatTime(safeProgress)}</span>
                  <span>{formatTime(safeDuration)}</span>
                </div>

                <input
                  type="range"
                  min="0"
                  max={safeDuration}
                  value={safeProgress}
                  onChange={(e) => seekTo(Number(e.target.value))}
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