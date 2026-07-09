import React, { useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  FaMusic,
  FaPlus,
  FaPlay,
  FaTrash,
  FaList,
  FaShareAlt,
  FaInbox,
  FaPaperPlane,
  FaTimes,
  FaUserPlus,
  FaSearch,
  FaFilter,
} from "react-icons/fa";

import { MusicContext } from "../context/ShopContext";
import { MusicPlayerContext } from "../context/MainPlayerContext";
import "./CSS/PlayList.css";

const MAX_PLAYLIST_SONGS = 50;
const SONGS_PER_PAGE = 24;

const isBadTokenValue = (value) => {
  if (!value) return true;

  const cleanValue = String(value).trim().toLowerCase();

  return (
    cleanValue === "" ||
    cleanValue === "false" ||
    cleanValue === "null" ||
    cleanValue === "undefined" ||
    cleanValue === "none" ||
    cleanValue === "nan"
  );
};

const normalizeText = (value = "") => {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const getArtistName = (song) => {
  if (typeof song?.artist === "string") return song.artist;

  return (
    song?.artist?.name ||
    song?.artist?.username ||
    song?.artistName ||
    "Unknown Artist"
  );
};

const getArtistId = (song) => {
  return (song?.artist?._id || song?.artist || song?.artistId || "").toString();
};

const getSongImage = (song) => {
  return (
    song?.imageUrl ||
    song?.image ||
    song?.coverImage ||
    song?.album?.imageUrl ||
    song?.album?.image ||
    "/fallback-cover.png"
  );
};

const getSongCountry = (song) => {
  return song?.country || song?.artist?.country || song?.album?.country || "";
};

const getSongLanguage = (song) => {
  return song?.songLanguage || song?.language || "";
};

const getAlbumTitle = (song) => {
  return song?.album?.title || song?.albumTitle || "";
};

const getPreferenceItems = (preferences = {}, key = "") => {
  return Array.isArray(preferences[key]) ? preferences[key] : [];
};

const getPreferenceName = (item, key = "name") => {
  if (!item) return "";

  if (key === "artist") {
    return (item?.artist?._id || item?.artist || "").toString();
  }

  if (key === "year") {
    return item?.year || "";
  }

  return item?.name || "";
};

const buildPreferenceScoreMap = (items = [], key = "name") => {
  const map = new Map();

  items.forEach((item, index) => {
    const rawValue = getPreferenceName(item, key);

    if (!rawValue) return;

    const value =
      key === "artist"
        ? rawValue.toString().toLowerCase()
        : normalizeText(rawValue);

    map.set(value, {
      score: Number(item.score || 0),
      rank: index,
    });
  });

  return map;
};

const getPreferenceScore = (map, value) => {
  if (!value) return 0;

  const item = map.get(normalizeText(value));

  return Number(item?.score || 0);
};

const getArtistPreferenceScore = (map, artistId) => {
  if (!artistId) return 0;

  const item = map.get(artistId.toString().toLowerCase());

  return Number(item?.score || 0);
};

const sortValuesByPreference = (values = [], preferenceItems = []) => {
  const scoreMap = buildPreferenceScoreMap(preferenceItems, "name");

  return [...values].sort((a, b) => {
    const scoreA = getPreferenceScore(scoreMap, a);
    const scoreB = getPreferenceScore(scoreMap, b);

    if (scoreB !== scoreA) return scoreB - scoreA;

    return String(a).localeCompare(String(b));
  });
};

const getSongSearchText = (song) => {
  return normalizeText(
    [
      song?.title,
      getArtistName(song),
      getAlbumTitle(song),
      song?.genre,
      song?.mood,
      getSongCountry(song),
      getSongLanguage(song),
      song?.releaseYear,
      ...(Array.isArray(song?.tags) ? song.tags : []),
    ]
      .filter(Boolean)
      .join(" ")
  );
};

const PlayList = () => {
  const {
    token,
    getAuthToken,
    backendUrl,
    songs = [],
    playlists = [],
    setPlaylists,
    fetchPlaylists,
    receivedPlaylistShares = [],
    fetchReceivedPlaylistShares,
  } = useContext(MusicContext);

  const { playSong } = useContext(MusicPlayerContext);

  const [playlistName, setPlaylistName] = useState("");
  const [description, setDescription] = useState("");

  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
  const [selectedShareId, setSelectedShareId] = useState("");

  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  const [shareQuery, setShareQuery] = useState("");
  const [shareUsers, setShareUsers] = useState([]);
  const [shareSearching, setShareSearching] = useState(false);
  const [shareSendingUserId, setShareSendingUserId] = useState("");
  const [shareMessage, setShareMessage] = useState("");

  const [preferences, setPreferences] = useState({});
  const [songSearch, setSongSearch] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("All");
  const [selectedGenre, setSelectedGenre] = useState("All");
  const [selectedMood, setSelectedMood] = useState("All");
  const [visibleSongCount, setVisibleSongCount] = useState(SONGS_PER_PAGE);

  const authToken = useMemo(() => {
    const cleanToken =
      getAuthToken?.() ||
      String(token || localStorage.getItem("token") || "").trim();

    return isBadTokenValue(cleanToken) ? "" : cleanToken;
  }, [token, getAuthToken]);

  const selectedPlaylist = useMemo(() => {
    return (playlists || []).find(
      (playlist) => playlist._id === selectedPlaylistId
    );
  }, [playlists, selectedPlaylistId]);

  const selectedShare = useMemo(() => {
    return (receivedPlaylistShares || []).find(
      (share) => share._id === selectedShareId
    );
  }, [receivedPlaylistShares, selectedShareId]);

  const selectedSharedPlaylist = selectedShare?.playlist || null;

  const playlistSongs = useMemo(() => {
    return selectedPlaylist?.songs || [];
  }, [selectedPlaylist]);

  const sharedPlaylistSongs = useMemo(() => {
    return selectedSharedPlaylist?.songs || [];
  }, [selectedSharedPlaylist]);

  const preferenceMaps = useMemo(() => {
    return {
      countries: buildPreferenceScoreMap(
        getPreferenceItems(preferences, "countries"),
        "name"
      ),
      genres: buildPreferenceScoreMap(
        getPreferenceItems(preferences, "genres"),
        "name"
      ),
      moods: buildPreferenceScoreMap(
        getPreferenceItems(preferences, "moods"),
        "name"
      ),
      languages: buildPreferenceScoreMap(
        getPreferenceItems(preferences, "languages"),
        "name"
      ),
      artists: buildPreferenceScoreMap(
        getPreferenceItems(preferences, "artists"),
        "artist"
      ),
      years: buildPreferenceScoreMap(
        getPreferenceItems(preferences, "years"),
        "year"
      ),
    };
  }, [preferences]);

  const availableSongs = useMemo(() => {
    if (!selectedPlaylist) return songs || [];

    const playlistSongIds = new Set(playlistSongs.map((song) => song._id));

    return (songs || []).filter((song) => !playlistSongIds.has(song._id));
  }, [songs, selectedPlaylist, playlistSongs]);

  const sortedAvailableSongs = useMemo(() => {
    return [...availableSongs]
      .filter((song) => song?.status !== "draft")
      .sort((a, b) => {
        const scoreSong = (song) => {
          const artistId = getArtistId(song);

          return (
            getArtistPreferenceScore(preferenceMaps.artists, artistId) * 700 +
            getPreferenceScore(preferenceMaps.countries, getSongCountry(song)) *
              500 +
            getPreferenceScore(preferenceMaps.genres, song?.genre) * 450 +
            getPreferenceScore(preferenceMaps.moods, song?.mood) * 320 +
            getPreferenceScore(
              preferenceMaps.languages,
              getSongLanguage(song)
            ) *
              180 +
            getPreferenceScore(preferenceMaps.years, song?.releaseYear) * 80 +
            Number(song?.recommendationScore || 0) * 20 +
            Number(song?.likes || 0) * 8 +
            Number(song?.plays || 0) * 2
          );
        };

        const scoreA = scoreSong(a);
        const scoreB = scoreSong(b);

        if (scoreB !== scoreA) return scoreB - scoreA;

        if (Number(b?.plays || 0) !== Number(a?.plays || 0)) {
          return Number(b?.plays || 0) - Number(a?.plays || 0);
        }

        return Number(b?.likes || 0) - Number(a?.likes || 0);
      });
  }, [availableSongs, preferenceMaps]);

  const filterOptions = useMemo(() => {
    const countries = [
      ...new Set(
        availableSongs
          .map((song) => getSongCountry(song))
          .filter(Boolean)
          .map((country) => country.trim())
      ),
    ];

    const genres = [
      ...new Set(
        availableSongs
          .map((song) => song?.genre)
          .filter(Boolean)
          .map((genre) => genre.trim())
      ),
    ];

    const moods = [
      ...new Set(
        availableSongs
          .map((song) => song?.mood)
          .filter(Boolean)
          .map((mood) => mood.trim())
      ),
    ];

    return {
      countries: [
        "All",
        ...sortValuesByPreference(
          countries,
          getPreferenceItems(preferences, "countries")
        ),
      ],
      genres: [
        "All",
        ...sortValuesByPreference(
          genres,
          getPreferenceItems(preferences, "genres")
        ),
      ],
      moods: [
        "All",
        ...sortValuesByPreference(
          moods,
          getPreferenceItems(preferences, "moods")
        ),
      ],
    };
  }, [availableSongs, preferences]);

  const filteredAvailableSongs = useMemo(() => {
    const search = normalizeText(songSearch);

    return sortedAvailableSongs.filter((song) => {
      const matchesCountry =
        selectedCountry === "All" ||
        normalizeText(getSongCountry(song)) === normalizeText(selectedCountry);

      const matchesGenre =
        selectedGenre === "All" ||
        normalizeText(song?.genre) === normalizeText(selectedGenre);

      const matchesMood =
        selectedMood === "All" ||
        normalizeText(song?.mood) === normalizeText(selectedMood);

      const matchesSearch = !search || getSongSearchText(song).includes(search);

      return matchesCountry && matchesGenre && matchesMood && matchesSearch;
    });
  }, [
    sortedAvailableSongs,
    songSearch,
    selectedCountry,
    selectedGenre,
    selectedMood,
  ]);

  const visibleAvailableSongs = useMemo(() => {
    return filteredAvailableSongs.slice(0, visibleSongCount);
  }, [filteredAvailableSongs, visibleSongCount]);

  const hasMoreSongs = filteredAvailableSongs.length > visibleSongCount;

  const hasOwnPlaylists = playlists && playlists.length > 0;
  const hasReceivedShares =
    receivedPlaylistShares && receivedPlaylistShares.length > 0;
  const hasSelectedContent = selectedPlaylist || selectedSharedPlaylist;

  useEffect(() => {
    if (!authToken || !backendUrl) {
      setPreferences({});
      return;
    }

    const fetchPreferences = async () => {
      try {
        const res = await axios.get(`${backendUrl}/api/recommend/preferences`, {
          headers: {
            token: authToken,
          },
        });

        if (res.data?.success) {
          setPreferences(res.data.preferences || {});
        } else {
          setPreferences({});
        }
      } catch (error) {
        console.log("Playlist preferences error:", error);
        setPreferences({});
      }
    };

    fetchPreferences();
  }, [authToken, backendUrl]);

  useEffect(() => {
    setVisibleSongCount(SONGS_PER_PAGE);
  }, [selectedPlaylistId, songSearch, selectedCountry, selectedGenre, selectedMood]);

  useEffect(() => {
    if (!selectedPlaylistId) return;

    const stillExists = (playlists || []).some(
      (playlist) => playlist._id === selectedPlaylistId
    );

    if (!stillExists) {
      setSelectedPlaylistId("");
    }
  }, [playlists, selectedPlaylistId]);

  useEffect(() => {
    if (!selectedShareId) return;

    const stillExists = (receivedPlaylistShares || []).some(
      (share) => share._id === selectedShareId
    );

    if (!stillExists) {
      setSelectedShareId("");
    }
  }, [receivedPlaylistShares, selectedShareId]);

  const showNotice = (message) => {
    setNotice(message);

    setTimeout(() => {
      setNotice("");
    }, 3000);
  };

  const resetSongFilters = () => {
    setSongSearch("");
    setSelectedCountry("All");
    setSelectedGenre("All");
    setSelectedMood("All");
    setVisibleSongCount(SONGS_PER_PAGE);
  };

  const selectOwnPlaylist = (playlistId) => {
    setSelectedPlaylistId(playlistId);
    setSelectedShareId("");
    setShareQuery("");
    setShareUsers([]);
    resetSongFilters();
  };

  const selectReceivedShare = async (shareId) => {
    setSelectedShareId(shareId);
    setSelectedPlaylistId("");
    setShareQuery("");
    setShareUsers([]);
    resetSongFilters();

    try {
      await axios.post(
        `${backendUrl}/api/playlist/share/${shareId}/read`,
        {},
        {
          headers: {
            token: authToken,
          },
        }
      );

      fetchReceivedPlaylistShares?.();
    } catch (error) {
      console.log("Mark shared playlist read error:", error);
    }
  };

  const updatePlaylistInState = (updatedPlaylist) => {
    if (!updatedPlaylist?._id) return;

    setPlaylists?.((prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];

      return safePrev.map((playlist) =>
        playlist._id === updatedPlaylist._id
          ? {
              ...playlist,
              ...updatedPlaylist,
              songs: updatedPlaylist.songs || [],
              sharesCount: updatedPlaylist.sharesCount || 0,
            }
          : playlist
      );
    });
  };

  const addSongLocally = (songId) => {
    const songToAdd = songs.find((song) => song._id === songId);

    if (!songToAdd) return;

    setPlaylists?.((prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];

      return safePrev.map((playlist) => {
        if (playlist._id !== selectedPlaylistId) return playlist;

        const currentSongs = playlist.songs || [];

        const alreadyExists = currentSongs.some(
          (song) => song._id === songId
        );

        if (alreadyExists) return playlist;

        return {
          ...playlist,
          songs: [...currentSongs, songToAdd],
        };
      });
    });
  };

  const removeSongLocally = (songId) => {
    setPlaylists?.((prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];

      return safePrev.map((playlist) => {
        if (playlist._id !== selectedPlaylistId) return playlist;

        return {
          ...playlist,
          songs: (playlist.songs || []).filter((song) => song._id !== songId),
        };
      });
    });
  };

  const createPlaylistHandler = async (e) => {
    e.preventDefault();

    if (!authToken) {
      alert("Please login first");
      return;
    }

    const cleanName = playlistName.trim();
    const cleanDescription = description.trim();

    if (!cleanName) {
      alert("Playlist name is required");
      return;
    }

    try {
      setLoading(true);

      const res = await axios.post(
        `${backendUrl}/api/playlist/create`,
        {
          name: cleanName,
          description: cleanDescription,
        },
        {
          headers: {
            token: authToken,
          },
        }
      );

      console.log("CREATE PLAYLIST RESPONSE:", res.data);

      if (res.data.success && res.data.playlist) {
        const createdPlaylist = {
          ...res.data.playlist,
          songs: res.data.playlist.songs || [],
          sharesCount: res.data.playlist.sharesCount || 0,
        };

        setPlaylistName("");
        setDescription("");

        setPlaylists?.((prev) => {
          const safePrev = Array.isArray(prev) ? prev : [];

          const alreadyExists = safePrev.some(
            (playlist) => playlist._id === createdPlaylist._id
          );

          if (alreadyExists) return safePrev;

          return [createdPlaylist, ...safePrev];
        });

        selectOwnPlaylist(createdPlaylist._id);

        const refreshedPlaylists = await fetchPlaylists?.();

        if (Array.isArray(refreshedPlaylists)) {
          const existsAfterRefresh = refreshedPlaylists.some(
            (playlist) => playlist._id === createdPlaylist._id
          );

          if (!existsAfterRefresh) {
            setPlaylists?.((prev) => {
              const safePrev = Array.isArray(prev) ? prev : [];

              const alreadyExists = safePrev.some(
                (playlist) => playlist._id === createdPlaylist._id
              );

              if (alreadyExists) return safePrev;

              return [createdPlaylist, ...safePrev];
            });
          }
        }

        showNotice("Playlist created.");
      } else {
        alert(res.data.message || "Could not create playlist");
      }
    } catch (error) {
      console.log("Create playlist error:", error);

      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Could not create playlist";

      alert(message);
    } finally {
      setLoading(false);
    }
  };

  const addSongToPlaylist = async (songId) => {
    if (!selectedPlaylistId) {
      alert("Select a playlist first");
      return;
    }

    if (playlistSongs.length >= MAX_PLAYLIST_SONGS) {
      alert(`Playlist can only contain ${MAX_PLAYLIST_SONGS} songs or less`);
      return;
    }

    try {
      const res = await axios.post(
        `${backendUrl}/api/playlist/add-song`,
        {
          playlistId: selectedPlaylistId,
          songId,
        },
        {
          headers: {
            token: authToken,
          },
        }
      );

      console.log("ADD SONG TO PLAYLIST RESPONSE:", res.data);

      if (res.data.success) {
        if (res.data.playlist) {
          updatePlaylistInState(res.data.playlist);
        } else {
          addSongLocally(songId);
        }

        const refreshedPlaylists = await fetchPlaylists?.();

        if (Array.isArray(refreshedPlaylists)) {
          const refreshedPlaylist = refreshedPlaylists.find(
            (playlist) => playlist._id === selectedPlaylistId
          );

          const songStillMissing = !refreshedPlaylist?.songs?.some(
            (song) => song._id === songId
          );

          if (songStillMissing) {
            addSongLocally(songId);
          }
        }

        showNotice("Song added to playlist.");
      } else {
        alert(res.data.message || "Could not add song");
      }
    } catch (error) {
      console.log("Add song error:", error);

      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Could not add song";

      alert(message);
    }
  };

  const removeSongFromPlaylist = async (songId) => {
    if (!selectedPlaylistId) return;

    try {
      const res = await axios.post(
        `${backendUrl}/api/playlist/remove-song`,
        {
          playlistId: selectedPlaylistId,
          songId,
        },
        {
          headers: {
            token: authToken,
          },
        }
      );

      console.log("REMOVE SONG FROM PLAYLIST RESPONSE:", res.data);

      if (res.data.success) {
        if (res.data.playlist) {
          updatePlaylistInState(res.data.playlist);
        } else {
          removeSongLocally(songId);
        }

        await fetchPlaylists?.();

        showNotice("Song removed from playlist.");
      } else {
        alert(res.data.message || "Could not remove song");
      }
    } catch (error) {
      console.log("Remove song error:", error);

      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Could not remove song";

      alert(message);
    }
  };

  const removeReceivedShare = async (shareId) => {
    try {
      const res = await axios.post(
        `${backendUrl}/api/playlist/share/${shareId}/remove`,
        {},
        {
          headers: {
            token: authToken,
          },
        }
      );

      if (res.data.success) {
        setSelectedShareId("");
        await fetchReceivedPlaylistShares?.();
        showNotice("Shared playlist removed.");
      } else {
        alert(res.data.message || "Could not remove shared playlist");
      }
    } catch (error) {
      console.log("Remove shared playlist error:", error);
      alert("Could not remove shared playlist");
    }
  };

  useEffect(() => {
    if (!authToken || !selectedPlaylist || shareQuery.trim().length < 2) {
      setShareUsers([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setShareSearching(true);

        const res = await axios.get(
          `${backendUrl}/api/playlist/share/users/search`,
          {
            params: {
              q: shareQuery,
            },
            headers: {
              token: authToken,
            },
          }
        );

        if (res.data.success) {
          setShareUsers(res.data.users || []);
        } else {
          setShareUsers([]);
        }
      } catch (error) {
        console.log("Search share users error:", error);
        setShareUsers([]);
      } finally {
        setShareSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [shareQuery, selectedPlaylistId, selectedPlaylist, authToken, backendUrl]);

  const sendPlaylistToUser = async (receiverId) => {
    if (!selectedPlaylist?._id) {
      alert("Select a playlist first");
      return;
    }

    if (!receiverId) return;

    try {
      setShareSendingUserId(receiverId);

      const res = await axios.post(
        `${backendUrl}/api/playlist/share/send`,
        {
          playlistId: selectedPlaylist._id,
          receiverId,
          message: shareMessage,
        },
        {
          headers: {
            token: authToken,
          },
        }
      );

      if (res.data.success) {
        setShareQuery("");
        setShareUsers([]);
        setShareMessage("");

        await fetchPlaylists?.();
        await fetchReceivedPlaylistShares?.();

        showNotice(res.data.message || "Playlist sent.");
      } else {
        alert(res.data.message || "Could not share playlist");
      }
    } catch (error) {
      console.log("Send playlist error:", error);
      alert("Could not share playlist");
    } finally {
      setShareSendingUserId("");
    }
  };

  const playOwnPlaylist = () => {
    if (!playlistSongs.length) {
      alert("This playlist has no songs");
      return;
    }

    playSong?.(playlistSongs[0], playlistSongs);
  };

  const playSharedPlaylist = () => {
    if (!sharedPlaylistSongs.length) {
      alert("This shared playlist has no songs");
      return;
    }

    playSong?.(sharedPlaylistSongs[0], sharedPlaylistSongs);
  };

  const playPlaylistSong = (song) => {
    playSong?.(song, playlistSongs);
  };

  const playSharedPlaylistSong = (song) => {
    playSong?.(song, sharedPlaylistSongs);
  };

  const getUserLabel = (user) => {
    return user?.username || user?.name || user?.maskedEmail || "SoundWave User";
  };

  if (!authToken) {
    return null;
  }

  return (
    <main className="playlist-page">
      <div className="container-fluid px-2 px-sm-3 px-lg-4">
        {notice && <div className="playlist-notice">{notice}</div>}

        <section className="playlist-hero row g-3 g-md-4 align-items-center mx-auto">
          <div className="col-12 col-lg">
            <span className="playlist-badge">Your Library</span>

            <h1>Create & Share Playlists</h1>

            <p>
              Build playlists under 50 songs and privately send them to users by
              username or email.
            </p>
          </div>

          {hasSelectedContent && (
            <div className="col-12 col-lg-auto text-start text-lg-end">
              <button
                type="button"
                className="play-selected-btn"
                onClick={
                  selectedSharedPlaylist ? playSharedPlaylist : playOwnPlaylist
                }
                disabled={
                  selectedSharedPlaylist
                    ? sharedPlaylistSongs.length === 0
                    : !selectedPlaylist || playlistSongs.length === 0
                }
              >
                <FaPlay />
                Play Playlist
              </button>
            </div>
          )}
        </section>

        <section className="playlist-layout row g-3 g-lg-4 mx-auto">
          <aside className="playlist-sidebar col-12 col-lg-4 col-xl-3">
            <div className="create-playlist-card">
              <h2>Create Playlist</h2>

              <form onSubmit={createPlaylistHandler}>
                <input
                  type="text"
                  placeholder="Playlist name"
                  value={playlistName}
                  onChange={(e) => setPlaylistName(e.target.value)}
                />

                <textarea
                  placeholder="Description optional"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />

                <button type="submit" disabled={loading}>
                  <FaPlus />
                  {loading ? "Creating..." : "Create"}
                </button>
              </form>
            </div>

            {hasOwnPlaylists && (
              <div className="user-playlists-card mt-3 mt-lg-4">
                <h2>Your Playlists</h2>

                <div className="playlist-list">
                  {playlists.map((playlist) => (
                    <button
                      type="button"
                      key={playlist._id}
                      className={
                        selectedPlaylistId === playlist._id
                          ? "playlist-tab active"
                          : "playlist-tab"
                      }
                      onClick={() => selectOwnPlaylist(playlist._id)}
                    >
                      <span>
                        <FaList />
                        {playlist.name}
                      </span>

                      <small>
                        {playlist.songs?.length || 0} songs •{" "}
                        {playlist.sharesCount || 0} shares
                      </small>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {hasReceivedShares && (
              <div className="user-playlists-card mt-3 mt-lg-4">
                <h2>
                  <FaInbox /> Shared With Me
                </h2>

                <div className="playlist-list">
                  {receivedPlaylistShares.map((share) => (
                    <button
                      type="button"
                      key={share._id}
                      className={
                        selectedShareId === share._id
                          ? "playlist-tab active"
                          : "playlist-tab"
                      }
                      onClick={() => selectReceivedShare(share._id)}
                    >
                      <span>
                        <FaShareAlt />
                        {share.playlist?.name || "Shared playlist"}
                      </span>

                      <small>
                        From {getUserLabel(share.fromUser)} •{" "}
                        {share.readAt ? "Read" : "New"}
                      </small>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>

          {hasSelectedContent && (
            <section className="playlist-main col-12 col-lg-8 col-xl-9">
              {selectedSharedPlaylist ? (
                <>
                  <div className="selected-playlist-header row g-3 align-items-center">
                    <div className="col-12 col-md">
                      <h2>{selectedSharedPlaylist.name}</h2>

                      <p>
                        {selectedSharedPlaylist.description ||
                          "No description added."}
                      </p>

                      <span>
                        Shared by {getUserLabel(selectedShare?.fromUser)} •{" "}
                        {sharedPlaylistSongs.length} songs
                      </span>

                      {selectedShare?.message && (
                        <p className="playlist-empty-text">
                          “{selectedShare.message}”
                        </p>
                      )}
                    </div>

                    <div className="col-12 col-md-auto">
                      <div className="playlist-header-actions">
                        <button
                          type="button"
                          onClick={playSharedPlaylist}
                          disabled={sharedPlaylistSongs.length === 0}
                        >
                          <FaPlay />
                          Play All
                        </button>

                        <button
                          type="button"
                          onClick={() => removeReceivedShare(selectedShare._id)}
                        >
                          <FaTimes />
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>

                  {sharedPlaylistSongs.length > 0 && (
                    <section className="playlist-songs-section">
                      <h3>Shared Playlist Songs</h3>

                      <div className="playlist-song-list">
                        {sharedPlaylistSongs.map((song, index) => (
                          <div className="playlist-song-row" key={song._id}>
                            <span className="song-number">{index + 1}</span>

                            <img src={getSongImage(song)} alt={song.title} />

                            <div className="playlist-song-info">
                              <h4>{song.title}</h4>
                              <p>{getArtistName(song)}</p>
                            </div>

                            <button
                              type="button"
                              className="song-play-btn"
                              onClick={() => playSharedPlaylistSong(song)}
                              aria-label="Play song"
                            >
                              <FaPlay />
                            </button>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              ) : (
                <>
                  <div className="selected-playlist-header row g-3 align-items-center">
                    <div className="col-12 col-md">
                      <h2>{selectedPlaylist.name}</h2>

                      <p>
                        {selectedPlaylist.description || "No description added."}
                      </p>

                      <span>
                        {playlistSongs.length}/{MAX_PLAYLIST_SONGS} songs in
                        this playlist
                      </span>
                    </div>

                    <div className="col-12 col-md-auto">
                      <button
                        type="button"
                        onClick={playOwnPlaylist}
                        disabled={playlistSongs.length === 0}
                      >
                        <FaPlay />
                        Play All
                      </button>
                    </div>
                  </div>

                  {playlistSongs.length > 0 && (
                    <section className="playlist-songs-section">
                      <h3>Songs in Playlist</h3>

                      <div className="playlist-song-list">
                        {playlistSongs.map((song, index) => (
                          <div className="playlist-song-row" key={song._id}>
                            <span className="song-number">{index + 1}</span>

                            <img src={getSongImage(song)} alt={song.title} />

                            <div className="playlist-song-info">
                              <h4>{song.title}</h4>
                              <p>{getArtistName(song)}</p>
                            </div>

                            <button
                              type="button"
                              className="song-play-btn"
                              onClick={() => playPlaylistSong(song)}
                              aria-label="Play song"
                            >
                              <FaPlay />
                            </button>

                            <button
                              type="button"
                              className="song-remove-btn"
                              onClick={() => removeSongFromPlaylist(song._id)}
                              aria-label="Remove song"
                            >
                              <FaTrash />
                            </button>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {playlistSongs.length > 0 && (
                    <section className="playlist-songs-section">
                      <h3>
                        <FaPaperPlane /> Share This Playlist
                      </h3>

                      <div className="create-playlist-card">
                        <input
                          type="text"
                          placeholder="Search username or email..."
                          value={shareQuery}
                          onChange={(e) => setShareQuery(e.target.value)}
                        />

                        <textarea
                          placeholder="Optional message"
                          value={shareMessage}
                          onChange={(e) => setShareMessage(e.target.value)}
                        />

                        {shareSearching && (
                          <p className="playlist-empty-text">
                            Searching users...
                          </p>
                        )}

                        {shareQuery.trim().length > 0 &&
                          shareQuery.trim().length < 2 && (
                            <p className="playlist-empty-text">
                              Type at least 2 characters.
                            </p>
                          )}

                        {shareUsers.length > 0 && (
                          <div className="playlist-list">
                            {shareUsers.map((user) => (
                              <button
                                type="button"
                                key={user._id}
                                className="playlist-tab"
                                onClick={() => sendPlaylistToUser(user._id)}
                                disabled={shareSendingUserId === user._id}
                              >
                                <span>
                                  <FaUserPlus />
                                  {user.username ||
                                    user.name ||
                                    "SoundWave User"}
                                </span>

                                <small>
                                  {shareSendingUserId === user._id
                                    ? "Sending..."
                                    : user.maskedEmail || "Send playlist"}
                                </small>
                              </button>
                            ))}
                          </div>
                        )}

                        {shareQuery.trim().length >= 2 &&
                          !shareSearching &&
                          shareUsers.length === 0 && (
                            <p className="playlist-empty-text">
                              No matching user found.
                            </p>
                          )}
                      </div>
                    </section>
                  )}

                  {playlistSongs.length < MAX_PLAYLIST_SONGS &&
                    availableSongs.length > 0 && (
                      <section className="add-songs-section">
                        <div className="d-flex flex-column flex-xl-row justify-content-between gap-3 mb-3">
                          <div>
                            <h3 className="mb-1">Add Songs</h3>
                            <p className="playlist-empty-text mb-0">
                              Songs are ranked by your country, genre, mood,
                              language, artist, likes, and plays.
                            </p>
                          </div>

                          <div className="playlist-empty-text">
                            Showing {visibleAvailableSongs.length} of{" "}
                            {filteredAvailableSongs.length}
                          </div>
                        </div>

                        <div className="row g-2 g-md-3 mb-3">
                          <div className="col-12 col-lg-6">
                            <div className="position-relative">
                              <FaSearch
                                style={{
                                  position: "absolute",
                                  left: "14px",
                                  top: "50%",
                                  transform: "translateY(-50%)",
                                  opacity: 0.6,
                                  pointerEvents: "none",
                                }}
                              />

                              <input
                                type="text"
                                placeholder="Search songs, artists, genre, mood..."
                                value={songSearch}
                                onChange={(e) => setSongSearch(e.target.value)}
                                style={{ paddingLeft: "42px" }}
                              />
                            </div>
                          </div>

                          <div className="col-12 col-sm-4 col-lg-2">
                            <select
                              value={selectedCountry}
                              onChange={(e) => setSelectedCountry(e.target.value)}
                            >
                              {filterOptions.countries.map((country) => (
                                <option key={country} value={country}>
                                  {country === "All" ? "All Countries" : country}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="col-12 col-sm-4 col-lg-2">
                            <select
                              value={selectedGenre}
                              onChange={(e) => setSelectedGenre(e.target.value)}
                            >
                              {filterOptions.genres.map((genre) => (
                                <option key={genre} value={genre}>
                                  {genre === "All" ? "All Genres" : genre}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="col-12 col-sm-4 col-lg-2">
                            <select
                              value={selectedMood}
                              onChange={(e) => setSelectedMood(e.target.value)}
                            >
                              {filterOptions.moods.map((mood) => (
                                <option key={mood} value={mood}>
                                  {mood === "All" ? "All Moods" : mood}
                                </option>
                              ))}
                            </select>
                          </div>

                          {(songSearch ||
                            selectedCountry !== "All" ||
                            selectedGenre !== "All" ||
                            selectedMood !== "All") && (
                            <div className="col-12">
                              <button
                                type="button"
                                className="playlist-tab"
                                onClick={resetSongFilters}
                              >
                                <span>
                                  <FaFilter />
                                  Clear song filters
                                </span>
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="available-song-grid row g-3">
                          {visibleAvailableSongs.map((song) => (
                            <div
                              className="available-song-col col-12 col-sm-6 col-xl-4"
                              key={song._id}
                            >
                              <div className="available-song-card">
                                <img src={getSongImage(song)} alt={song.title} />

                                <div className="available-song-info">
                                  <h4>{song.title}</h4>

                                  <p>
                                    {getArtistName(song)}
                                    {song.genre ? ` • ${song.genre}` : ""}
                                  </p>

                                  <small className="playlist-empty-text">
                                    {getSongCountry(song) || "Unknown country"}
                                    {song.mood ? ` • ${song.mood}` : ""}
                                  </small>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => addSongToPlaylist(song._id)}
                                  aria-label="Add song"
                                >
                                  <FaPlus />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {hasMoreSongs && (
                          <div className="text-center mt-4">
                            <button
                              type="button"
                              className="play-selected-btn"
                              onClick={() =>
                                setVisibleSongCount((prev) => prev + SONGS_PER_PAGE)
                              }
                            >
                              <FaPlus />
                              Show More Songs
                            </button>
                          </div>
                        )}
                      </section>
                    )}
                </>
              )}
            </section>
          )}
        </section>
      </div>
    </main>
  );
};

export default PlayList;