import React, { useContext } from "react";
import {
  FaBan,
  FaClock,
  FaPause,
  FaPlay,
  FaRandom,
  FaRedo,
  FaStepBackward,
  FaStepForward,
} from "react-icons/fa";
import { MusicPlayerContext } from "../context/MainPlayerContext";
import "./CSS/SongDetails.css";

const formatTime = (seconds) => {
  const safeSeconds = Number.isFinite(Number(seconds)) ? Math.max(0, Number(seconds)) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = Math.floor(safeSeconds % 60);

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

const demoSong = {
  title: "Song Title",
  artist: {
    name: "Artist Name",
  },
  imageUrl: "/fallback-cover.png",
  duration: 180,
};

const SongDetails = () => {
  const {
    currentSong,
    isPlaying,
    progress,
    duration,
    shuffle,
    repeat,
    togglePlay,
    nextSong,
    prevSong,
    seekTo,
    setShuffle,
    cycleRepeat,
  } = useContext(MusicPlayerContext);

  const song = currentSong || demoSong;

  const image = song?.imageUrl || song?.album?.coverImage || "/fallback-cover.png";
  const songDuration = duration || song?.duration || 0;
  const songProgress = progress || 0;

  const seekPercent =
    songDuration > 0
      ? (Math.min(songProgress, songDuration) / songDuration) * 100
      : 0;

  const handleSeek = (event) => {
    seekTo?.(Number(event.target.value));
  };

  return (
    <main className="song-details-page">
      <section className="song-top-section">
        <img className="song-bg-blur" src={image} alt="" />

        <div className="song-top-card">
          <div className="song-cover-wrap">
            <img className="song-cover-img" src={image} alt={song.title} />

            {isPlaying && (
              <div className="song-equalizer">
                <i></i>
                <i></i>
                <i></i>
                <i></i>
              </div>
            )}
          </div>

          <div className="song-top-info">
            <span className="song-small-label">Now Playing</span>

            <h1>{song.title}</h1>

            <p className="song-artist-name">
              {song.artist?.name || "Unknown Artist"}
            </p>

            <div className="song-duration-pill">
              <FaClock />
              <span>{formatTime(songDuration)}</span>
            </div>

            <div className="song-main-controls">
              <button
                type="button"
                className={`song-icon-btn ${shuffle ? "active" : ""}`}
                onClick={() => setShuffle?.((value) => !value)}
                aria-label="Shuffle"
              >
                <FaRandom />
              </button>

              <button
                type="button"
                className="song-icon-btn"
                onClick={prevSong}
                aria-label="Previous song"
              >
                <FaStepBackward />
              </button>

              <button
                type="button"
                className="song-play-btn"
                onClick={togglePlay}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <FaPause /> : <FaPlay />}
              </button>

              <button
                type="button"
                className="song-icon-btn"
                onClick={nextSong}
                aria-label="Next song"
              >
                <FaStepForward />
              </button>

              <button
                type="button"
                className={`song-icon-btn ${repeat !== "off" ? "active" : ""}`}
                onClick={cycleRepeat}
                aria-label="Repeat"
              >
                {repeat === "off" ? <FaBan /> : <FaRedo />}
                {repeat === "one" && <span className="repeat-one">1</span>}
              </button>
            </div>

            <div className="song-progress-area">
              <input
                type="range"
                min="0"
                max={songDuration || 0}
                step="0.1"
                value={Math.min(songProgress, songDuration || 0)}
                onChange={handleSeek}
                style={{
                  background: `linear-gradient(to right, #5cf680 ${seekPercent}%, rgba(255,255,255,0.16) ${seekPercent}%)`,
                }}
              />

              <div className="song-time-row">
                <span>{formatTime(songProgress)}</span>
                <span>{formatTime(songDuration)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default SongDetails;