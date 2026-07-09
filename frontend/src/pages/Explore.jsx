import React, { useEffect, useMemo, useRef, useState } from "react";
import SongItem from "../components/SongItem/SongItem";
import "./CSS/Explore.css";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || "https://soundwave-music.onrender.com";

const fallbackImage = "/fallback.jpg";

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

const normalizeCountryName = (country = "") => {
  const cleanCountry = String(country || "").trim();

  if (!cleanCountry) return "Unknown";

  const lower = cleanCountry.toLowerCase();

  if (
    lower === "america" ||
    lower === "usa" ||
    lower === "u.s.a" ||
    lower === "u.s.a." ||
    lower === "us" ||
    lower === "u.s" ||
    lower === "u.s." ||
    lower === "united states of america" ||
    lower === "unites states" ||
    lower === "united state"
  ) {
    return "United States";
  }

  return cleanCountry;
};

const getArtistName = (song) =>
  song?.artist?.name || song?.artistName || song?.artist || "Unknown Artist";

const getArtistId = (song) => {
  return (song?.artist?._id || song?.artist || song?.artistId || "").toString();
};

const getPreferenceArtistId = (item) => {
  return (item?.artist?._id || item?.artist || "").toString();
};

const getSongImage = (song) => song?.imageUrl || fallbackImage;

const getSongCountry = (song) => {
  return normalizeCountryName(
    song?.country || song?.artist?.country || song?.album?.country || ""
  );
};

const getSongLanguage = (song) => {
  return song?.songLanguage || song?.language || "";
};

const formatNumber = (value = 0) => {
  const number = Number(value) || 0;

  if (number >= 1000000) return `${(number / 1000000).toFixed(1)}M`;
  if (number >= 1000) return `${(number / 1000).toFixed(1)}K`;

  return number;
};

const getPreferenceItems = (preferences = {}, key = "") => {
  return Array.isArray(preferences[key]) ? preferences[key] : [];
};

const getPreferenceName = (item, key = "name") => {
  if (!item) return "";

  if (key === "artist") {
    return getPreferenceArtistId(item);
  }

  return item?.[key] || item?.name || "";
};

const buildPreferenceScoreMap = (items = [], key = "name") => {
  const map = new Map();

  items.forEach((item, index) => {
    const value = getPreferenceName(item, key);

    if (!value) return;

    const normalizedValue =
      key === "artist" ? value.toString().toLowerCase() : normalizeText(value);

    const score = Number(item.score || 0);

    map.set(normalizedValue, {
      score,
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

const getSortedPreferenceValues = (items = [], key = "name") => {
  return [...items]
    .filter((item) => getPreferenceName(item, key))
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .map((item) => getPreferenceName(item, key));
};

const getCountryStats = (songs = []) => {
  const stats = new Map();

  songs.forEach((song) => {
    if (song?.status === "draft") return;

    const country = getSongCountry(song);

    if (!country || country === "Unknown") return;

    const current = stats.get(country) || {
      country,
      count: 0,
      plays: 0,
      likes: 0,
    };

    current.count += 1;
    current.plays += Number(song.plays || 0);
    current.likes += Number(song.likes || 0);

    stats.set(country, current);
  });

  return stats;
};

const getBestInitialCountry = ({ songs = [], countries = [], preferences = {} }) => {
  const countryStats = getCountryStats(songs);
  const preferredCountries = getSortedPreferenceValues(
    getPreferenceItems(preferences, "countries"),
    "name"
  );

  for (const preferredCountry of preferredCountries) {
    const matchedCountry = countries.find(
      (country) => normalizeText(country) === normalizeText(preferredCountry)
    );

    if (matchedCountry) return matchedCountry;
  }

  const topCountryByActivity = [...countryStats.values()].sort((a, b) => {
    const scoreA = a.plays * 2 + a.likes * 5 + a.count * 20;
    const scoreB = b.plays * 2 + b.likes * 5 + b.count * 20;

    return scoreB - scoreA;
  })[0];

  if (topCountryByActivity?.country) return topCountryByActivity.country;

  if (countries.includes("Uganda")) return "Uganda";

  return countries[0] || "";
};

const getBestInitialGenre = ({
  songs = [],
  country = "",
  preferences = {},
}) => {
  const preferredGenres = getSortedPreferenceValues(
    getPreferenceItems(preferences, "genres"),
    "name"
  );

  const countrySongs = songs.filter((song) => {
    return (
      song?.status !== "draft" &&
      normalizeText(getSongCountry(song)) === normalizeText(country)
    );
  });

  const availableGenres = [
    ...new Set(
      countrySongs
        .map((song) => song.genre)
        .filter(Boolean)
        .map((genre) => genre.trim())
    ),
  ];

  for (const preferredGenre of preferredGenres) {
    const matchedGenre = availableGenres.find(
      (genre) => normalizeText(genre) === normalizeText(preferredGenre)
    );

    if (matchedGenre) return matchedGenre;
  }

  return "All";
};

const sortCountriesByTaste = ({
  countries = [],
  songs = [],
  preferences = {},
}) => {
  const countryScoreMap = buildPreferenceScoreMap(
    getPreferenceItems(preferences, "countries"),
    "name"
  );

  const countryStats = getCountryStats(songs);

  return [...countries].sort((a, b) => {
    const scoreA = getPreferenceScore(countryScoreMap, a);
    const scoreB = getPreferenceScore(countryScoreMap, b);

    if (scoreB !== scoreA) return scoreB - scoreA;

    const statA = countryStats.get(a) || {
      plays: 0,
      likes: 0,
      count: 0,
    };

    const statB = countryStats.get(b) || {
      plays: 0,
      likes: 0,
      count: 0,
    };

    const activityA = statA.plays * 2 + statA.likes * 5 + statA.count * 20;
    const activityB = statB.plays * 2 + statB.likes * 5 + statB.count * 20;

    return activityB - activityA;
  });
};

const sortValuesByPreference = (values = [], preferenceItems = []) => {
  const scoreMap = buildPreferenceScoreMap(preferenceItems, "name");

  return [...values].sort((a, b) => {
    const scoreA = getPreferenceScore(scoreMap, a);
    const scoreB = getPreferenceScore(scoreMap, b);

    if (scoreB !== scoreA) return scoreB - scoreA;

    return a.localeCompare(b);
  });
};

const sortSongsByUserTaste = (songs = [], preferences = {}) => {
  const countryScoreMap = buildPreferenceScoreMap(
    getPreferenceItems(preferences, "countries"),
    "name"
  );

  const genreScoreMap = buildPreferenceScoreMap(
    getPreferenceItems(preferences, "genres"),
    "name"
  );

  const moodScoreMap = buildPreferenceScoreMap(
    getPreferenceItems(preferences, "moods"),
    "name"
  );

  const languageScoreMap = buildPreferenceScoreMap(
    getPreferenceItems(preferences, "languages"),
    "name"
  );

  const artistScoreMap = buildPreferenceScoreMap(
    getPreferenceItems(preferences, "artists"),
    "artist"
  );

  return [...songs].sort((a, b) => {
    const scoreSong = (song) => {
      const country = getSongCountry(song);
      const artistId = getArtistId(song);

      return (
        getPreferenceScore(countryScoreMap, country) * 500 +
        getPreferenceScore(genreScoreMap, song.genre) * 400 +
        getPreferenceScore(moodScoreMap, song.mood) * 250 +
        getPreferenceScore(languageScoreMap, getSongLanguage(song)) * 120 +
        getArtistPreferenceScore(artistScoreMap, artistId) * 600 +
        Number(song.recommendationScore || 0) * 10 +
        Number(song.plays || 0) * 2 +
        Number(song.likes || 0) * 8
      );
    };

    const scoreA = scoreSong(a);
    const scoreB = scoreSong(b);

    if (scoreB !== scoreA) return scoreB - scoreA;

    if (Number(b.plays || 0) !== Number(a.plays || 0)) {
      return Number(b.plays || 0) - Number(a.plays || 0);
    }

    return Number(b.likes || 0) - Number(a.likes || 0);
  });
};

const SongRowSkeleton = () => (
  <div className="explore-skeleton-row">
    <span className="skeleton-rank"></span>
    <span className="skeleton-img"></span>
    <span className="skeleton-text">
      <i></i>
      <b></b>
    </span>
    <span className="skeleton-pill"></span>
  </div>
);

const SongCardSkeleton = () => (
  <div className="explore-skeleton-card">
    <span></span>
    <i></i>
    <b></b>
  </div>
);

const Explore = () => {
  const initialTasteAppliedRef = useRef(false);

  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("All");
  const [selectedMood, setSelectedMood] = useState("All");

  const [topTenSongs, setTopTenSongs] = useState([]);
  const [allSongs, setAllSongs] = useState([]);
  const [countries, setCountries] = useState([]);

  const [preferences, setPreferences] = useState({});

  const [searchTerm, setSearchTerm] = useState("");
  const [activeSong, setActiveSong] = useState(null);

  const [loading, setLoading] = useState(true);
  const [topTenLoading, setTopTenLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchExploreData = async () => {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("token");

      const songsRequest = fetch(`${BACKEND_URL}/api/songs?limit=500&sort=popular`);

      const preferencesRequest = token
        ? fetch(`${BACKEND_URL}/api/recommend/preferences`, {
            headers: {
              token,
            },
          })
        : Promise.resolve(null);

      const [songsResponse, preferencesResponse] = await Promise.all([
        songsRequest,
        preferencesRequest,
      ]);

      const songsData = await songsResponse.json();

      if (!songsResponse.ok || !songsData.success) {
        throw new Error(songsData.message || "Failed to fetch songs");
      }

      let fetchedPreferences = {};

      if (preferencesResponse) {
        try {
          const preferencesData = await preferencesResponse.json();

          if (preferencesData.success) {
            fetchedPreferences = preferencesData.preferences || {};
          }
        } catch (preferencesError) {
          console.log("Explore preferences error:", preferencesError);
        }
      }

      const songs = (songsData.songs || []).map((song) => ({
        ...song,
        country: getSongCountry(song),
      }));

      const uniqueCountries = [
        ...new Set(
          songs
            .map((song) => getSongCountry(song))
            .filter((country) => country && country !== "Unknown")
        ),
      ];

      const sortedCountries = sortCountriesByTaste({
        countries: uniqueCountries,
        songs,
        preferences: fetchedPreferences,
      });

      setAllSongs(songs);
      setPreferences(fetchedPreferences);
      setCountries(sortedCountries);

      if (!initialTasteAppliedRef.current) {
        const bestCountry = getBestInitialCountry({
          songs,
          countries: sortedCountries,
          preferences: fetchedPreferences,
        });

        const bestGenre = getBestInitialGenre({
          songs,
          country: bestCountry,
          preferences: fetchedPreferences,
        });

        setSelectedCountry(bestCountry);
        setSelectedGenre(bestGenre);
        setSelectedMood("All");

        initialTasteAppliedRef.current = true;
      }
    } catch (err) {
      console.error("Explore songs error:", err);
      setError(err.message || "Could not load Explore songs");
    } finally {
      setLoading(false);
    }
  };

  const fetchTopTenSongs = async (country) => {
    if (!country) return;

    try {
      setTopTenLoading(true);
      setError("");

      setTopTenSongs([]);
      setActiveSong(null);

      const normalizedCountry = normalizeCountryName(country);

      const response = await fetch(
        `${BACKEND_URL}/api/songs/top-ten?country=${encodeURIComponent(
          normalizedCountry
        )}`
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        setTopTenSongs([]);
        setActiveSong(null);
        return;
      }

      const songs = (data.songs || []).map((song) => ({
        ...song,
        country: getSongCountry(song),
      }));

      const sortedSongs = [...songs].sort((a, b) => {
        const rankA = Number(a.topTenRank || 999);
        const rankB = Number(b.topTenRank || 999);

        if (rankA !== rankB) return rankA - rankB;

        return Number(b.plays || 0) - Number(a.plays || 0);
      });

      setTopTenSongs(sortedSongs);
      setActiveSong(sortedSongs[0] || null);
    } catch (err) {
      console.error("Top Ten error:", err);
      setTopTenSongs([]);
      setActiveSong(null);
    } finally {
      setTopTenLoading(false);
    }
  };

  useEffect(() => {
    fetchExploreData();

    window.addEventListener("music-history-updated", fetchExploreData);
    window.addEventListener("music-liked-updated", fetchExploreData);
    window.addEventListener("artist-follow-updated", fetchExploreData);

    return () => {
      window.removeEventListener("music-history-updated", fetchExploreData);
      window.removeEventListener("music-liked-updated", fetchExploreData);
      window.removeEventListener("artist-follow-updated", fetchExploreData);
    };
  }, []);

  useEffect(() => {
    if (!selectedCountry) return;

    fetchTopTenSongs(selectedCountry);
  }, [selectedCountry]);

  const countrySongs = useMemo(() => {
    const songs = allSongs.filter((song) => {
      return (
        normalizeText(getSongCountry(song)) === normalizeText(selectedCountry) &&
        song.status !== "draft"
      );
    });

    return sortSongsByUserTaste(songs, preferences);
  }, [allSongs, selectedCountry, preferences]);

  const genres = useMemo(() => {
    const uniqueGenres = [
      ...new Set(
        countrySongs
          .map((song) => song.genre)
          .filter(Boolean)
          .map((genre) => genre.trim())
      ),
    ];

    return [
      "All",
      ...sortValuesByPreference(
        uniqueGenres,
        getPreferenceItems(preferences, "genres")
      ),
    ];
  }, [countrySongs, preferences]);

  const genreSongs = useMemo(() => {
    if (selectedGenre === "All") return countrySongs;

    return countrySongs.filter((song) => {
      return normalizeText(song.genre) === normalizeText(selectedGenre);
    });
  }, [countrySongs, selectedGenre]);

  const moods = useMemo(() => {
    const uniqueMoods = [
      ...new Set(
        genreSongs
          .map((song) => song.mood)
          .filter(Boolean)
          .map((mood) => mood.trim())
      ),
    ];

    return [
      "All",
      ...sortValuesByPreference(
        uniqueMoods,
        getPreferenceItems(preferences, "moods")
      ),
    ];
  }, [genreSongs, preferences]);

  const filteredSongs = useMemo(() => {
    const search = normalizeText(searchTerm);

    return genreSongs.filter((song) => {
      const matchesMood =
        selectedMood === "All" ||
        normalizeText(song.mood) === normalizeText(selectedMood);

      const searchableText = normalizeText(
        [
          song.title,
          getArtistName(song),
          song.genre,
          song.mood,
          getSongCountry(song),
          getSongLanguage(song),
          ...(Array.isArray(song.tags) ? song.tags : []),
        ]
          .filter(Boolean)
          .join(" ")
      );

      const matchesSearch = !search || searchableText.includes(search);

      return matchesMood && matchesSearch;
    });
  }, [genreSongs, selectedMood, searchTerm]);

  const displayTopSongs = useMemo(() => {
    if (topTenSongs.length > 0) {
      return sortSongsByUserTaste(topTenSongs, preferences).slice(0, 10);
    }

    return filteredSongs.slice(0, 10);
  }, [topTenSongs, filteredSongs, preferences]);

  const moodGroups = useMemo(() => {
    const groups = {};

    genreSongs.forEach((song) => {
      const mood = song.mood || "Unknown";

      groups[mood] = groups[mood] || [];
      groups[mood].push(song);
    });

    return Object.entries(groups)
      .map(([mood, songs]) => ({
        mood,
        songs: sortSongsByUserTaste(songs, preferences).slice(0, 6),
      }))
      .sort((a, b) => {
        const moodScoreMap = buildPreferenceScoreMap(
          getPreferenceItems(preferences, "moods"),
          "name"
        );

        const scoreA = getPreferenceScore(moodScoreMap, a.mood);
        const scoreB = getPreferenceScore(moodScoreMap, b.mood);

        if (scoreB !== scoreA) return scoreB - scoreA;

        const playsA = a.songs.reduce(
          (total, song) => total + Number(song.plays || 0),
          0
        );

        const playsB = b.songs.reduce(
          (total, song) => total + Number(song.plays || 0),
          0
        );

        return playsB - playsA;
      })
      .slice(0, 5);
  }, [genreSongs, preferences]);

  const heroSong =
    activeSong ||
    displayTopSongs[0] ||
    filteredSongs[0] ||
    countrySongs[0] ||
    allSongs[0];

  const handleCountryChange = (country) => {
    const normalizedCountry = normalizeCountryName(country);

    const bestGenre = getBestInitialGenre({
      songs: allSongs,
      country: normalizedCountry,
      preferences,
    });

    setSelectedCountry(normalizedCountry);
    setSelectedGenre(bestGenre);
    setSelectedMood("All");
    setSearchTerm("");
    setActiveSong(null);
  };

  const handleGenreChange = (genre) => {
    setSelectedGenre(genre);
    setSelectedMood("All");
    setSearchTerm("");
    setActiveSong(null);
  };

  return (
    <div className="explore-page container-fluid">
      <section className="explore-hero">
        <div className="hero-bg-glow hero-bg-one"></div>
        <div className="hero-bg-glow hero-bg-two"></div>

        <div className="row g-3 align-items-center">
          <div className="col-12 col-lg-8">
            <div className="hero-copy">
              <span className="explore-kicker">Explore SoundWave</span>

              <h1>
                Discover <span>your sound</span>
                {selectedCountry ? ` in ${selectedCountry}` : ""}
              </h1>

              <p>
                Explore songs ranked by your listening taste, favorite country,
                genre, mood, artists, likes, and plays.
              </p>

              <div className="row g-2 explore-control-row">
                <div className="col-12 col-md-4">
                  <label className="explore-control-label">
                    <span>Country</span>
                    <select
                      value={selectedCountry}
                      onChange={(e) => handleCountryChange(e.target.value)}
                    >
                      {countries.length === 0 && (
                        <option value="">Loading countries...</option>
                      )}

                      {countries.map((country) => (
                        <option key={country} value={country}>
                          {country}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="col-12 col-md-4">
                  <label className="explore-control-label">
                    <span>Genre</span>
                    <select
                      value={selectedGenre}
                      onChange={(e) => handleGenreChange(e.target.value)}
                    >
                      {genres.map((genre) => (
                        <option key={genre} value={genre}>
                          {genre}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="col-12 col-md-4">
                  <label className="explore-control-label">
                    <span>Search</span>
                    <input
                      type="text"
                      placeholder="Songs, artists, moods..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-4">
            <div className="hero-feature-card">
              {topTenLoading || loading ? (
                <div className="hero-feature-skeleton">
                  <span></span>
                  <i></i>
                  <b></b>
                </div>
              ) : heroSong ? (
                <>
                  <div className="hero-rank-pill">
                    {topTenSongs.length > 0
                      ? `#${heroSong.topTenRank || 1} in ${selectedCountry}`
                      : `Recommended in ${selectedCountry}`}
                  </div>

                  <img src={getSongImage(heroSong)} alt={heroSong.title} />

                  <div className="hero-song-info">
                    <h2>{heroSong.title}</h2>
                    <p>{getArtistName(heroSong)}</p>

                    <div className="hero-stats">
                      <span>{heroSong.genre || "Unknown"}</span>
                      <span>{heroSong.mood || "Mood"}</span>
                      <span>{formatNumber(heroSong.plays)} plays</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="hero-empty">
                  <h2>No song selected yet</h2>
                  <p>Add songs from the admin dashboard.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {error && <div className="explore-error">{error}</div>}

      <section className="row g-3 explore-content-row">
        <aside className="col-12 col-lg-3 col-xl-2">
          <div className="explore-sticky-stack">
            <div className="panel-card">
              <h3>For Your Country</h3>
              <p>
                Starting with the country closest to your listening taste:
                <strong> {selectedCountry || "Loading..."}</strong>.
              </p>

              <div className="mini-country-list">
                {countries.slice(0, 10).map((country) => (
                  <button
                    key={country}
                    type="button"
                    className={selectedCountry === country ? "active" : ""}
                    onClick={() => handleCountryChange(country)}
                  >
                    {country}
                  </button>
                ))}
              </div>
            </div>

            <div className="panel-card">
              <h3>Genre Filter</h3>

              <div className="mood-list">
                {genres.map((genre) => (
                  <button
                    key={genre}
                    type="button"
                    className={selectedGenre === genre ? "active" : ""}
                    onClick={() => handleGenreChange(genre)}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>

            <div className="panel-card">
              <h3>Mood Filter</h3>

              <div className="mood-list">
                {moods.map((mood) => (
                  <button
                    key={mood}
                    type="button"
                    className={selectedMood === mood ? "active" : ""}
                    onClick={() => setSelectedMood(mood)}
                  >
                    {mood}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <main className="col-12 col-lg-6 col-xl-8">
          <div className="explore-main">
            <div className="section-heading">
              <div>
                <span>
                  {topTenSongs.length > 0 ? "Official Picks" : "Recommended"}
                </span>

                <h2>
                  {topTenSongs.length > 0
                    ? `Top Ten — ${selectedCountry}`
                    : `For You — ${selectedCountry}`}
                </h2>
              </div>

              <small>{displayTopSongs.length}/10 songs</small>
            </div>

            {topTenLoading || loading ? (
              <div className="top-ten-list">
                {Array.from({ length: 6 }).map((_, index) => (
                  <SongRowSkeleton key={index} />
                ))}
              </div>
            ) : displayTopSongs.length === 0 ? (
              <div className="explore-empty">
                <h3>No songs for {selectedCountry || "this country"} yet</h3>
                <p>
                  Try another country, genre, or add more songs from the admin
                  dashboard.
                </p>
              </div>
            ) : (
              <div className="top-ten-list">
                {displayTopSongs.map((song, index) => (
                  <div
                    key={song._id}
                    className={`top-ten-row ${
                      activeSong?._id === song._id ? "active" : ""
                    }`}
                    onMouseEnter={() => setActiveSong(song)}
                    onFocus={() => setActiveSong(song)}
                  >
                    <div className="song-rank">
                      #{song.topTenRank || index + 1}
                    </div>

                    <div className="top-ten-song-item">
                      <SongItem song={song} queue={displayTopSongs} />
                    </div>

                    <div className="top-song-meta">
                      <span>{song.mood || "Unknown mood"}</span>
                      <small>{formatNumber(song.plays)} plays</small>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="section-heading songs-by-mood-heading">
              <div>
                <span>Explore More</span>

                <h2>
                  {selectedMood === "All"
                    ? selectedGenre === "All"
                      ? `Songs by mood in ${selectedCountry}`
                      : `${selectedGenre} songs in ${selectedCountry}`
                    : `${selectedMood} songs in ${selectedCountry}`}
                </h2>
              </div>

              <small>{filteredSongs.length} songs</small>
            </div>

            {loading ? (
              <div className="row g-3">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="col-6 col-md-4 col-xl-3">
                    <SongCardSkeleton />
                  </div>
                ))}
              </div>
            ) : selectedMood !== "All" || selectedGenre !== "All" || searchTerm ? (
              filteredSongs.length > 0 ? (
                <div className="row g-3">
                  {filteredSongs.map((song) => (
                    <div key={song._id} className="col-6 col-md-4 col-xl-3">
                      <SongItem song={song} queue={filteredSongs} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="explore-empty">
                  <h3>No songs found</h3>
                  <p>Try another mood, genre, country, or search term.</p>
                </div>
              )
            ) : (
              <div className="mood-sections">
                {moodGroups.map((group) => (
                  <div key={group.mood} className="mood-section">
                    <div className="mood-section-title">
                      <h3>{group.mood}</h3>

                      <button
                        type="button"
                        onClick={() => setSelectedMood(group.mood)}
                      >
                        View all
                      </button>
                    </div>

                    <div className="row g-3">
                      {group.songs.map((song) => (
                        <div key={song._id} className="col-6 col-md-4 col-xl-3">
                          <SongItem song={song} queue={group.songs} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        <aside className="col-12 col-lg-3 col-xl-2">
          <div className="explore-sticky-stack">
            <div className="now-exploring-card">
              <span className="pulse-dot"></span>
              <h3>Now Exploring</h3>

              {topTenLoading || loading ? (
                <div className="side-skeleton">
                  <span></span>
                  <i></i>
                  <b></b>
                </div>
              ) : heroSong ? (
                <>
                  <img src={getSongImage(heroSong)} alt={heroSong.title} />

                  <h4>{heroSong.title}</h4>
                  <p>{getArtistName(heroSong)}</p>

                  <div className="recommend-tags">
                    <span>{getSongCountry(heroSong) || selectedCountry}</span>
                    <span>{heroSong.genre || selectedGenre || "Genre"}</span>
                    <span>{heroSong.mood || "Mood"}</span>
                  </div>
                </>
              ) : (
                <p>No song selected</p>
              )}
            </div>

            <div className="recommend-card">
              <h3>Recommended Genres</h3>

              <div className="recommend-moods">
                {genres.slice(1, 7).map((genre) => (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => handleGenreChange(genre)}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>

            <div className="recommend-card">
              <h3>Recommended Moods</h3>

              <div className="recommend-moods">
                {moods.slice(1, 7).map((mood) => (
                  <button
                    key={mood}
                    type="button"
                    onClick={() => setSelectedMood(mood)}
                  >
                    {mood}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
};

export default Explore;