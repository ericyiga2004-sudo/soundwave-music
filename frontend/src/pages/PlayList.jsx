import React, { useContext, useMemo, useState } from "react";
import axios from "axios";
import {
  FaMusic,
  FaPlus,
  FaPlay,
  FaTrash,
  FaList,
} from "react-icons/fa";

import { MusicContext } from "../context/ShopContext";
import { MusicPlayerContext } from "../context/MainPlayerContext";
import "./CSS/PlayList.css";

const PlayList = () => {
  const {
    token,
    backendUrl,
    songs,
    playlists,
    fetchPlaylists,
  } = useContext(MusicContext);

  const { playSong } = useContext(MusicPlayerContext);

  const [playlistName, setPlaylistName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedPlaylist = useMemo(() => {
    return playlists.find((playlist) => playlist._id === selectedPlaylistId);
  }, [playlists, selectedPlaylistId]);

  const playlistSongs = useMemo(() => {
    return selectedPlaylist?.songs || [];
  }, [selectedPlaylist]);

  const availableSongs = useMemo(() => {
    if (!selectedPlaylist) return songs || [];

    const playlistSongIds = new Set(
      playlistSongs.map((song) => song._id)
    );

    return (songs || []).filter((song) => !playlistSongIds.has(song._id));
  }, [songs, selectedPlaylist, playlistSongs]);

  const createPlaylistHandler = async (e) => {
    e.preventDefault();

    if (!token) {
      alert("Please login first");
      return;
    }

    if (!playlistName.trim()) {
      alert("Playlist name is required");
      return;
    }

    try {
      setLoading(true);

      const res = await axios.post(
        `${backendUrl}/api/playlist/create`,
        {
          name: playlistName,
          description,
        },
        {
          headers: {
            token,
          },
        }
      );

      if (res.data.success) {
        setPlaylistName("");
        setDescription("");

        await fetchPlaylists();

        if (res.data.playlist?._id) {
          setSelectedPlaylistId(res.data.playlist._id);
        }
      } else {
        alert(res.data.message);
      }
    } catch (error) {
      console.log(error);
      alert("Could not create playlist");
    } finally {
      setLoading(false);
    }
  };

  const addSongToPlaylist = async (songId) => {
    if (!selectedPlaylistId) {
      alert("Select a playlist first");
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
            token,
          },
        }
      );

      if (res.data.success) {
        fetchPlaylists();
      } else {
        alert(res.data.message);
      }
    } catch (error) {
      console.log(error);
      alert("Could not add song");
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
            token,
          },
        }
      );

      if (res.data.success) {
        fetchPlaylists();
      } else {
        alert(res.data.message);
      }
    } catch (error) {
      console.log(error);
      alert("Could not remove song");
    }
  };

  const playPlaylist = () => {
    if (!playlistSongs.length) {
      alert("This playlist has no songs");
      return;
    }

    playSong(playlistSongs[0], playlistSongs);
  };

  const playPlaylistSong = (song) => {
    playSong(song, playlistSongs);
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

  const getArtistName = (song) => {
    if (typeof song?.artist === "string") return song.artist;

    return (
      song?.artist?.name ||
      song?.artist?.username ||
      song?.artistName ||
      "Unknown Artist"
    );
  };

  if (!token) {
    return (
      <main className="playlist-page">
        <div className="container-fluid px-2 px-sm-3 px-lg-4">
          <div className="playlist-login-card mx-auto">
            <FaMusic />
            <h2>Login Required</h2>
            <p>Please login to create and manage playlists.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="playlist-page">
      <div className="container-fluid px-2 px-sm-3 px-lg-4">
        <section className="playlist-hero row g-3 g-md-4 align-items-center mx-auto">
          <div className="col-12 col-lg">
            <span className="playlist-badge">Your Library</span>

            <h1>Create Your Playlists</h1>

            <p>
              Build your own music collections and play only the songs inside
              each playlist.
            </p>
          </div>

          <div className="col-12 col-lg-auto text-start text-lg-end">
            <button
              type="button"
              className="play-selected-btn"
              onClick={playPlaylist}
              disabled={!selectedPlaylist || playlistSongs.length === 0}
            >
              <FaPlay />
              Play Playlist
            </button>
          </div>
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

            <div className="user-playlists-card mt-3 mt-lg-4">
              <h2>Your Playlists</h2>

              {playlists && playlists.length > 0 ? (
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
                      onClick={() => setSelectedPlaylistId(playlist._id)}
                    >
                      <span>
                        <FaList />
                        {playlist.name}
                      </span>

                      <small>{playlist.songs?.length || 0} songs</small>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="playlist-empty-text">
                  No playlists yet. Create your first one.
                </p>
              )}
            </div>
          </aside>

          <section className="playlist-main col-12 col-lg-8 col-xl-9">
            {selectedPlaylist ? (
              <>
                <div className="selected-playlist-header row g-3 align-items-center">
                  <div className="col-12 col-md">
                    <h2>{selectedPlaylist.name}</h2>

                    <p>
                      {selectedPlaylist.description || "No description added."}
                    </p>

                    <span>{playlistSongs.length} songs in this playlist</span>
                  </div>

                  <div className="col-12 col-md-auto">
                    <button
                      type="button"
                      onClick={playPlaylist}
                      disabled={playlistSongs.length === 0}
                    >
                      <FaPlay />
                      Play All
                    </button>
                  </div>
                </div>

                <section className="playlist-songs-section">
                  <h3>Songs in Playlist</h3>

                  {playlistSongs.length > 0 ? (
                    <div className="playlist-song-list">
                      {playlistSongs.map((song, index) => (
                        <div
                          className="playlist-song-row"
                          key={song._id}
                        >
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
                  ) : (
                    <div className="empty-box">
                      <FaMusic />
                      <p>This playlist has no songs yet.</p>
                    </div>
                  )}
                </section>

                <section className="add-songs-section">
                  <h3>Add Songs</h3>

                  {availableSongs.length > 0 ? (
                    <div className="available-song-grid row g-3">
                      {availableSongs.map((song) => (
                        <div
                          className="available-song-col col-12 col-sm-6 col-xl-4"
                          key={song._id}
                        >
                          <div className="available-song-card">
                            <img src={getSongImage(song)} alt={song.title} />

                            <div className="available-song-info">
                              <h4>{song.title}</h4>
                              <p>{getArtistName(song)}</p>
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
                  ) : (
                    <div className="empty-box">
                      <FaMusic />
                      <p>No more songs available to add.</p>
                    </div>
                  )}
                </section>
              </>
            ) : (
              <div className="select-playlist-placeholder">
                <FaMusic />

                <h2>Select a Playlist</h2>

                <p>
                  Choose one of your playlists or create a new one to start
                  adding songs.
                </p>
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
};

export default PlayList;