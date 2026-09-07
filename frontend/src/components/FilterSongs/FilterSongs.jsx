import PremiumSelect from "../UI/PremiumSelect";
import SongActionMenu from "../SongActions/SongActionMenu";
import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { MusicPlayerContext } from "../../context/MainPlayerContext";
import "./FilterSongs.tailwind.css";
import { Link } from "react-router-dom";
import { FaPlay } from "react-icons/fa";

import { API_BASE_URL as backendUrl } from "../../config/api";

const tabs = ["Trending", "New", "Most Liked"];

const getTabUrl = (tab) => {
  if (tab === "Trending") return "/api/songs/trending/all?limit=100";
  if (tab === "New") return "/api/songs/new-releases/all?limit=100";
  if (tab === "Most Liked") return "/api/songs/most-liked/all?limit=100";
  return "/api/songs/trending/all?limit=100";
};

const normalizeText = (value) => {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

const includesSearch = (value, search) => {
  const normalizedValue = normalizeText(value);
  const normalizedSearch = normalizeText(search);

  if (!normalizedSearch) return true;

  return normalizedValue.includes(normalizedSearch);
};

const getSongCountry = (song) => {
  return (
    song?.country ||
    song?.artist?.country ||
    song?.album?.country ||
    ""
  );
};

const getArtistName = (song) => {
  return (
    song?.artist?.name ||
    song?.artistName ||
    "Unknown Artist"
  );
};

const sortSongsAfterFilter = (songs = [], tab = "Trending") => {
  return [...songs].sort((a, b) => {
    const scoreA = Number(a.recommendationScore || 0);
    const scoreB = Number(b.recommendationScore || 0);

    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }

    if (tab === "New") {
      const dateA = new Date(a.releaseDate || a.createdAt || 0).getTime();
      const dateB = new Date(b.releaseDate || b.createdAt || 0).getTime();

      if (dateB !== dateA) {
        return dateB - dateA;
      }
    }

    if (tab === "Most Liked") {
      const likesA = Number(a.likes || 0);
      const likesB = Number(b.likes || 0);

      if (likesB !== likesA) {
        return likesB - likesA;
      }
    }

    const playsA = Number(a.plays || 0);
    const playsB = Number(b.plays || 0);

    if (playsB !== playsA) {
      return playsB - playsA;
    }

    return Number(b.likes || 0) - Number(a.likes || 0);
  });
};

const FilterSongsSkeleton = () => {
  return (
    <section className="filter-results">
      <div className="filter-release-scroll">
        {Array.from({ length: 8 }).map((_, index) => (
          <div className="filter-release-card filter-skeleton-card" key={index}>
            <div className="filter-skeleton filter-skeleton-image"></div>

            <div className="filter-release-content">
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

  const [allSongs, setAllSongs] = useState([]);
  const [songs, setSongs] = useState([]);
  const [tab, setTab] = useState("Trending");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [genre, setGenre] = useState("");
  const [country, setCountry] = useState("");
  const [search, setSearch] = useState("");

  const [genres, setGenres] = useState([]);

  const fetchFilterOptions = async () => {
    try {
      const res = await axios.get(`${backendUrl}/api/songs/filter-options`);

      if (res.data.success) {
        setGenres(res.data.filters?.genres || []);
      }
    } catch (error) {
      console.log("Filter options error:", error);

      setGenres(["EDM", "Afrobeat", "Hip Hop"]);
    }
  };

  const fetchSongs = async () => {
    try {
      setLoading(true);
      setLoadError("");

      const url = getTabUrl(tab);
      const res = await axios.get(`${backendUrl}${url}`);

      if (res.data.success) {
        setAllSongs(res.data.songs || []);
      } else {
        setAllSongs([]);
      }
    } catch (err) {
      console.log("Fetch filter songs error:", err);
      setAllSongs([]);
      setLoadError("Could not connect to the SoundWave catalog.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    fetchSongs();

    window.addEventListener("music-history-updated", fetchSongs);
    window.addEventListener("music-liked-updated", fetchSongs);
    window.addEventListener("artist-follow-updated", fetchSongs);
    window.addEventListener("soundwave-personalization-updated", fetchSongs);

    return () => {
      window.removeEventListener("music-history-updated", fetchSongs);
      window.removeEventListener("music-liked-updated", fetchSongs);
      window.removeEventListener("artist-follow-updated", fetchSongs);
      window.removeEventListener("soundwave-personalization-updated", fetchSongs);
    };
  }, [tab]);

  useEffect(() => {
    let filteredSongs = [...allSongs];

    if (genre) {
      filteredSongs = filteredSongs.filter((song) => {
        return normalizeText(song.genre) === normalizeText(genre);
      });
    }

    if (country.trim()) {
      filteredSongs = filteredSongs.filter((song) => {
        const songCountry = getSongCountry(song);

        return includesSearch(songCountry, country);
      });
    }

    if (search.trim()) {
      filteredSongs = filteredSongs.filter((song) => {
        const searchableText = [
          song.title,
          getArtistName(song),
          song.genre,
          song.mood,
          song.songLanguage,
          getSongCountry(song),
          song.album?.title,
          ...(Array.isArray(song.tags) ? song.tags : []),
        ]
          .filter(Boolean)
          .join(" ");

        return includesSearch(searchableText, search);
      });
    }

    setSongs(sortSongsAfterFilter(filteredSongs, tab));
  }, [allSongs, genre, country, search, tab]);

  return (
    <section className="filter-section">
      <div className="sw-container-fluid w-full mx-auto px-3 !px-[0px]">
        <div className="filter-header row flex flex-wrap [--sw-gutter-x:1.5rem] [--sw-gutter-y:0px] -mx-[calc(var(--sw-gutter-x)/2)] -mt-[var(--sw-gutter-y)] [&>*]:px-[calc(var(--sw-gutter-x)/2)] [&>*]:mt-[var(--sw-gutter-y)] [&>*]:shrink-0 [&>*]:w-full [&>*]:max-w-full [--sw-gutter-x:1rem] [--sw-gutter-y:1rem] !items-center">
          <div className="col !w-[100%] flex-none col lg:flex-[1_0_0%]">
            <h2>🎧 Discover Music</h2>
          </div>

          <div className="col !w-[100%] flex-none col lg:!w-auto lg:flex-none">
            <div className="tabs !flex !flex-wrap gap-2 !justify-start lg:!justify-end">
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

        <div className="filters row flex flex-wrap [--sw-gutter-x:1.5rem] [--sw-gutter-y:0px] -mx-[calc(var(--sw-gutter-x)/2)] -mt-[var(--sw-gutter-y)] [&>*]:px-[calc(var(--sw-gutter-x)/2)] [&>*]:mt-[var(--sw-gutter-y)] [&>*]:shrink-0 [&>*]:w-full [&>*]:max-w-full [--sw-gutter-x:0.5rem] [--sw-gutter-y:0.5rem] md:[--sw-gutter-x:1rem] md:[--sw-gutter-y:1rem] !items-center">
          <div className="col !w-[100%] flex-none col sm:!w-[50%] sm:flex-none col md:!w-[33.333333333333336%] md:flex-none col lg:!w-[25%] lg:flex-none">
            <input
              className="!w-full"
              value={search}
              placeholder="Search song, artist, mood..."
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="col !w-[100%] flex-none col sm:!w-[50%] sm:flex-none col md:!w-[33.333333333333336%] md:flex-none col lg:!w-[25%] lg:flex-none">
            <PremiumSelect
              className="!w-full"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
            >
              <option value="">All Genres</option>

              {genres.map((genreName) => (
                <option value={genreName} key={genreName}>
                  {genreName}
                </option>
              ))}
            </PremiumSelect>
          </div>

          <div className="col !w-[100%] flex-none col sm:!w-[66.66666666666667%] sm:flex-none col md:!w-[33.333333333333336%] md:flex-none col lg:!w-[33.333333333333336%] lg:flex-none">
            <input
              className="!w-full"
              value={country}
              placeholder="Country e.g. Uganda, Nigeria, United States"
              onChange={(e) => setCountry(e.target.value)}
            />
          </div>

          {(genre || country || search) && (
            <div className="col !w-[100%] flex-none col md:!w-auto md:flex-none">
              <button
                type="button"
                className="clear-filters-btn"
                onClick={() => {
                  setGenre("");
                  setCountry("");
                  setSearch("");
                }}
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <FilterSongsSkeleton />
        ) : songs.length > 0 ? (
          <section className="filter-results">
            <div className="filter-release-scroll">
              {songs.map((song) => (
                <div
                  className="filter-release-card"
                  key={song._id}
                  onClick={() => playSong(song, songs)}
                >
                  <Link
                    className="!no-underline"
                    to={`/song/${song._id}`}
                    state={{ playlist: songs }}
                    onClick={(e) => {
                      e.stopPropagation();
                      window.scrollTo(0, 0);
                    }}
                  >
                    <div className="filter-release-image">
                      <img
                        src={song.imageUrl || "/fallback-cover.svg"}
                        alt={song.title || "Song cover"}
                        loading="lazy"
                      />

                      <div
                        className="filter-play-btn"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          playSong(song, songs);
                        }}
                      >
                        <FaPlay />
                      </div>
                    </div>

                    <div className="filter-release-content">
                      <h3>{song.title || "Unknown Song"}</h3>

                      <p>{getArtistName(song)}</p>

                      {getSongCountry(song) && (
                        <span className="song-country">
                          {getSongCountry(song)}
                        </span>
                      )}
                    </div>
                  </Link>
                  <SongActionMenu
                    song={song}
                    queue={songs}
                    triggerClassName="sw2324-overlay-more sw2324-filter-more"
                    triggerLabel={`More options for ${song.title}`}
                  />
                </div>
              ))}
            </div>
          </section>
        ) : loadError ? (
          <div className="filter-empty-state catalog-error-state">
            <span>{loadError}</span>
            <button type="button" className="catalog-retry-btn" onClick={fetchSongs}>
              Retry
            </button>
          </div>
        ) : (
          <div className="filter-empty-state">No songs found.</div>
        )}
      </div>
    </section>
  );
};

export default FilterSongs;