import React, { useContext, useMemo } from "react";
import { FaPlay } from "react-icons/fa";
import { Link } from "react-router-dom";
import axios from "axios";
import { MusicPlayerContext } from "../../context/MainPlayerContext";
import { MusicContext } from "../../context/ShopContext";
import "./SongItem.css";

const normalizeSongs = (songs = []) => {
  const seen = new Set();

  return songs.filter((song) => {
    if (!song?._id || seen.has(song._id)) return false;

    seen.add(song._id);
    return true;
  });
};

const SongItem = ({ song, queue = [] }) => {
  const { playSong } = useContext(MusicPlayerContext);
  const { songs, backendUrl } = useContext(MusicContext);

  const songQueue = useMemo(() => {
    const sourceQueue = queue.length ? queue : songs;

    return normalizeSongs([
      song,
      ...sourceQueue.filter((item) => item?._id !== song?._id),
    ]);
  }, [queue, song, songs]);

  const addSongToHistory = async (songId) => {
    try {
      const token = localStorage.getItem("token");

      if (!token || !songId) return;

      await axios.post(
        `${backendUrl}/api/history/add`,
        {
          songId,
        },
        {
          headers: {
            token,
          },
        }
      );
    } catch (error) {
      console.log("Add to history error:", error);
    }
  };

  const handlePlaySong = async (e) => {
    e.preventDefault();

    if (!song?._id) return;

    playSong(song, songQueue);
    await addSongToHistory(song._id);
  };

  return (
    <div className="song-carder" onClick={handlePlaySong}>
      <Link
        to={`/song/${song._id}`}
        state={{
          playlist: songQueue,
        }}
        className="song-linker"
        onClick={handlePlaySong}
      >
        <div className="card-img-container">
          <img
            src={song.imageUrl || "/fallback-cover.png"}
            alt={song.title || "Song cover"}
            loading="lazy"
          />

          <div className="play-overlay">
            <FaPlay />
          </div>
        </div>

        <div className="card-content">
          <h4 className="card-title">{song.title || "Unknown Song"}</h4>

          <p className="card-artist">
            {song.artist?.name || "Unknown Artist"}
          </p>
        </div>
      </Link>
    </div>
  );
};

export default SongItem;