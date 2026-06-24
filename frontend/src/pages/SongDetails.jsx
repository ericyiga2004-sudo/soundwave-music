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
import "./CSS/SongDetailsV.css";
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
  <main className="sd2-page">
    <section className="sd2-hero">
      <img className="sd2-bg" src={getImage(song)} alt="" />

      <div className="sd2-shell">
        <div className="sd2-card">
          <div className="sd2-coverBox">
            <img
              className="sd2-cover"
              src={getImage(song)}
              alt={`${song.title} cover`}
            />

            {isCurrentSong && isPlaying && (
              <div className="sd2-eq" aria-hidden="true">
                <i></i>
                <i></i>
                <i></i>
                <i></i>
              </div>
            )}
          </div>

          <div className="sd2-info">
            <span className="sd2-badge">Premium Track</span>

            <h1>{song.title}</h1>

            <p className="sd2-artist">
              {song.artist?.name || "Unknown Artist"}
            </p>

            <p className="sd2-album">
              From <strong>{song.album?.title || "Unknown Album"}</strong>
            </p>

            <div className="sd2-stats">
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

            <section className="sd2-player" aria-label="Song controls">
              <div className="sd2-controls">
                <button
                  type="button"
                  className={`sd2-iconBtn ${shuffle ? "active" : ""}`}
                  onClick={() => setShuffle((value) => !value)}
                  aria-label={shuffle ? "Turn shuffle off" : "Turn shuffle on"}
                >
                  <FaRandom />
                </button>

                <button
                  type="button"
                  className="sd2-iconBtn"
                  onClick={handlePrevious}
                  aria-label="Previous song"
                >
                  <FaStepBackward />
                </button>

                <button
                  type="button"
                  className="sd2-playBtn"
                  onClick={handlePlayPause}
                  aria-label={isCurrentSong && isPlaying ? "Pause" : "Play"}
                >
                  {isCurrentSong && isPlaying ? <FaPause /> : <FaPlay />}
                  <span>{isCurrentSong && isPlaying ? "Pause" : "Play"}</span>
                </button>

                <button
                  type="button"
                  className="sd2-iconBtn"
                  onClick={handleNext}
                  aria-label="Next song"
                >
                  <FaStepForward />
                </button>

                <button
                  type="button"
                  className={`sd2-iconBtn ${repeat !== "off" ? "active" : ""}`}
                  onClick={cycleRepeat}
                  aria-label={getRepeatLabel(repeat)}
                >
                  {repeat === "off" ? <FaBan /> : <FaRedo />}
                  {repeat === "one" && <b>1</b>}
                </button>
              </div>

              <div className="sd2-seek">
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

                <div className="sd2-time">
                  <span>{formatTime(displayedProgress)}</span>
                  <span>{formatTime(displayedDuration)}</span>
                </div>
              </div>

              {hasTimedLyrics && (
                <button
                  type="button"
                  className="sd2-lyricPreview"
                  onClick={() => setShowLyrics(true)}
                >
                  <small>Now singing</small>
                  <span>{activeLyricText || "Waiting for vocals..."}</span>
                </button>
              )}
            </section>

            <div className="sd2-actions">
              <button
                type="button"
                className={`sd2-action ${liked ? "liked" : ""}`}
                onClick={handleToggleLike}
                disabled={likeLoading}
              >
                {liked ? <FaHeart /> : <FaRegHeart />}
                {likeLoading ? "Saving..." : liked ? "Liked" : "Like"}
              </button>

              <button
                type="button"
                className="sd2-action"
                onClick={() => setShowLyrics(true)}
              >
                <FaChevronDown />
                Lyrics
              </button>

              <button
                type="button"
                className="sd2-action"
                onClick={() => setShowEffectsModal(true)}
              >
                <FaMusic />
                Effects
              </button>

              <button
                type="button"
                className="sd2-action"
                onClick={() => setShowPlaylistBox((value) => !value)}
              >
                <FaPlus />
                Playlist
              </button>
            </div>

            {showPlaylistBox && (
              <div className="sd2-playlistBox">
                <h3>Add to Playlist</h3>

                {!token ? (
                  <p>Please login to use playlists.</p>
                ) : (
                  <>
                    <div className="sd2-playlistRow">
                      <select
                        value={selectedPlaylistId}
                        onChange={(e) => setSelectedPlaylistId(e.target.value)}
                      >
                        <option value="">Select playlist</option>

                        {playlists.map((playlist) => (
                          <option key={playlist._id} value={playlist._id}>
                            {playlist.name} ({playlist.songs?.length || 0} songs)
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
                      className="sd2-playlistRow"
                      onSubmit={createPlaylistAndAddSong}
                    >
                      <input
                        type="text"
                        placeholder="New playlist name"
                        value={newPlaylistName}
                        onChange={(e) => setNewPlaylistName(e.target.value)}
                      />

                      <button type="submit" disabled={playlistLoading}>
                        Create
                      </button>
                    </form>

                    {playlistMessage && <p>{playlistMessage}</p>}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>

    <section className="sd2-infoGrid">
      <article className="sd2-miniCard">
        <img src={getAlbumCover(song)} alt={song.album?.title || "Album"} />

        <div>
          <small>Album</small>
          <h2>{song.album?.title || "Unknown Album"}</h2>
          <p>Explore the sound behind this release.</p>

          {song.album?._id && (
            <button type="button" onClick={() => navigate(`/album/${song.album._id}`)}>
              View Album
            </button>
          )}
        </div>
      </article>

      <article className="sd2-miniCard">
        <img src={getArtistImage(song)} alt={song.artist?.name || "Artist"} />

        <div>
          <small>Artist</small>
          <h2>{song.artist?.name || "Unknown Artist"}</h2>
          <p>
            {song.artist?.country && song.artist.country !== "Unknown"
              ? `From ${song.artist.country}`
              : "The creator behind this premium track."}
          </p>
        </div>
      </article>
    </section>

    <section className="sd2-related">
      <div className="sd2-heading">
        <h2>Related Songs</h2>
        <p>Based on artist, country, and genre.</p>
      </div>

      {relatedSongs.length > 0 ? (
        <>
          <div className="sd2-relatedList">
            {visibleRelatedSongs.map((item, index) => {
              const active = currentSong?._id === item._id;
              const playingNow = active && isPlaying;

              return (
                <button
                  type="button"
                  key={item._id}
                  className={`sd2-relatedSong ${active ? "active" : ""}`}
                  onClick={() => handleRelatedSongClick(item)}
                >
                  <span className="sd2-number">
                    {playingNow ? <FaPause /> : index + 1}
                  </span>

                  <img src={getImage(item)} alt={item.title} />

                  <span className="sd2-relatedText">
                    <strong>{item.title}</strong>
                    <small>{item.artist?.name || "Unknown Artist"}</small>
                  </span>

                  <span className="sd2-duration">{formatTime(item.duration)}</span>
                </button>
              );
            })}
          </div>

          {hasMoreRelated && (
            <button
              type="button"
              className="sd2-more"
              onClick={() => setShowAllRelated((value) => !value)}
            >
              {showAllRelated ? "Show Less" : "View More Songs"}
            </button>
          )}
        </>
      ) : (
        <p className="sd2-empty">No related songs found.</p>
      )}
    </section>

    {showEffectsModal && (
      <div className="sd2-modalBack" onClick={() => setShowEffectsModal(false)}>
        <section className="sd2-modal" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            className="sd2-close"
            onClick={() => setShowEffectsModal(false)}
          >
            ×
          </button>

          <h2>Equalizer</h2>
          <p>Shape the sound with bass, reverb, and presence.</p>

          <label>
            Bass Boost <strong>{currentAudioEffects.bassBoost}</strong>
            <input
              type="range"
              min="-10"
              max="18"
              step="1"
              value={currentAudioEffects.bassBoost}
              onChange={(event) => updateAudioEffect("bassBoost", event.target.value)}
            />
          </label>

          <label>
            Reverb <strong>{currentAudioEffects.reverb}%</strong>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={currentAudioEffects.reverb}
              onChange={(event) => updateAudioEffect("reverb", event.target.value)}
            />
          </label>

          <label>
            Presence <strong>{currentAudioEffects.presence}</strong>
            <input
              type="range"
              min="-10"
              max="12"
              step="1"
              value={currentAudioEffects.presence}
              onChange={(event) => updateAudioEffect("presence", event.target.value)}
            />
          </label>

          <div className="sd2-presets">
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
          </div>
        </section>
      </div>
    )}

    {showLyrics && (
      <div className="sd2-modalBack" onClick={() => setShowLyrics(false)}>
        <section className="sd2-lyricsModal" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            className="sd2-close"
            onClick={() => setShowLyrics(false)}
          >
            ×
          </button>

          <h2>{song.title}</h2>
          <p>{song.artist?.name || "Unknown Artist"}</p>

          {hasTimedLyrics ? (
            <div ref={lyricsScrollRef} className="sd2-lyricsScroll">
              {timedLyrics.map((line, lineIndex) => (
                <p
                  key={`${line.start}-${line.text}-${lineIndex}`}
                  ref={(element) => {
                    if (element) lyricLineRefs.current[lineIndex] = element;
                  }}
                  className={lineIndex === activeLyricIndex ? "active" : ""}
                >
                  {line.text}
                </p>
              ))}
            </div>
          ) : lyrics ? (
            <pre className="sd2-plainLyrics">{lyrics}</pre>
          ) : (
            <p>Lyrics are not available for this song.</p>
          )}
        </section>
      </div>
    )}
  </main>
);
};

export default SongDetails;