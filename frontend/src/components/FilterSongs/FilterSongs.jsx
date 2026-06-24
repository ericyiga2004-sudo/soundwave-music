import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { MusicPlayerContext } from "../../context/MainPlayerContext";
import "./FilterSongs.css";
import { Link } from "react-router-dom";
import { FaPlay } from "react-icons/fa";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

const tabs = ["Trending", "New", "Most Liked"];

const FilterSongs = () => {
  const { playSong } = useContext(MusicPlayerContext);

  const [songs, setSongs] = useState([]);
  const [tab, setTab] = useState("Trending");
  const [loading, setLoading] = useState(true);

  const [genre, setGenre] = useState("");
  const [country, setCountry] = useState("");

  const normalizeText = (value) => {
    return String(value || "")
      .trim()
      .toLowerCase();
  };

  const getSongCountry = (song) => {
    return (
      song?.country ||
      song?.artist?.country ||
      song?.album?.country ||
      ""
    );
  };

  const fetchSongs = async () => {
    setLoading(true);

    try {
      let url = "";

      if (tab === "Trending") url = "/api/songs/trending/all";
      if (tab === "New") url = "/api/songs/new-releases/all";
      if (tab === "Most Liked") url = "/api/songs/most-liked/all";

      const res = await axios.get(`${backendUrl}${url}`);

      let data = res.data.songs || [];

      if (genre) {
        data = data.filter(
          (song) => normalizeText(song.genre) === normalizeText(genre)
        );
      }

      if (country.trim()) {
        const countrySearch = normalizeText(country);

        data = data.filter((song) => {
          const songCountry = normalizeText(getSongCountry(song));

          return songCountry.includes(countrySearch);
        });
      }

      setSongs(data);
    } catch (err) {
      console.log(err);
      setSongs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSongs();
  }, [tab, genre, country]);

  return (
    <section className="filter-section">
      {/* HEADER */}
      <div className="filter-header">
        <h2>🎧 Discover Music</h2>

        <div className="tabs">
          {tabs.map((tabName) => (
            <button
              type="button"
              key={tabName}
              className={tab === tabName ? "active" : ""}
              onClick={() => setTab(tabName)}
            >
              {tabName}
            </button>
          ))}
        </div>
      </div>

      {/* FILTERS */}
      <div className="filters">
        <select value={genre} onChange={(e) => setGenre(e.target.value)}>
          <option value="">All Genres</option>
          <option value="EDM">EDM</option>
          <option value="Afrobeat">Afrobeat</option>
          <option value="Hip Hop">Hip Hop</option>
        </select>

        <input
          value={country}
          placeholder="Filter by country, e.g. America, Uganda, Nigeria"
          onChange={(e) => setCountry(e.target.value)}
        />

        {(genre || country) && (
          <button
            type="button"
            className="clear-filters-btn"
            onClick={() => {
              setGenre("");
              setCountry("");
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* SONGS */}
      {loading ? (
        <p className="loading">Loading songs...</p>
      ) : songs.length > 0 ? (
        <section className="new-release">
          <div className="release-grid">
            {songs.map((song) => (
              <div
                className="release-card"
                key={song._id}
                onClick={() => playSong(song, songs)}
              >
                <Link
                  className="text-decoration-none"
                  to={`/song/${song._id}`}
                  state={{ playlist: songs }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="release-image">
                    <img
                      src={song.imageUrl || "/fallback-cover.png"}
                      alt={song.title || "Song cover"}
                    />

                    <div
                      className="play-btn"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        playSong(song, songs);
                      }}
                    >
                      <FaPlay />
                    </div>
                  </div>

                  <div className="release-content">
                    <h3 className="text-white">{song.title}</h3>
                    <p>{song.artist?.name || "Unknown Artist"}</p>

                    {getSongCountry(song) && (
                      <span className="song-country">
                        {getSongCountry(song)}
                      </span>
                    )}
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <p className="loading">No songs found.</p>
      )}
    </section>
  );
};

export default FilterSongs;