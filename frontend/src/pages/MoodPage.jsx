import React, { useContext, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaMusic, FaPlay } from "react-icons/fa";

import { MusicContext } from "../context/ShopContext";
import { MusicPlayerContext } from "../context/MainPlayerContext";
import "./CSS/MoodPage.css";

const moodLabels = {
  happy: "Happy",
  party: "Party",
  chill: "Chill",
  romantic: "Romantic",
  workout: "Workout",
  sad: "Sad",
  sleep: "Sleep",
  energy: "Energy",
};

const normalizeText = (value = "") => {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
};

const MoodPage = () => {
  const { moodSlug } = useParams();
  const navigate = useNavigate();

  const { songs = [] } = useContext(MusicContext);
  const { playSong } = useContext(MusicPlayerContext);

  const moodName = moodLabels[moodSlug] || moodSlug || "Mood";

  const moodSongs = useMemo(() => {
    const currentMood = normalizeText(moodName);

    return (songs || [])
      .filter((song) => {
        const songMood = normalizeText(song?.mood);
        const songGenre = normalizeText(song?.genre);
        const tags = Array.isArray(song?.tags)
          ? song.tags.map((tag) => normalizeText(tag))
          : [];

        return (
          songMood === currentMood ||
          songGenre === currentMood ||
          tags.includes(currentMood)
        );
      })
      .sort((a, b) => {
        const playsDiff = Number(b?.plays || 0) - Number(a?.plays || 0);

        if (playsDiff !== 0) return playsDiff;

        return Number(b?.likes || 0) - Number(a?.likes || 0);
      });
  }, [songs, moodName]);

  const getSongImage = (song) => {
    return (
      song?.imageUrl ||
      song?.image ||
      song?.coverImage ||
      song?.thumbnail ||
      song?.album?.coverImage ||
      song?.album?.imageUrl ||
      song?.album?.image ||
      "/fallback-cover.svg"
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

  const playMood = () => {
    if (!moodSongs.length) return;

    playSong?.(moodSongs[0], moodSongs);
  };

  const playSingleSong = (song) => {
    playSong?.(song, moodSongs);
  };

  return (
    <main className="mood-page">
      <div className="container-fluid px-2 px-sm-3 px-lg-4">
        <section className="mood-page-hero mx-auto">
          <button
            type="button"
            className="mood-back-btn"
            onClick={() => navigate(-1)}
          >
            <FaArrowLeft />
            Back
          </button>

          <div className="mood-page-icon">
            <FaMusic />
          </div>

          <span>MOOD RADIO</span>

          <h1>{moodName}</h1>

          <p>
            {moodSongs.length}{" "}
            {moodSongs.length === 1 ? "song" : "songs"} matching this mood.
          </p>

          <button
            type="button"
            className="mood-play-btn"
            onClick={playMood}
            disabled={moodSongs.length === 0}
          >
            <FaPlay />
            Play Mood
          </button>
        </section>

        {moodSongs.length > 0 ? (
          <section className="mood-songs-grid row row-cols-2 row-cols-md-3 row-cols-lg-5 row-cols-xxl-7 g-2 g-sm-3 mx-auto">
            {moodSongs.map((song) => (
              <div className="col" key={song._id}>
                <article className="mood-song-card">
                  <img src={getSongImage(song)} alt={song.title} />

                  <div className="mood-song-body">
                    <h3>{song.title || "Unknown Song"}</h3>

                    <p>{getArtistName(song)}</p>

                    <div className="mood-song-meta">
                      <span>{song.genre || "Unknown"}</span>
                      <span>{song.mood || moodName}</span>
                    </div>

                    <button type="button" onClick={() => playSingleSong(song)}>
                      <FaPlay />
                      Play
                    </button>
                  </div>
                </article>
              </div>
            ))}
          </section>
        ) : (
          <section className="mood-empty mx-auto">
            <FaMusic />

            <h2>No songs found for {moodName}</h2>

            <p>
              Add songs with mood value <strong>{moodName}</strong>, then they
              will appear here automatically.
            </p>

            <button type="button" onClick={() => navigate("/")}>
              Go Home
            </button>
          </section>
        )}
      </div>
    </main>
  );
};

export default MoodPage;