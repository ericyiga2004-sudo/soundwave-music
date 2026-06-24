import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import {
  FaBan,
  FaChevronDown,
  FaClock,
  FaHeart,
  FaMusic,
  FaPause,
  FaPlay,
  FaPlus,
  FaRandom,
  FaRedo,
  FaRegHeart,
  FaStepBackward,
  FaStepForward,
} from "react-icons/fa";
import "./CSS/SongDetails.css";
import { MusicPlayerContext } from "../context/MainPlayerContext";
import { MusicContext } from "../context/ShopContext";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

const INITIAL_RELATED_COUNT = 6;

const formatTime = (seconds) => {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = Math.floor(safeSeconds % 60);

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

const compactNumber = (value) => {
  const number = Number(value || 0);

  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(number);
};

const getImage = (song) =>
  song?.imageUrl || song?.album?.coverImage || "/fallback-cover.png";

const getAlbumCover = (song) =>
  song?.album?.coverImage || song?.imageUrl || "/fallback-cover.png";

const getArtistImage = (song) =>
  song?.artist?.image || song?.imageUrl || "/fallback-cover.png";

const normalizeText = (value) => {
  return String(value || "").trim().toLowerCase();
};

const normalizeSongs = (songs = []) => {
  const seen = new Set();

  return songs.filter((song) => {
    if (!song?._id || seen.has(song._id)) return false;
    seen.add(song._id);
    return true;
  });
};

const getRepeatLabel = (repeat) => {
  if (repeat === "one") return "Repeat one";
  if (repeat === "all") return "Repeat all";
  return "Repeat off";
};

const parseLrcTimestamp = (timestamp) => {
  const parts = String(timestamp || "").split(":");

  if (parts.length !== 2) return null;

  const minutes = Number(parts[0]);
  const seconds = Number(parts[1]);

  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;

  return minutes * 60 + seconds;
};

const parseLrcLyrics = (lrcText = "") => {
  const lines = String(lrcText || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const parsedLines = [];

  lines.forEach((line) => {
    const matches = [...line.matchAll(/\[(\d{1,2}:\d{2}(?:\.\d{1,3})?)\]/g)];

    if (!matches.length) return;

    const text = line
      .replace(/\[(\d{1,2}:\d{2}(?:\.\d{1,3})?)\]/g, "")
      .trim();

    if (!text) return;

    matches.forEach((match) => {
      const start = parseLrcTimestamp(match[1]);

      if (Number.isFinite(start)) {
        parsedLines.push({
          text,
          start,
          end: null,
          words: [],
        });
      }
    });
  });

  const sortedLines = parsedLines.sort((a, b) => a.start - b.start);

  return sortedLines.map((line, index) => ({
    ...line,
    end: sortedLines[index + 1]?.start ?? null,
  }));
};

const normalizeSyncedLyricsForDisplay = (song) => {
  if (Array.isArray(song?.syncedLyrics) && song.syncedLyrics.length > 0) {
    return song.syncedLyrics
      .map((line) => {
        const text = String(line?.text || "").trim();
        const start = Number(line?.start);

        const end =
          line?.end === null || line?.end === undefined || line?.end === ""
            ? null
            : Number(line.end);

        const words = Array.isArray(line?.words)
          ? line.words
              .map((word) => {
                const wordText = String(word?.text || "").trim();
                const wordStart = Number(word?.start);
                const wordEnd = Number(word?.end);

                if (
                  !wordText ||
                  !Number.isFinite(wordStart) ||
                  !Number.isFinite(wordEnd) ||
                  wordEnd < wordStart
                ) {
                  return null;
                }

                return {
                  text: wordText,
                  start: wordStart,
                  end: wordEnd,
                };
              })
              .filter(Boolean)
          : [];

        if (!text || !Number.isFinite(start)) return null;

        return {
          text,
          start,
          end: Number.isFinite(end) && end >= start ? end : null,
          words,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.start - b.start);
  }

  return parseLrcLyrics(song?.lrcLyrics || "");
};

const getActiveLyricIndex = (lines, currentTime) => {
  if (!Array.isArray(lines) || lines.length === 0) return -1;

  return lines.findIndex((line, index) => {
    const nextLine = lines[index + 1];
    const end = Number.isFinite(line.end)
      ? line.end
      : nextLine?.start ?? Infinity;

    return currentTime >= line.start && currentTime < end;
  });
};

const SongDetails = ({ relatedSongs: relatedSongsProp = [] }) => {
  const { id, songId } = useParams();
  const routeSongId = songId || id;
  const navigate = useNavigate();
  const location = useLocation();

  const lyricLineRefs = useRef({});
  const lyricsScrollRef = useRef(null);

  const {
    currentSong,
    isPlaying,
    progress,
    duration,
    shuffle,
    repeat,
    audioEffects,
    setAudioEffects,
    resetAudioEffects,
    bassEnergy,
    kickActive,
    playSong,
    togglePlay,
    nextSong,
    prevSong,
    seekTo,
    setShuffle,
    cycleRepeat,
    setQueueForCurrentSong,
  } = useContext(MusicPlayerContext);

  const {
    token,
    playlists = [],
    fetchPlaylists,
    backendUrl: contextBackendUrl,
  } = useContext(MusicContext);

  const apiBaseUrl = contextBackendUrl || backendUrl;

  const [song, setSong] = useState(null);
  const [allSongs, setAllSongs] = useState([]);
  const [liked, setLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [showAllRelated, setShowAllRelated] = useState(false);
  const [showEffectsModal, setShowEffectsModal] = useState(false);

  const [showPlaylistBox, setShowPlaylistBox] = useState(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlistMessage, setPlaylistMessage] = useState("");

  const safeBassEnergy = Math.min(Math.max(Number(bassEnergy || 0), 0), 1);
  const partyStyle = {
    "--bass-energy": safeBassEnergy,
  };

  const locationSongs = location.state?.playlist || [];

  const externalRelatedSongs = relatedSongsProp.length
    ? relatedSongsProp
    : locationSongs;

  const isCurrentSong = currentSong?._id === song?._id;

  const displayedProgress = isCurrentSong ? progress : 0;

  const displayedDuration = isCurrentSong
    ? duration || song?.duration || 0
    : song?.duration || 0;

  const seekPercent =
    displayedDuration > 0
      ? (Math.min(displayedProgress, displayedDuration) / displayedDuration) *
        100
      : 0;

  useEffect(() => {
    if (!routeSongId) return;

    let cancelled = false;

    const fetchSong = async () => {
      try {
        setLoading(true);
        setPageError("");
        setShowAllRelated(false);
        setShowPlaylistBox(false);
        setShowEffectsModal(false);
        setPlaylistMessage("");
        lyricLineRefs.current = {};

        const response = await axios.get(
          `${apiBaseUrl}/api/songs/${routeSongId}`
        );

        const responseSong = response.data?.song || response.data?.data;

        if (!cancelled) {
          if (response.data?.success === false || !responseSong?._id) {
            setPageError("Song could not be found.");
            setSong(null);
          } else {
            setSong(responseSong);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setSong(null);
          setPageError("Unable to load this song.");
          console.error("Failed to fetch song:", error);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchSong();

    return () => {
      cancelled = true;
    };
  }, [routeSongId, apiBaseUrl]);

  useEffect(() => {
    if (!token || !routeSongId) {
      setLiked(false);
      return;
    }

    let cancelled = false;

    const checkLiked = async () => {
      try {
        const res = await axios.get(
          `${apiBaseUrl}/api/likes/check/${routeSongId}`,
          {
            headers: {
              token,
            },
          }
        );

        if (!cancelled && res.data.success) {
          setLiked(Boolean(res.data.liked));
        }
      } catch (error) {
        console.log("Failed to check liked song:", error);
      }
    };

    checkLiked();

    return () => {
      cancelled = true;
    };
  }, [token, routeSongId, apiBaseUrl]);

  useEffect(() => {
    let cancelled = false;

    const fetchAllSongs = async () => {
      try {
        const response = await axios.get(`${apiBaseUrl}/api/songs`);
        const fetchedSongs = response.data?.songs || response.data?.data || [];

        if (!cancelled) {
          setAllSongs(Array.isArray(fetchedSongs) ? fetchedSongs : []);
        }
      } catch (error) {
        if (!cancelled) {
          setAllSongs([]);
          console.error("Failed to fetch related songs:", error);
        }
      }
    };

    fetchAllSongs();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    if (token) {
      fetchPlaylists?.();
    }
  }, [token, fetchPlaylists]);

  useEffect(() => {
    document.body.classList.toggle(
      "song-modal-open",
      showEffectsModal || showLyrics
    );

    return () => {
      document.body.classList.remove("song-modal-open");
    };
  }, [showEffectsModal, showLyrics]);

  const relatedSongs = useMemo(() => {
    if (!song) return normalizeSongs(externalRelatedSongs);

    const sourceSongs = externalRelatedSongs.length
      ? externalRelatedSongs
      : allSongs;

    const currentArtistId = song.artist?._id;
    const currentCountry = normalizeText(song.artist?.country);
    const currentGenre = normalizeText(song.genre);

    const sameArtist = sourceSongs.filter((item) => {
      return (
        item?._id !== song._id &&
        item?.artist?._id &&
        currentArtistId &&
        item.artist._id === currentArtistId
      );
    });

    const sameCountry = sourceSongs.filter((item) => {
      return (
        item?._id !== song._id &&
        currentCountry &&
        normalizeText(item?.artist?.country) === currentCountry
      );
    });

    const sameGenre = sourceSongs.filter((item) => {
      return (
        item?._id !== song._id &&
        currentGenre &&
        normalizeText(item?.genre) === currentGenre
      );
    });

    const remaining = sourceSongs.filter((item) => item?._id !== song._id);

    return normalizeSongs([
      ...sameArtist,
      ...sameCountry,
      ...sameGenre,
      ...remaining,
    ]).slice(0, 20);
  }, [allSongs, externalRelatedSongs, song]);

  const visibleRelatedSongs = useMemo(() => {
    return showAllRelated
      ? relatedSongs
      : relatedSongs.slice(0, INITIAL_RELATED_COUNT);
  }, [relatedSongs, showAllRelated]);

  const hasMoreRelated = relatedSongs.length > INITIAL_RELATED_COUNT;

  const orderedPlaylist = useMemo(() => {
    if (!song) return [];

    return normalizeSongs([song, ...relatedSongs]);
  }, [relatedSongs, song]);

  useEffect(() => {
    if (!isCurrentSong) return;
    if (orderedPlaylist.length <= 1) return;

    setQueueForCurrentSong?.(orderedPlaylist);
  }, [isCurrentSong, orderedPlaylist, setQueueForCurrentSong]);

  useEffect(() => {
    if (!currentSong?._id) return;
    if (currentSong._id === routeSongId) return;

    navigate(`/song/${currentSong._id}`, {
      replace: false,
      state: {
        playlist: orderedPlaylist,
      },
    });
  }, [currentSong?._id, navigate, orderedPlaylist, routeSongId]);

  const handlePlayPause = useCallback(() => {
    if (!song) return;

    if (isCurrentSong) {
      togglePlay();
      return;
    }

    playSong(song, orderedPlaylist);
  }, [isCurrentSong, orderedPlaylist, playSong, song, togglePlay]);

  const handleNext = useCallback(async () => {
    if (!song) return;

    if (!isCurrentSong) {
      await playSong(song, orderedPlaylist);
      return;
    }

    const next = await nextSong();

    if (next?._id) {
      navigate(`/song/${next._id}`, {
        state: {
          playlist: orderedPlaylist,
        },
      });
    }
  }, [isCurrentSong, navigate, nextSong, orderedPlaylist, playSong, song]);

  const handlePrevious = useCallback(async () => {
    if (!song) return;

    if (!isCurrentSong) {
      await playSong(song, orderedPlaylist);
      return;
    }

    const previous = await prevSong();

    if (previous?._id) {
      navigate(`/song/${previous._id}`, {
        state: {
          playlist: orderedPlaylist,
        },
      });
    }
  }, [isCurrentSong, navigate, orderedPlaylist, playSong, prevSong, song]);

  const handleSeek = (event) => {
    const nextTime = Number(event.target.value);
    seekTo(nextTime);
  };

  const handleRelatedSongClick = (targetSong) => {
    playSong(targetSong, orderedPlaylist);

    navigate(`/song/${targetSong._id}`, {
      state: {
        playlist: orderedPlaylist,
      },
    });
  };

  const updateAudioEffect = (effectName, value) => {
    setAudioEffects?.((previousEffects = {}) => ({
      ...previousEffects,
      [effectName]: Number(value),
    }));
  };

  const applyEffectsPreset = (preset) => {
    setAudioEffects?.(preset);
  };

  const handleToggleLike = async () => {
    if (!token) {
      alert("Please login to like songs");
      return;
    }

    if (!song?._id || likeLoading) return;

    try {
      setLikeLoading(true);

      const res = await axios.post(
        `${apiBaseUrl}/api/likes/toggle/${song._id}`,
        {},
        {
          headers: {
            token,
          },
        }
      );

      if (res.data.success) {
        setLiked(Boolean(res.data.liked));

        setSong((previousSong) => {
          if (!previousSong) return previousSong;

          return {
            ...previousSong,
            likes: res.data.likes,
          };
        });
      } else {
        alert(res.data.message || "Could not update like");
      }
    } catch (error) {
      console.log(error);
      alert("Could not update like");
    } finally {
      setLikeLoading(false);
    }
  };

  const addCurrentSongToPlaylist = async () => {
    if (!token) {
      setPlaylistMessage("Please login first.");
      return;
    }

    if (!selectedPlaylistId) {
      setPlaylistMessage("Please select a playlist.");
      return;
    }

    if (!song?._id) return;

    try {
      setPlaylistLoading(true);
      setPlaylistMessage("");

      const res = await axios.post(
        `${apiBaseUrl}/api/playlist/add-song`,
        {
          playlistId: selectedPlaylistId,
          songId: song._id,
        },
        {
          headers: {
            token,
          },
        }
      );

      if (res.data.success) {
        setPlaylistMessage("Song added to playlist.");
        fetchPlaylists?.();
      } else {
        setPlaylistMessage(res.data.message || "Could not add song.");
      }
    } catch (error) {
      console.log(error);
      setPlaylistMessage("Could not add song to playlist.");
    } finally {
      setPlaylistLoading(false);
    }
  };

  const createPlaylistAndAddSong = async (event) => {
    event.preventDefault();

    if (!token) {
      setPlaylistMessage("Please login first.");
      return;
    }

    if (!newPlaylistName.trim()) {
      setPlaylistMessage("Playlist name is required.");
      return;
    }

    if (!song?._id) return;

    try {
      setPlaylistLoading(true);
      setPlaylistMessage("");

      const createRes = await axios.post(
        `${apiBaseUrl}/api/playlist/create`,
        {
          name: newPlaylistName.trim(),
          description: `Created from ${song.title}`,
        },
        {
          headers: {
            token,
          },
        }
      );

      if (!createRes.data.success) {
        setPlaylistMessage(
          createRes.data.message || "Could not create playlist."
        );
        return;
      }

      const playlistId = createRes.data.playlist?._id;

      if (!playlistId) {
        setPlaylistMessage("Playlist created, but ID was not returned.");
        return;
      }

      const addRes = await axios.post(
        `${apiBaseUrl}/api/playlist/add-song`,
        {
          playlistId,
          songId: song._id,
        },
        {
          headers: {
            token,
          },
        }
      );

      if (!addRes.data.success) {
        setPlaylistMessage(
          addRes.data.message || "Playlist created, but song was not added."
        );
        return;
      }

      setNewPlaylistName("");
      setSelectedPlaylistId(playlistId);
      setPlaylistMessage("Playlist created and song added.");
      fetchPlaylists?.();
    } catch (error) {
      console.log(error);
      setPlaylistMessage("Could not create playlist.");
    } finally {
      setPlaylistLoading(false);
    }
  };

  const lyrics = song?.lyrics || song?.lyricsText || "";

  const timedLyrics = useMemo(() => {
    return normalizeSyncedLyricsForDisplay(song);
  }, [song]);

  const activeLyricIndex = useMemo(() => {
    return getActiveLyricIndex(timedLyrics, displayedProgress);
  }, [timedLyrics, displayedProgress]);

  const hasTimedLyrics = timedLyrics.length > 0;

  const activeLyricLine =
    activeLyricIndex >= 0 ? timedLyrics[activeLyricIndex] : null;

  const activeLyricText = activeLyricLine?.text || "";

  useEffect(() => {
    if (!showLyrics) return;
    if (activeLyricIndex < 0) return;

    const container = lyricsScrollRef.current;
    const activeElement = lyricLineRefs.current[activeLyricIndex];

    if (!container || !activeElement) return;

    const containerRect = container.getBoundingClientRect();
    const activeRect = activeElement.getBoundingClientRect();

    const activeOffsetInsideContainer =
      activeRect.top - containerRect.top + container.scrollTop;

    const targetScrollTop =
      activeOffsetInsideContainer -
      container.clientHeight / 2 +
      activeElement.clientHeight / 2;

    container.scrollTo({
      top: Math.max(0, targetScrollTop),
      behavior: "smooth",
    });
  }, [activeLyricIndex, showLyrics]);

  const currentAudioEffects = {
    bassBoost: Number(audioEffects?.bassBoost || 0),
    reverb: Number(audioEffects?.reverb || 0),
    presence: Number(audioEffects?.presence || 0),
  };

  if (loading) {
    return (
      <div className="song-page">
        <div className="song-loading">
          <span className="loader-orb"></span>
          Loading song...
        </div>
      </div>
    );
  }

  if (pageError || !song) {
    return (
      <div className="song-page">
        <div className="song-loading">{pageError || "Song not found."}</div>
      </div>
    );
  }

  return (
    <main className="song-page">
      <section className="song-hero">
        <img className="song-hero-bg" src={getImage(song)} alt="" />

        <div className="song-hero-overlay">
          <div className="song-glass-panel">
            <div className="cover-wrap">
              <img
                className="song-cover"
                src={getImage(song)}
                alt={`${song.title} cover`}
              />

              {isCurrentSong && isPlaying && (
                <div className="cover-equalizer" aria-hidden="true">
                  <i></i>
                  <i></i>
                  <i></i>
                  <i></i>
                </div>
              )}
            </div>

            <div className="song-meta">
              <span className="badge">Premium Track</span>

              <h1>{song.title}</h1>

              <p className="artist">{song.artist?.name || "Unknown Artist"}</p>

              <p className="album">
                From <strong>{song.album?.title || "Unknown Album"}</strong>
              </p>

              <div className="stats">
                <span>
                  <FaHeart /> {compactNumber(song.likes)} likes
                </span>

                <span>
                  <FaMusic /> {compactNumber(song.plays)} plays
                </span>

                <span>
                  <FaClock /> {formatTime(displayedDuration)}
                </span>
              </div>

              <section className="player-controls" aria-label="Song controls">
                <div className="top-controls">
                  <button
                    type="button"
                    className={`icon-control ${shuffle ? "active" : ""}`}
                    title={shuffle ? "Shuffle on" : "Shuffle off"}
                    aria-label={shuffle ? "Turn shuffle off" : "Turn shuffle on"}
                    onClick={() => setShuffle((value) => !value)}
                  >
                    <FaRandom />
                  </button>

                  <button
                    type="button"
                    className="icon-control"
                    title="Previous song"
                    aria-label="Previous song"
                    onClick={handlePrevious}
                  >
                    <FaStepBackward />
                  </button>

                  <button
                    type="button"
                    className={`play-btner ${
                      isCurrentSong && isPlaying ? "playing" : "paused"
                    }`}
                    onClick={handlePlayPause}
                    title={isCurrentSong && isPlaying ? "Pause" : "Play"}
                    aria-label={isCurrentSong && isPlaying ? "Pause" : "Play"}
                  >
                    {isCurrentSong && isPlaying ? <FaPause /> : <FaPlay />}
                    <span>{isCurrentSong && isPlaying ? "Pause" : "Play"}</span>
                  </button>

                  <button
                    type="button"
                    className="icon-control"
                    title="Next song"
                    aria-label="Next song"
                    onClick={handleNext}
                  >
                    <FaStepForward />
                  </button>

                  <button
                    type="button"
                    className={`icon-control repeat-control ${
                      repeat !== "off" ? "active" : ""
                    }`}
                    title={getRepeatLabel(repeat)}
                    aria-label={getRepeatLabel(repeat)}
                    onClick={cycleRepeat}
                  >
                    {repeat === "off" ? <FaBan /> : <FaRedo />}

                    {repeat === "one" && (
                      <span className="repeat-badge" aria-hidden="true">
                        1
                      </span>
                    )}
                  </button>
                </div>

                <div className="seek-bar">
                  <input
                    type="range"
                    min="0"
                    max={displayedDuration || 0}
                    step="0.1"
                    value={Math.min(displayedProgress, displayedDuration || 0)}
                    onChange={handleSeek}
                    style={{
                      background: `linear-gradient(to right, #5cf680 ${seekPercent}%, rgba(255,255,255,0.16) ${seekPercent}%)`,
                    }}
                    aria-label="Seek song"
                  />

                  <div className="time">
                    <span>{formatTime(displayedProgress)}</span>
                    <span>{formatTime(displayedDuration)}</span>
                  </div>
                </div>

                {hasTimedLyrics && (
                  <button
                    type="button"
                    className="active-lyric-preview"
                    onClick={() => setShowLyrics(true)}
                    aria-label="Open live lyrics"
                  >
                    <span className="active-lyric-preview-label">
                      Now singing
                    </span>
                    <p>{activeLyricText || "Waiting for vocals..."}</p>
                  </button>
                )}
              </section>

              <div className="actions">
                <button
                  type="button"
                  className={`like-btn ${liked ? "active" : ""}`}
                  onClick={handleToggleLike}
                  aria-pressed={liked}
                  disabled={likeLoading}
                >
                  {liked ? <FaHeart /> : <FaRegHeart />}
                  {likeLoading ? "Saving..." : liked ? "Liked" : "Like"}
                </button>

                <button
                  type="button"
                  className="lyrics-btn"
                  onClick={() => setShowLyrics(true)}
                  aria-haspopup="dialog"
                  aria-expanded={showLyrics}
                >
                  <FaChevronDown />
                  Open Lyrics
                </button>

                <button
                  type="button"
                  className="effects-btn"
                  onClick={() => setShowEffectsModal(true)}
                  aria-haspopup="dialog"
                  aria-expanded={showEffectsModal}
                >
                  <FaMusic />
                  Effects / Equalizer
                </button>

                <button
                  type="button"
                  className="playlist-toggle-btn"
                  onClick={() => setShowPlaylistBox((value) => !value)}
                >
                  <FaPlus />
                  Add to Playlist
                </button>
              </div>

              {showPlaylistBox && (
                <div className="song-playlist-box">
                  <h3>Add to Playlist</h3>

                  {!token ? (
                    <p className="playlist-message">
                      Please login to use playlists.
                    </p>
                  ) : (
                    <>
                      <div className="playlist-select-row">
                        <select
                          value={selectedPlaylistId}
                          onChange={(e) =>
                            setSelectedPlaylistId(e.target.value)
                          }
                        >
                          <option value="">Select playlist</option>

                          {playlists.map((playlist) => (
                            <option key={playlist._id} value={playlist._id}>
                              {playlist.name} ({playlist.songs?.length || 0}{" "}
                              songs)
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={addCurrentSongToPlaylist}
                          disabled={playlistLoading || !selectedPlaylistId}
                        >
                          {playlistLoading ? "Adding..." : "Add"}
                        </button>
                      </div>

                      <form
                        className="create-playlist-inline"
                        onSubmit={createPlaylistAndAddSong}
                      >
                        <input
                          type="text"
                          placeholder="New playlist name"
                          value={newPlaylistName}
                          onChange={(e) => setNewPlaylistName(e.target.value)}
                        />

                        <button type="submit" disabled={playlistLoading}>
                          <FaPlus />
                          {playlistLoading ? "Creating..." : "Create & Add"}
                        </button>
                      </form>

                      {playlistMessage && (
                        <p className="playlist-message">{playlistMessage}</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {showEffectsModal && (
        <div
          className="effects-modal-backdrop"
          role="presentation"
          onClick={() => setShowEffectsModal(false)}
        >
          <section
            className="effects-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="effects-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="effects-close-btn"
              onClick={() => setShowEffectsModal(false)}
              aria-label="Close effects"
            >
              ×
            </button>

            <div className="effects-modal-header">
              <span className="effects-kicker">Audio Effects</span>
              <h2 id="effects-modal-title">Equalizer</h2>
              <p>Shape the sound with bass, reverb, and presence.</p>
            </div>

            <div className="focus-equalizer" aria-hidden="true">
              {Array.from({ length: 8 }).map((_, index) => (
                <span
                  key={index}
                  style={{ "--delay": `${index * 0.08}s` }}
                />
              ))}
            </div>

            <div className="effects-controls">
              <label>
                <span>
                  Bass Boost <strong>{currentAudioEffects.bassBoost}</strong>
                </span>
                <input
                  type="range"
                  min="-10"
                  max="18"
                  step="1"
                  value={currentAudioEffects.bassBoost}
                  onChange={(event) =>
                    updateAudioEffect("bassBoost", event.target.value)
                  }
                />
              </label>

              <label>
                <span>
                  Reverb <strong>{currentAudioEffects.reverb}%</strong>
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={currentAudioEffects.reverb}
                  onChange={(event) =>
                    updateAudioEffect("reverb", event.target.value)
                  }
                />
              </label>

              <label>
                <span>
                  Presence <strong>{currentAudioEffects.presence}</strong>
                </span>
                <input
                  type="range"
                  min="-10"
                  max="12"
                  step="1"
                  value={currentAudioEffects.presence}
                  onChange={(event) =>
                    updateAudioEffect("presence", event.target.value)
                  }
                />
              </label>
            </div>

            <div className="effects-presets">
              <button type="button" onClick={() => resetAudioEffects?.()}>
                Reset
              </button>

              <button
                type="button"
                onClick={() =>
                  applyEffectsPreset({
                    bassBoost: 12,
                    reverb: 18,
                    presence: 4,
                  })
                }
              >
                Club
              </button>

              <button
                type="button"
                onClick={() =>
                  applyEffectsPreset({
                    bassBoost: 6,
                    reverb: 8,
                    presence: 8,
                  })
                }
              >
                Vocal
              </button>

              <button
                type="button"
                onClick={() =>
                  applyEffectsPreset({
                    bassBoost: -2,
                    reverb: 35,
                    presence: 2,
                  })
                }
              >
                Ambient
              </button>
            </div>
          </section>
        </div>
      )}

      {showLyrics && (
        <div
          className={`lyrics-modal-backdrop party-lyrics-backdrop ${
            kickActive ? "kick-react" : ""
          }`}
          role="presentation"
          onClick={() => setShowLyrics(false)}
          style={partyStyle}
        >
          <section
            className={`lyrics-modal-card party-lyrics-card ${
              kickActive ? "kick-react" : ""
            } ${safeBassEnergy > 0.42 ? "bass-warm" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="lyrics-modal-title"
            onClick={(event) => event.stopPropagation()}
            style={partyStyle}
          >
            <button
              type="button"
              className="lyrics-modal-close"
              onClick={() => setShowLyrics(false)}
              aria-label="Close lyrics"
            >
              ×
            </button>

            <div className="lyrics-modal-bg party-lyrics-bg">
              <img src={getImage(song)} alt="" />
            </div>

            <div className="party-light party-light-one"></div>
            <div className="party-light party-light-two"></div>
            <div className="party-light party-light-three"></div>

            <div className="party-beam party-beam-one"></div>
            <div className="party-beam party-beam-two"></div>
            <div className="party-beam party-beam-three"></div>

            <div className="party-sparkles" aria-hidden="true">
              {Array.from({ length: 18 }).map((_, index) => (
                <i key={index} style={{ "--spark-index": index }} />
              ))}
            </div>

            <div className="lyrics-modal-header">
              <span>Live Party Lyrics</span>
              <h2 id="lyrics-modal-title">{song.title}</h2>
              <p>{song.artist?.name || "Unknown Artist"}</p>
            </div>

            {hasTimedLyrics ? (
              <>
                <div
                  className={`lyrics-current-glow party-current-glow ${
                    kickActive ? "kick-react" : ""
                  }`}
                  aria-live="polite"
                  style={partyStyle}
                >
                  <span>Now singing</span>
                  <strong>{activeLyricText || "Waiting for vocals..."}</strong>
                </div>

                <div
                  ref={lyricsScrollRef}
                  className="lyrics-modal-scroll synced-lyrics party-lyrics-scroll"
                  aria-label="Timed lyrics"
                >
                  {timedLyrics.map((line, lineIndex) => {
                    const activeLine = lineIndex === activeLyricIndex;
                    const hasWords =
                      Array.isArray(line.words) && line.words.length > 0;

                    return (
                      <p
                        key={`${line.start}-${line.text}-${lineIndex}`}
                        ref={(element) => {
                          if (element) {
                            lyricLineRefs.current[lineIndex] = element;
                          }
                        }}
                        className={`synced-lyric-line modal-line ${
                          activeLine ? "active pulse party-active-line" : ""
                        } ${kickActive && activeLine ? "kick-react" : ""}`}
                      >
                        {hasWords
                          ? line.words.map((word, wordIndex) => {
                              const activeWord =
                                displayedProgress >= word.start &&
                                displayedProgress < word.end;

                              const completedWord =
                                displayedProgress >= word.end;

                              return (
                                <span
                                  key={`${word.text}-${word.start}-${wordIndex}`}
                                  className={`synced-lyric-word ${
                                    activeWord ? "active" : ""
                                  } ${completedWord ? "completed" : ""}`}
                                >
                                  {word.text}{" "}
                                </span>
                              );
                            })
                          : line.text}
                      </p>
                    );
                  })}
                </div>
              </>
            ) : lyrics ? (
              <pre className="lyrics-modal-plain party-plain-lyrics">
                {lyrics}
              </pre>
            ) : (
              <p className="muted-text">Lyrics are not available for this song.</p>
            )}
          </section>
        </div>
      )}

      <section className="info-grid" aria-label="Song information">
        <article className="card album-card">
          <span className="card-label">Album</span>
          <img src={getAlbumCover(song)} alt={song.album?.title || "Album"} />

          <div>
            <h2>{song.album?.title || "Unknown Album"}</h2>
            <p>Explore the sound behind this release.</p>

            {song.album?._id && (
              <button
                type="button"
                className="view-album-btn"
                onClick={() => navigate(`/album/${song.album._id}`)}
              >
                View Album
              </button>
            )}
          </div>
        </article>

        <article className="card artist-card">
          <span className="card-label">Artist</span>
          <img src={getArtistImage(song)} alt={song.artist?.name || "Artist"} />

          <div>
            <h2>{song.artist?.name || "Unknown Artist"}</h2>
            <p>
              {song.artist?.country && song.artist.country !== "Unknown"
                ? `From ${song.artist.country}`
                : "The creator behind this premium track."}
            </p>
          </div>
        </article>
      </section>

      <section className="related-section">
        <div className="section-heading">
          <h2>Related Songs</h2>
          <p>
            Based on artist, country, and genre. Plays in order unless shuffle is
            on.
          </p>
        </div>

        {relatedSongs.length > 0 ? (
          <>
            <div className="related-list">
              {visibleRelatedSongs.map((item, index) => {
                const active = currentSong?._id === item._id;
                const playingNow = active && isPlaying;

                return (
                  <button
                    type="button"
                    key={item._id}
                    className={`related-song ${active ? "active" : ""} ${
                      playingNow ? "playing-now" : ""
                    }`}
                    onClick={() => handleRelatedSongClick(item)}
                  >
                    <span className="track-number">
                      {playingNow ? (
                        <span className="mini-equalizer">
                          <i></i>
                          <i></i>
                          <i></i>
                        </span>
                      ) : active ? (
                        <FaPause />
                      ) : (
                        index + 1
                      )}
                    </span>

                    <img src={getImage(item)} alt={item.title} />

                    <span className="related-copy">
                      <strong>{item.title}</strong>
                      <small>
                        {item.artist?.name || "Unknown Artist"}
                        {active && (
                          <em className="now-playing-label">Playing now</em>
                        )}
                      </small>
                    </span>

                    <span className="related-album">
                      {item.album?.title || "Single"}
                    </span>

                    <span className="related-duration">
                      {formatTime(item.duration)}
                    </span>
                  </button>
                );
              })}
            </div>

            {hasMoreRelated && (
              <button
                type="button"
                className="view-more-btn"
                onClick={() => setShowAllRelated((value) => !value)}
              >
                {showAllRelated ? (
                  <>
                    Show Less <FaChevronDown />
                  </>
                ) : (
                  <>
                    View More Songs <FaChevronDown />
                  </>
                )}
              </button>
            )}
          </>
        ) : (
          <p className="empty-related">No related songs found.</p>
        )}
      </section>
    </main>
  );
};

export default SongDetails;