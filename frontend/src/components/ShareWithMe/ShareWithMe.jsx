import React, { useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  FaInbox,
  FaMusic,
  FaPlay,
  FaTimes,
  FaUser,
  FaClock,
  FaHeadphones,
  FaSearch,
  FaSyncAlt,
  FaCheckCircle,
  FaChevronDown,
} from "react-icons/fa";

import { MusicContext } from "../../context/ShopContext";
import { MusicPlayerContext } from "../../context/MainPlayerContext";
import "./ShareWithMe.css";

const PLAYLISTS_PER_PAGE = 6;

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

const ShareWithMe = () => {
  const {
    token,
    getAuthToken,
    backendUrl,
    receivedPlaylistShares = [],
    setReceivedPlaylistShares,
    fetchReceivedPlaylistShares,
  } = useContext(MusicContext);

  const { playSong } = useContext(MusicPlayerContext);

  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PLAYLISTS_PER_PAGE);

  const authToken = useMemo(() => {
    const cleanToken =
      getAuthToken?.() ||
      String(token || localStorage.getItem("token") || "").trim();

    return isBadTokenValue(cleanToken) ? "" : cleanToken;
  }, [token, getAuthToken]);

  const shares = useMemo(() => {
    return Array.isArray(receivedPlaylistShares)
      ? receivedPlaylistShares.filter((share) => share?.playlist)
      : [];
  }, [receivedPlaylistShares]);

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

  const getArtistName = (song) => {
    if (typeof song?.artist === "string") return song.artist;

    return (
      song?.artist?.name ||
      song?.artist?.username ||
      song?.artistName ||
      "Unknown Artist"
    );
  };

  const getSenderName = (share) => {
    return (
      share?.fromUser?.username ||
      share?.fromUser?.name ||
      share?.fromUser?.maskedEmail ||
      "SoundWave User"
    );
  };

  const getPlaylistCoverImages = (playlist) => {
    const songs = playlist?.songs || [];

    return songs.slice(0, 4).map((song) => getSongImage(song));
  };

  const formatDate = (date) => {
    if (!date) return "Recently";

    const value = new Date(date);

    if (Number.isNaN(value.getTime())) return "Recently";

    return value.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const filteredShares = useMemo(() => {
    const search = normalizeText(searchQuery);

    return [...shares]
      .filter((share) => {
        if (!search) return true;

        const playlist = share.playlist;
        const songs = playlist?.songs || [];

        const searchableText = normalizeText(
          [
            playlist?.name,
            playlist?.description,
            share?.message,
            getSenderName(share),
            ...songs.map((song) => song?.title),
            ...songs.map((song) => getArtistName(song)),
          ]
            .filter(Boolean)
            .join(" ")
        );

        return searchableText.includes(search);
      })
      .sort((a, b) => {
        const unreadA = !a.readAt ? 1 : 0;
        const unreadB = !b.readAt ? 1 : 0;

        if (unreadB !== unreadA) return unreadB - unreadA;

        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
  }, [shares, searchQuery]);

  const visibleShares = useMemo(() => {
    return filteredShares.slice(0, visibleCount);
  }, [filteredShares, visibleCount]);

  const hasMore = filteredShares.length > visibleCount;

  useEffect(() => {
    setVisibleCount(PLAYLISTS_PER_PAGE);
  }, [searchQuery]);

  const showNotice = (message) => {
    setNotice(message);

    setTimeout(() => {
      setNotice("");
    }, 3000);
  };

  const fetchShares = async () => {
    if (!authToken) {
      setReceivedPlaylistShares?.([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      if (fetchReceivedPlaylistShares) {
        await fetchReceivedPlaylistShares();
        return;
      }

      const res = await axios.get(`${backendUrl}/api/playlist/share/received`, {
        headers: {
          token: authToken,
        },
      });

      if (res.data.success) {
        setReceivedPlaylistShares?.(res.data.shares || []);
      } else {
        setReceivedPlaylistShares?.([]);
      }
    } catch (error) {
      console.log("Fetch shared playlists error:", error);
      setReceivedPlaylistShares?.([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShares();
  }, [authToken]);

  const markAsRead = async (shareId) => {
    if (!shareId || !authToken) return;

    try {
      const res = await axios.post(
        `${backendUrl}/api/playlist/share/${shareId}/read`,
        {},
        {
          headers: {
            token: authToken,
          },
        }
      );

      if (res.data.success) {
        setReceivedPlaylistShares?.((prev) => {
          const safePrev = Array.isArray(prev) ? prev : [];

          return safePrev.map((share) =>
            share._id === shareId
              ? {
                  ...share,
                  readAt: share.readAt || new Date().toISOString(),
                }
              : share
          );
        });
      }
    } catch (error) {
      console.log("Mark shared playlist read error:", error);
    }
  };

  const removeShare = async (shareId) => {
    if (!shareId || !authToken) return;

    const confirmRemove = window.confirm(
      "Remove this shared playlist from your page?"
    );

    if (!confirmRemove) return;

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
        setReceivedPlaylistShares?.((prev) => {
          const safePrev = Array.isArray(prev) ? prev : [];

          return safePrev.filter((share) => share._id !== shareId);
        });

        showNotice("Shared playlist removed.");
      } else {
        alert(res.data.message || "Could not remove shared playlist");
      }
    } catch (error) {
      console.log("Remove shared playlist error:", error);
      alert("Could not remove shared playlist");
    }
  };

  const playSharedPlaylist = async (share) => {
    const playlistSongs = share?.playlist?.songs || [];

    if (!playlistSongs.length) {
      alert("This shared playlist has no songs.");
      return;
    }

    await markAsRead(share._id);

    playSong?.(playlistSongs[0], playlistSongs);
  };

  const playSharedSong = async (share, song) => {
    const playlistSongs = share?.playlist?.songs || [];

    if (!song?._id) return;

    await markAsRead(share._id);

    playSong?.(song, playlistSongs);
  };

  if (!authToken) {
    return null;
  }

  if (shares.length === 0) {
    return null;
  }

  return (
    <main className="playlist-page shared-page">
      <div className="container-fluid px-2 px-sm-3 px-lg-4">
        {notice && <div className="playlist-notice">{notice}</div>}

        <section className="playlist-hero shared-hero row g-3 g-md-4 align-items-center mx-auto">
          <div className="col-12 col-lg">
            <span className="playlist-badge">
              <FaInbox />
              Shared With Me
            </span>

            <h1>Playlists Sent To You</h1>

            <p>
              All playlists shared with you appear as full playlist cards. Play
              the whole playlist or choose a song inside it.
            </p>
          </div>

          <div className="col-12 col-lg-auto">
            <button
              type="button"
              className="play-selected-btn w-100"
              onClick={fetchShares}
              disabled={loading}
            >
              <FaSyncAlt />
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </section>

        {(shares.length > 0 || searchQuery) && (
          <section className="shared-toolbar mx-auto">
            <div className="row g-3 align-items-center">
              <div className="col-12 col-lg">
                <div className="shared-search-wrap">
                  <FaSearch />

                  <input
                    type="text"
                    placeholder="Search playlist, sender, artist, or song..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="col-12 col-lg-auto">
                <div className="shared-count-pill">
                  {filteredShares.length}{" "}
                  {filteredShares.length === 1 ? "playlist" : "playlists"}
                </div>
              </div>
            </div>
          </section>
        )}

        {filteredShares.length > 0 && (
          <>
            <section className="playlist-layout shared-grid row g-3 g-lg-4 mx-auto">
              {visibleShares.map((share) => {
                const playlist = share.playlist;
                const playlistSongs = playlist?.songs || [];
                const coverImages = getPlaylistCoverImages(playlist);
                const unread = !share.readAt;
                const previewSongs = playlistSongs.slice(0, 8);

                return (
                  <div className="col-12" key={share._id}>
                    <article
                      className={`shared-playlist-full-card ${
                        unread ? "unread" : ""
                      }`}
                    >
                      <div className="row g-0">
                        <div className="col-12 col-md-4 col-xl-3">
                          <div className="shared-playlist-cover h-100">
                            {coverImages.length > 0 ? (
                              coverImages.map((image, index) => (
                                <img
                                  src={image}
                                  alt={playlist.name || "Shared playlist"}
                                  key={`${playlist._id}-${index}`}
                                />
                              ))
                            ) : (
                              <div className="shared-playlist-empty-cover">
                                <FaMusic />
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="col-12 col-md-8 col-xl-9">
                          <div className="shared-playlist-body">
                            <div className="shared-playlist-top">
                              <div className="min-w-0">
                                <span className="playlist-badge">
                                  {unread ? "New Playlist" : "Shared Playlist"}
                                </span>

                                <h2>{playlist.name || "Untitled Playlist"}</h2>

                                {playlist.description && (
                                  <p>{playlist.description}</p>
                                )}
                              </div>

                              <button
                                type="button"
                                className="song-remove-btn"
                                onClick={() => removeShare(share._id)}
                                aria-label="Remove shared playlist"
                              >
                                <FaTimes />
                              </button>
                            </div>

                            <div className="shared-playlist-meta">
                              <span>
                                <FaUser />
                                From {getSenderName(share)}
                              </span>

                              <span>
                                <FaHeadphones />
                                {playlistSongs.length}{" "}
                                {playlistSongs.length === 1 ? "song" : "songs"}
                              </span>

                              <span>
                                <FaClock />
                                {formatDate(share.createdAt)}
                              </span>

                              {share.readAt && (
                                <span>
                                  <FaCheckCircle />
                                  Read
                                </span>
                              )}
                            </div>

                            {share.message && (
                              <div className="shared-playlist-message">
                                “{share.message}”
                              </div>
                            )}

                            <div className="shared-playlist-actions">
                              <button
                                type="button"
                                className="play-selected-btn"
                                onClick={() => playSharedPlaylist(share)}
                                disabled={playlistSongs.length === 0}
                              >
                                <FaPlay />
                                Play Full Playlist
                              </button>

                              {unread && (
                                <button
                                  type="button"
                                  className="shared-secondary-btn"
                                  onClick={() => markAsRead(share._id)}
                                >
                                  <FaCheckCircle />
                                  Mark Read
                                </button>
                              )}
                            </div>

                            {previewSongs.length > 0 && (
                              <div className="shared-playlist-song-preview">
                                {previewSongs.map((song, index) => (
                                  <button
                                    type="button"
                                    className="playlist-song-row"
                                    key={song._id}
                                    onClick={() => playSharedSong(share, song)}
                                  >
                                    <span className="song-number">
                                      {index + 1}
                                    </span>

                                    <img
                                      src={getSongImage(song)}
                                      alt={song.title}
                                    />

                                    <div className="playlist-song-info">
                                      <h4>{song.title || "Unknown Song"}</h4>
                                      <p>{getArtistName(song)}</p>
                                    </div>

                                    <span className="song-play-btn">
                                      <FaPlay />
                                    </span>
                                  </button>
                                ))}

                                {playlistSongs.length > previewSongs.length && (
                                  <div className="playlist-empty-text">
                                    +{playlistSongs.length - previewSongs.length}{" "}
                                    more songs in this playlist
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  </div>
                );
              })}
            </section>

            {hasMore && (
              <div className="text-center mt-4">
                <button
                  type="button"
                  className="play-selected-btn"
                  onClick={() =>
                    setVisibleCount((prev) => prev + PLAYLISTS_PER_PAGE)
                  }
                >
                  <FaChevronDown />
                  Show More Playlists
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
};

export default ShareWithMe;