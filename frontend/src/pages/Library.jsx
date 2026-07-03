import React, {
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import axios from "axios";
import { Link } from "react-router-dom";

import {
  FaSearch,
  FaHeart,
  FaHistory,
  FaMusic,
  FaCompactDisc,
  FaHeadphones,
  FaArrowRight,
  FaPlay,
  FaListUl,
  FaClock,
} from "react-icons/fa";

import { MusicContext } from "../context/ShopContext";
import { MusicPlayerContext } from "../context/MainPlayerContext";

import "./CSS/Library.css";

const Library = () => {
  const {
    backendUrl,
    token,
    playlists,
    fetchPlaylists,
  } = useContext(MusicContext);

  const { playSong } = useContext(MusicPlayerContext);

  const [historySongs, setHistorySongs] = useState([]);
  const [likedSongs, setLikedSongs] = useState([]);

  const [activeCategory, setActiveCategory] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingLikes, setLoadingLikes] = useState(false);

  const [error, setError] = useState("");

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

  const getArtistName = (song) => {
    if (!song?.artist) {
      return "Unknown Artist";
    }

    if (typeof song.artist === "string") {
      return song.artist;
    }

    return (
      song.artist.name ||
      song.artist.artistName ||
      "Unknown Artist"
    );
  };

  const getSongTitle = (song) => {
    return (
      song?.title ||
      song?.name ||
      "Untitled Song"
    );
  };

  const normalizeHistorySongs = (items = []) => {
    return items
      .map((item) => {
        if (item?.song) {
          return {
            ...item.song,
            playedAt: item.playedAt,
          };
        }

        return item;
      })
      .filter((song) => song?._id);
  };

  const removeDuplicateSongs = (songs = []) => {
    const seen = new Set();

    return songs.filter((song) => {
      if (!song?._id || seen.has(song._id)) {
        return false;
      }

      seen.add(song._id);
      return true;
    });
  };

  const fetchHistorySongs = async () => {
    try {
      if (!token) {
        setHistorySongs([]);
        return;
      }

      setLoadingHistory(true);

      const res = await axios.get(
        `${backendUrl}/api/history/get`,
        {
          headers: {
            token,
          },
        }
      );

      if (res.data?.success) {
        setHistorySongs(res.data.history || []);
      } else {
        setHistorySongs([]);
      }
    } catch (error) {
      console.log("Fetch history error:", error);
      setHistorySongs([]);
      setError("Failed to load listening history.");
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchLikedSongs = async () => {
    try {
      if (!token) {
        setLikedSongs([]);
        return;
      }

      setLoadingLikes(true);

      const res = await axios.get(
        `${backendUrl}/api/likes/songs`,
        {
          headers: {
            token,
          },
        }
      );

      if (res.data?.success) {
        setLikedSongs(res.data.likedSongs || []);
      } else {
        setLikedSongs([]);
      }
    } catch (error) {
      console.log("Fetch liked songs error:", error);
      setLikedSongs([]);
      setError("Failed to load liked songs.");
    } finally {
      setLoadingLikes(false);
    }
  };

  useEffect(() => {
    fetchHistorySongs();
    fetchLikedSongs();

    if (fetchPlaylists) {
      fetchPlaylists();
    }
  }, [token]);

  const normalizedHistorySongs = useMemo(() => {
    return normalizeHistorySongs(historySongs);
  }, [historySongs]);

  const allLibrarySongs = useMemo(() => {
    return removeDuplicateSongs([
      ...likedSongs,
      ...normalizedHistorySongs,
    ]);
  }, [likedSongs, normalizedHistorySongs]);

  const filteredLikedSongs = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();

    return likedSongs.filter((song) => {
      const title = getSongTitle(song).toLowerCase();
      const artist = getArtistName(song).toLowerCase();

      return (
        title.includes(search) ||
        artist.includes(search)
      );
    });
  }, [likedSongs, searchTerm]);

  const filteredHistorySongs = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();

    return normalizedHistorySongs.filter((song) => {
      const title = getSongTitle(song).toLowerCase();
      const artist = getArtistName(song).toLowerCase();

      return (
        title.includes(search) ||
        artist.includes(search)
      );
    });
  }, [normalizedHistorySongs, searchTerm]);

  const filteredPlaylists = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();

    return (playlists || []).filter((playlist) => {
      const name = (
        playlist?.name ||
        playlist?.title ||
        "Untitled Playlist"
      ).toLowerCase();

      return name.includes(search);
    });
  }, [playlists, searchTerm]);

  const handlePlaySong = async (song, queueSource = []) => {
    if (!song?._id) {
      return;
    }

    const queue = removeDuplicateSongs([
      song,
      ...queueSource.filter((item) => item?._id !== song._id),
    ]);

    playSong(song, queue);

    try {
      await axios.patch(
        `${backendUrl}/api/songs/${song._id}/play`
      );
    } catch (error) {
      console.log("Increment plays error:", error);
    }

    try {
      if (token) {
        await axios.post(
          `${backendUrl}/api/history/add`,
          {
            songId: song._id,
          },
          {
            headers: {
              token,
            },
          }
        );

        fetchHistorySongs();
      }
    } catch (error) {
      console.log("Add history error:", error);
    }
  };

  const showLikedSection =
    activeCategory === "All" ||
    activeCategory === "Liked Songs";

  const showHistorySection =
    activeCategory === "All" ||
    activeCategory === "History";

  const showPlaylistSection =
    activeCategory === "All" ||
    activeCategory === "Playlists";

  return (
    <div className="container-fluid library-page">
      {/* Header */}

      <div className="library-header d-flex justify-content-between align-items-center flex-wrap">
        <div>
          <span className="library-small-label">
            My music space
          </span>

          <h1>Your Library</h1>

          <p>
            Your liked songs, playlists, history, and DJ music in one place.
          </p>
        </div>

        <Link
          to="/dj"
          className="library-create-btn text-decoration-none"
        >
          <FaHeadphones />
          Open DJ Essentails
        </Link>

        <Link
          to="/studio"
          className="library-create-btn text-decoration-none"
        >
          <FaHeadphones />
          Open Studio
        </Link>
      </div>

      {/* Search */}

      <div className="library-search">
        <FaSearch />

        <input
          type="text"
          placeholder="Search songs, artists, or playlists..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Categories */}

      <div className="library-categories">
        {[
          "All",
          "Playlists",
          "Liked Songs",
          "History",
        ].map((category) => (
          <button
            key={category}
            className={
              activeCategory === category
                ? "active"
                : ""
            }
            onClick={() => setActiveCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>

      {error && (
        <div className="library-error">
          {error}
        </div>
      )}

      {!token && (
        <div className="library-login-box">
          <h3>Sign in to unlock your library</h3>

          <p>
            Your liked songs, listening history, playlists, and future DJ mixes will appear here.
          </p>
        </div>
      )}

      {/* Friendly Cards */}

      

      {/* Recently Played */}

      {showHistorySection && (
        <div className="library-section">
          <div className="section-title">
            <FaHistory />
            Recently Played
          </div>

          {loadingHistory ? (
            <div className="empty-box">
              Loading your recent songs...
            </div>
          ) : filteredHistorySongs.length === 0 ? (
            <div className="empty-box">
              No recently played songs yet.
            </div>
          ) : (
            <div className="library-list">
              {filteredHistorySongs
                .slice(0, 12)
                .map((song) => (
                  <div
                    key={song._id}
                    className="library-song"
                    onClick={() =>
                      handlePlaySong(
                        song,
                        filteredHistorySongs
                      )
                    }
                  >
                    <img
                      src={getSongImage(song)}
                      alt={getSongTitle(song)}
                      onError={(e) => {
                        e.currentTarget.src =
                          "/fallback-cover.png";
                      }}
                    />

                    <div className="library-song-info">
                      <h5>{getSongTitle(song)}</h5>

                      <p>{getArtistName(song)}</p>
                    </div>

                    <div className="library-song-meta">
                      <FaClock />

                      <span>Recent</span>
                    </div>

                    <button
                      type="button"
                      className="library-play-btn"
                      onClick={(e) => {
                        e.stopPropagation();

                        handlePlaySong(
                          song,
                          filteredHistorySongs
                        );
                      }}
                    >
                      <FaPlay />
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Liked Songs */}

      {showLikedSection && (
        <div className="library-section">
          <div className="section-title">
            <FaHeart />
            Liked Songs
          </div>

          {loadingLikes ? (
            <div className="empty-box">
              Loading your liked songs...
            </div>
          ) : filteredLikedSongs.length === 0 ? (
            <div className="empty-box">
              You have not liked any songs yet.
            </div>
          ) : (
            <div className="library-list">
              {filteredLikedSongs
                .slice(0, 12)
                .map((song) => (
                  <div
                    key={song._id}
                    className="library-song"
                    onClick={() =>
                      handlePlaySong(
                        song,
                        filteredLikedSongs
                      )
                    }
                  >
                    <img
                      src={getSongImage(song)}
                      alt={getSongTitle(song)}
                      onError={(e) => {
                        e.currentTarget.src =
                          "/fallback-cover.png";
                      }}
                    />

                    <div className="library-song-info">
                      <h5>{getSongTitle(song)}</h5>

                      <p>{getArtistName(song)}</p>
                    </div>

                    <div className="library-song-meta liked">
                      <FaHeart />

                      <span>Liked</span>
                    </div>

                    <button
                      type="button"
                      className="library-play-btn"
                      onClick={(e) => {
                        e.stopPropagation();

                        handlePlaySong(
                          song,
                          filteredLikedSongs
                        );
                      }}
                    >
                      <FaPlay />
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Playlists */}

      {showPlaylistSection && (
        <div className="library-section">
          <div className="section-title">
            <FaMusic />
            Your Playlists
          </div>

          {filteredPlaylists.length === 0 ? (
            <div className="empty-box">
              No playlists created yet.
            </div>
          ) : (
            <div className="library-list">
              {filteredPlaylists.map((playlist) => (
                <Link
                  key={playlist._id}
                  to={`/playlist/${playlist._id}`}
                  className="library-song playlist-link"
                >
                  <img
                    src={
                      playlist.coverImage ||
                      playlist.image ||
                      playlist.songs?.[0]?.imageUrl ||
                      playlist.songs?.[0]?.image ||
                      "/playlist.png"
                    }
                    alt={
                      playlist.name ||
                      playlist.title ||
                      "Playlist"
                    }
                    onError={(e) => {
                      e.currentTarget.src =
                        "/playlist.png";
                    }}
                  />

                  <div className="library-song-info">
                    <h5>
                      {playlist.name ||
                        playlist.title ||
                        "Untitled Playlist"}
                    </h5>

                    <p>Playlist</p>
                  </div>

                  <div className="library-song-meta">
                    <FaListUl />

                    <span>Open</span>
                  </div>

                  <FaArrowRight className="library-row-arrow" />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DJ */}

      <div className="dj-banner">
        <div>
          <h2>
            <FaHeadphones />
            DJ Essentials
          </h2>

          <p>
            Load your own songs, mix with two decks, scratch, trigger sound pads,
            and create your own DJ vibe.
          </p>
        </div>

        <Link to="/dj">
          <button>
            Open DJ Studio
            <FaArrowRight />
          </button>
        </Link>
      </div>
    </div>
  );
};

export default Library;