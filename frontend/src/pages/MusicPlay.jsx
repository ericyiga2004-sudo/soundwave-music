import { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  ListMusic,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import "./CSS/MusicPlay.css";
import { MusicPlayerContext } from "../context/MainPlayerContext";
import { getLowData, UI_PREFERENCES_EVENT } from "../utils/uiPreferences";

const formatTime = (seconds = 0) => {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const mins = Math.floor(value / 60);
  const secs = Math.floor(value % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
};

const getArtistName = (song) =>
  song?.artist?.name || song?.artistName || song?.artist || "Unknown Artist";

const getCover = (song) =>
  song?.imageUrl || song?.image || song?.coverImage || song?.album?.coverImage || "/fallback-cover.svg";

const VOLUME_KEY = "soundwave_player_volume";

const MusicPlayer = () => {
  const hiddenAudioRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const lastAudibleVolumeRef = useRef(0.82);
  const [queueOpen, setQueueOpen] = useState(false);
  const [lowData, setLowData] = useState(getLowData);
  const [volume, setVolume] = useState(() => {
    const stored = Number(localStorage.getItem(VOLUME_KEY));
    return Number.isFinite(stored) && stored >= 0 && stored <= 1 ? stored : 0.82;
  });

  const {
    registerAudioElement,
    currentSong,
    playlist = [],
    currentIndex = -1,
    isPlaying,
    isBuffering,
    bufferMessage,
    playbackError,
    progress = 0,
    duration = 0,
    shuffle,
    repeat,
    repeatModes,
    togglePlay,
    seekTo,
    nextSong,
    prevSong,
    playSong,
    setShuffle,
    cycleRepeat,
  } = useContext(MusicPlayerContext);


  useEffect(() => {
    const syncDataMode = () => setLowData(getLowData());
    window.addEventListener(UI_PREFERENCES_EVENT, syncDataMode);
    return () => window.removeEventListener(UI_PREFERENCES_EVENT, syncDataMode);
  }, []);

  useEffect(() => {
    const audio = hiddenAudioRef.current;
    if (!audio || typeof registerAudioElement !== "function") return undefined;
    registerAudioElement(audio);
    return () => registerAudioElement(null);
  }, [registerAudioElement]);

  useEffect(() => {
    if (!hiddenAudioRef.current) return;
    hiddenAudioRef.current.volume = volume;
    hiddenAudioRef.current.muted = volume <= 0.001;
    localStorage.setItem(VOLUME_KEY, String(volume));
    if (volume > 0.001) lastAudibleVolumeRef.current = volume;
  }, [volume]);

  // When Next / Previous / Up Next changes the playing track while the user
  // is already on a song page, keep the URL and the detail page synchronized
  // with the real current track.
  useEffect(() => {
    if (!currentSong?._id || !location.pathname.startsWith("/song/")) return;

    const routeSongId = location.pathname.split("/")[2] || "";
    if (String(routeSongId) === String(currentSong._id)) return;

    navigate(`/song/${currentSong._id}`, {
      replace: true,
      state: { song: currentSong, playlist },
    });
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [currentSong, location.pathname, navigate, playlist]);


  const safeDuration = Number.isFinite(Number(duration)) ? Number(duration) : 0;
  const safeProgress = Number.isFinite(Number(progress)) ? Math.max(0, Number(progress)) : 0;
  const clampedProgress = safeDuration > 0 ? Math.min(safeProgress, safeDuration) : 0;
  const progressPercent = safeDuration > 0 ? (clampedProgress / safeDuration) * 100 : 0;

  const volumeIcon = useMemo(() => {
    if (volume === 0) return <VolumeX size={17} />;
    if (volume < 0.45) return <Volume1 size={17} />;
    return <Volume2 size={17} />;
  }, [volume]);

  const openSong = () => {
    if (!currentSong?._id) return;
    navigate(`/song/${currentSong._id}`, { state: { playlist } });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const playQueueSong = (song) => {
    if (!song?._id) return;
    playSong?.(song, playlist);
  };

  const toggleMute = () => {
    if (volume > 0.001) {
      lastAudibleVolumeRef.current = volume;
      setVolume(0);
      return;
    }

    setVolume(Math.max(0.25, lastAudibleVolumeRef.current || 0.82));
  };

  const repeatLabel = repeat === repeatModes?.ONE ? "Repeat one" : repeat === repeatModes?.ALL ? "Repeat all" : "Repeat off";

  return (
    <>
      <audio
        ref={hiddenAudioRef}
        preload={lowData ? "metadata" : "auto"}
        playsInline
        style={{ position: "fixed", width: 1, height: 1, opacity: 0, pointerEvents: "none", left: -9999 }}
      />

      {currentSong && (
        <>
          <div className={`sw-player ${isBuffering ? "is-buffering" : ""}`}>
            <div className="sw-player-song">
              <button type="button" className="sw-player-cover" onClick={openSong} aria-label="Open current song">
                <img src={getCover(currentSong)} alt={currentSong?.title || "Current song"} />
              </button>
              <div className="sw-player-song-copy">
                <strong>{currentSong?.title || "Unknown Song"}</strong>
                <span className={playbackError ? "sw-player-error-text" : ""}>{playbackError || (isBuffering ? bufferMessage || "Buffering…" : getArtistName(currentSong))}</span>
              </div>
            </div>

            <div className="sw-player-center">
              <div className="sw-player-controls">
                <button
                  type="button"
                  className={`sw-player-icon-control d-none d-md-grid ${shuffle ? "active" : ""}`}
                  onClick={() => setShuffle?.(!shuffle)}
                  aria-label="Toggle shuffle"
                  title="Shuffle"
                >
                  <Shuffle size={17} />
                </button>
                <button type="button" className="sw-player-icon-control" onClick={prevSong} aria-label="Previous song">
                  <SkipBack size={19} fill="currentColor" />
                </button>
                <button type="button" className="sw-player-main-control" onClick={togglePlay} aria-label={isPlaying ? "Pause" : "Play"}>
                  {isBuffering ? <span className="sw-player-spinner" /> : isPlaying ? <Pause size={21} fill="currentColor" /> : <Play size={21} fill="currentColor" />}
                </button>
                <button type="button" className="sw-player-icon-control" onClick={nextSong} aria-label="Next song">
                  <SkipForward size={19} fill="currentColor" />
                </button>
                <button
                  type="button"
                  className={`sw-player-icon-control d-none d-md-grid ${repeat !== repeatModes?.OFF ? "active" : ""}`}
                  onClick={cycleRepeat}
                  aria-label={repeatLabel}
                  title={repeatLabel}
                >
                  {repeat === repeatModes?.ONE ? <Repeat1 size={17} /> : <Repeat size={17} />}
                </button>
              </div>

              <div className="sw-player-progress-row">
                <span>{formatTime(clampedProgress)}</span>
                <input
                  type="range"
                  min="0"
                  max={safeDuration || 0}
                  step="0.05"
                  value={clampedProgress}
                  onChange={(event) => seekTo?.(Number(event.target.value))}
                  disabled={!safeDuration}
                  aria-label="Seek song position"
                  style={{ "--sw-progress": `${progressPercent}%` }}
                />
                <span>{formatTime(safeDuration)}</span>
              </div>
            </div>

            <div className="sw-player-actions">
              <div className="sw-volume-control d-none d-xl-flex">
                {volumeIcon}
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(event) => setVolume(Number(event.target.value))}
                  aria-label="Volume"
                />
              </div>
              <button
                type="button"
                className={`sw-player-icon-control d-xl-none ${volume <= 0.001 ? "active" : ""}`}
                onClick={toggleMute}
                aria-label={volume <= 0.001 ? "Unmute" : "Mute"}
                title={volume <= 0.001 ? "Unmute" : "Mute"}
              >
                {volume <= 0.001 ? <VolumeX size={18} /> : volume < 0.45 ? <Volume1 size={18} /> : <Volume2 size={18} />}
              </button>
              <button
                type="button"
                className={`sw-player-icon-control sw-queue-toggle ${queueOpen ? "active" : ""}`}
                onClick={() => setQueueOpen((open) => !open)}
                aria-label="Show queue"
                title="Queue"
              >
                <ListMusic size={18} />
              </button>
            </div>
          </div>

          <aside className={`sw-queue-drawer ${queueOpen ? "open" : ""}`} aria-hidden={!queueOpen}>
            <div className="sw-queue-header">
              <div>
                <small>Up Next</small>
                <h3>Playing Queue</h3>
              </div>
              <button type="button" onClick={() => setQueueOpen(false)} aria-label="Close queue"><X size={18} /></button>
            </div>
            <div className="sw-queue-list">
              {playlist.length ? (
                playlist.map((song, index) => (
                  <button
                    type="button"
                    className={`sw-queue-item ${index === currentIndex ? "active" : ""}`}
                    key={song?._id || index}
                    onClick={() => playQueueSong(song)}
                  >
                    <img src={getCover(song)} alt="" loading="lazy" decoding="async" />
                    <span>
                      <strong>{song?.title || "Unknown Song"}</strong>
                      <small>{getArtistName(song)}</small>
                    </span>
                    <em>{index === currentIndex ? "Playing" : index + 1}</em>
                  </button>
                ))
              ) : (
                <p className="sw-queue-empty">Your queue is empty.</p>
              )}
            </div>
          </aside>
        </>
      )}
    </>
  );
};

export default MusicPlayer;
