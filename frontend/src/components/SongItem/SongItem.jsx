import React, { useContext, useMemo } from "react";
import { FaPlay } from "react-icons/fa";
import { Link } from "react-router-dom";
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
  const { songs } = useContext(MusicContext);

  const songQueue = useMemo(() => {
    const sourceQueue = queue.length ? queue : songs;

    return normalizeSongs([
      song,
      ...sourceQueue.filter((item) => item?._id !== song?._id),
    ]);
  }, [queue, song, songs]);

  const handleCardClick = () => {
    if (!song?._id) return;

    playSong(song, songQueue);
    window.scrollTo(0,0)
  };

  const handlePlayOnly = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!song?._id) return;

    playSong(song, songQueue);
  };

  return (
    <div className="song-carder">
      <Link
        to={`/song/${song._id}`}
        state={{
          playlist: songQueue,
        }}
        className="song-linker"
        onClick={handleCardClick}
      >
        <div className="card-img-container">
          <img
            src={song.imageUrl || "/fallback-cover.svg"}
            alt={song.title || "Song cover"}
            loading="lazy"
            decoding="async"
          />

          <button
            type="button"
            className="play-overlay"
            onClick={handlePlayOnly}
            aria-label={`Play ${song.title || "song"}`}
            title="Play"
          >
            <FaPlay />
          </button>
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