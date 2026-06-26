import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { MusicPlayerContext } from "../../context/MainPlayerContext";
import "./FilterSongs.css";
import { Link } from "react-router-dom";
import { FaPlay } from "react-icons/fa";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

const tabs = ["Trending", "New", "Most Liked"];

const FilterSongsSkeleton = () => {
  return (
    <section className="new-release filter-skeleton-wrapper">
      <div className="release-grid">
        {Array.from({ length: 8 }).map((_, index) => (
          <div className="release-card filter-skeleton-card" key={index}>
            <div className="filter-skeleton filter-skeleton-image"></div>

            <div className="release-content">
              <div className="filter-skeleton filter-skeleton-line big"></div>
              <div className="filter-skeleton filter-skeleton-line small"></div>
              <div className="filter-skeleton filter-skeleton-line tiny"></div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

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
      <div className="container-fluid px-0">
        {/* HEADER */}
        <div className="filter-header row g-3 align-items-center">
          <div className="col-12 col-lg">
            <h2>🎧 Discover Music</h2>
          </div>

          <div className="col-12 col-lg-auto">
            <div className="tabs d-flex flex-wrap gap-2 justify-content-start justify-content-lg-end">
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
        </div>

        {/* FILTERS */}
        <div className="filters row g-2 g-md-3 align-items-center">
          <div className="col-12 col-sm-5 col-md-4 col-lg-3">
            <select
              className="w-100"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
            >
              <option value="">All Genres</option>
              <option value="EDM">EDM</option>
              <option value="Afrobeat">Afrobeat</option>
              <option value="Hip Hop">Hip Hop</option>
            </select>
          </div>

          <div className="col-12 col-sm-7 col-md-6 col-lg-5">
            <input
              className="w-100"
              value={country}
              placeholder="Country e.g. Uganda, Nigeria"
              onChange={(e) => setCountry(e.target.value)}
            />
          </div>

          {(genre || country) && (
            <div className="col-12 col-md-auto">
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
            </div>
          )}
        </div>

        {/* SONGS */}
        {loading ? (
          <FilterSongsSkeleton />
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
                        loading="lazy"
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
                      <h3 className="text-white">
                        {song.title || "Unknown Song"}
                      </h3>

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
          <div className="filter-empty-state">
            No songs found.
          </div>
        )}
      </div>
    </section>
  );
};

export default FilterSongs;