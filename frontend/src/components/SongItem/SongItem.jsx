import SongActionMenu from "../SongActions/SongActionMenu";
import React, { useContext, useMemo } from "react";
import { FaPlay } from "react-icons/fa";
import { Link } from "react-router-dom";
import { MusicPlayerContext } from "../../context/MainPlayerContext";
import { MusicContext } from "../../context/ShopContext";
import "./SongItem.tailwind.css";
import { isExternalSong } from "../../utils/songSource";

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

  const external = isExternalSong(song);

  const handleCardClick = () => {
    if (!song?._id) return;

    playSong(song, songQueue);
    window.scrollTo(0, 0);
  };

  const handleExternalCardKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleCardClick();
    }
  };

  const handlePlayOnly = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!song?._id) return;

    playSong(song, songQueue);
  };

  const cardBody = (
    <>
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
          {song.artist?.name || song.artistName || "Unknown Artist"}
        </p>
      </div>
    </>
  );

  return (
    <div className="song-carder">
      {external ? (
        <div
          className="song-linker"
          role="button"
          tabIndex={0}
          onClick={handleCardClick}
          onKeyDown={handleExternalCardKeyDown}
          aria-label={`Play ${song.title || "song"}`}
        >
          {cardBody}
        </div>
      ) : (
        <Link
          to={`/song/${song._id}`}
          state={{
            song,
            playlist: songQueue,
          }}
          className="song-linker"
          onClick={handleCardClick}
        >
          {cardBody}
        </Link>
      )}

      {!external ? (
        <SongActionMenu
          song={song}
          queue={songQueue}
          triggerLabel={`More options for ${song?.title || "song"}`}
        />
      ) : null}
    </div>
  );
};

export default SongItem;