import React, { useEffect, useMemo, useState } from "react";
import SongItem from "../components/SongItem/SongItem";
import "./CSS/Explore.css";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || "https://soundwave-music.onrender.com";

const fallbackImage = "/fallback.jpg";

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
    lower === "united states of america"
  ) {
    return "United States";
  }

  return cleanCountry;
};

const getArtistName = (song) =>
  song?.artist?.name || song?.artistName || song?.artist || "Unknown Artist";

const getSongImage = (song) => song?.imageUrl || fallbackImage;

const formatNumber = (value = 0) => {
  const number = Number(value) || 0;

  if (number >= 1000000) return `${(number / 1000000).toFixed(1)}M`;
  if (number >= 1000) return `${(number / 1000).toFixed(1)}K`;

  return number;
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
  const [selectedCountry, setSelectedCountry] = useState("Uganda");
  const [topTenSongs, setTopTenSongs] = useState([]);
  const [allSongs, setAllSongs] = useState([]);
  const [countries, setCountries] = useState(["Uganda"]);
  const [selectedMood, setSelectedMood] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSong, setActiveSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [topTenLoading, setTopTenLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchCountriesAndSongs = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${BACKEND_URL}/api/songs`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to fetch songs");
      }

      const songs = (data.songs || []).map((song) => ({
        ...song,
        country: normalizeCountryName(song.country),
      }));

      setAllSongs(songs);

      const uniqueCountries = [
        ...new Set(
          songs
            .map((song) => normalizeCountryName(song.country))
            .filter(Boolean)
        ),
      ].sort();

      if (uniqueCountries.length > 0) {
        setCountries(uniqueCountries);

        if (!uniqueCountries.includes(selectedCountry)) {
          setSelectedCountry(
            uniqueCountries.includes("Uganda") ? "Uganda" : uniqueCountries[0]
          );
        }
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

      const response = await fetch(
        `${BACKEND_URL}/api/songs/top-ten?country=${encodeURIComponent(
          country
        )}`
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to fetch Top Ten songs");
      }

      const songs = (data.songs || []).map((song) => ({
        ...song,
        country: normalizeCountryName(song.country),
      }));

      setTopTenSongs(songs);

      if (songs.length > 0) {
        setActiveSong(songs[0]);
      } else {
        setActiveSong(null);
      }
    } catch (err) {
      console.error("Top Ten error:", err);
      setTopTenSongs([]);
      setError(err.message || "Could not load Top Ten songs");
    } finally {
      setTopTenLoading(false);
    }
  };

  useEffect(() => {
    fetchCountriesAndSongs();
  }, []);

  useEffect(() => {
    fetchTopTenSongs(selectedCountry);
    setSelectedMood("All");
    setSearchTerm("");
  }, [selectedCountry]);

  const countrySongs = useMemo(() => {
    return allSongs.filter(
      (song) =>
        normalizeCountryName(song.country).toLowerCase() ===
          selectedCountry.toLowerCase() && song.status !== "draft"
    );
  }, [allSongs, selectedCountry]);

  const moods = useMemo(() => {
    const uniqueMoods = [
      ...new Set(
        countrySongs
          .map((song) => song.mood)
          .filter(Boolean)
          .map((mood) => mood.trim())
      ),
    ].sort();

    return ["All", ...uniqueMoods];
  }, [countrySongs]);

  const filteredSongs = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return countrySongs.filter((song) => {
      const matchesMood =
        selectedMood === "All" ||
        song.mood?.toLowerCase() === selectedMood.toLowerCase();

      const matchesSearch =
        !search ||
        song.title?.toLowerCase().includes(search) ||
        getArtistName(song).toLowerCase().includes(search) ||
        song.genre?.toLowerCase().includes(search) ||
        song.mood?.toLowerCase().includes(search);

      return matchesMood && matchesSearch;
    });
  }, [countrySongs, selectedMood, searchTerm]);

  const moodGroups = useMemo(() => {
    const groups = {};

    countrySongs.forEach((song) => {
      const mood = song.mood || "Unknown";
      groups[mood] = groups[mood] || [];
      groups[mood].push(song);
    });

    return Object.entries(groups)
      .map(([mood, songs]) => ({
        mood,
        songs: songs
          .sort((a, b) => Number(b.plays || 0) - Number(a.plays || 0))
          .slice(0, 6),
      }))
      .slice(0, 5);
  }, [countrySongs]);

  const heroSong = activeSong || topTenSongs[0] || countrySongs[0];

  return (
    <div className="explore-page">
      <section className="explore-hero">
        <div className="hero-bg-glow hero-bg-one"></div>
        <div className="hero-bg-glow hero-bg-two"></div>

        <div className="hero-copy">
          <span className="explore-kicker">Explore SoundWave</span>

          <h1>
            Discover the <span>Top Ten</span> sounds in {selectedCountry}
          </h1>

          <p>
            Explore songs by country, mood, plays, artists, and fresh SoundWave
            energy.
          </p>

          <div className="explore-controls">
            <label>
              <span>Country</span>
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
              >
                {countries.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Search</span>
              <input
                type="text"
                placeholder="Search songs, artists, moods..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="hero-feature-card">
          {topTenLoading ? (
            <div className="hero-feature-skeleton">
              <span></span>
              <i></i>
              <b></b>
            </div>
          ) : heroSong ? (
            <>
              <div className="hero-rank-pill">
                #{heroSong.topTenRank || 1} in {selectedCountry}
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
              <p>Add Top Ten songs from the admin dashboard.</p>
            </div>
          )}
        </div>
      </section>

      {error && <div className="explore-error">{error}</div>}

      <section className="explore-layout">
        <aside className="explore-side-panel">
          <div className="panel-card">
            <h3>Country Chart</h3>
            <p>
              Showing manually selected Top Ten songs for{" "}
              <strong>{selectedCountry}</strong>.
            </p>

            <div className="mini-country-list">
              {countries.slice(0, 10).map((country) => (
                <button
                  key={country}
                  type="button"
                  className={selectedCountry === country ? "active" : ""}
                  onClick={() => setSelectedCountry(country)}
                >
                  {country}
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
        </aside>

        <main className="explore-main">
          <div className="section-heading">
            <div>
              <span>Official Picks</span>
              <h2>Top Ten — {selectedCountry}</h2>
            </div>

            <small>{topTenSongs.length}/10 songs</small>
          </div>

          {topTenLoading ? (
            <div className="top-ten-list">
              {Array.from({ length: 6 }).map((_, index) => (
                <SongRowSkeleton key={index} />
              ))}
            </div>
          ) : topTenSongs.length === 0 ? (
            <div className="explore-empty">
              <h3>No Top Ten songs for {selectedCountry} yet</h3>
              <p>
                Go to your admin page and assign songs to positions #1 to #10.
              </p>
            </div>
          ) : (
            <div className="top-ten-list">
              {topTenSongs.map((song, index) => (
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
                    <SongItem song={song} queue={topTenSongs} />
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
                  ? `Songs by mood in ${selectedCountry}`
                  : `${selectedMood} songs in ${selectedCountry}`}
              </h2>
            </div>

            <small>{filteredSongs.length} songs</small>
          </div>

          {loading ? (
            <div className="explore-song-grid">
              {Array.from({ length: 8 }).map((_, index) => (
                <SongCardSkeleton key={index} />
              ))}
            </div>
          ) : selectedMood !== "All" || searchTerm ? (
            filteredSongs.length > 0 ? (
              <div className="explore-song-grid">
                {filteredSongs.map((song) => (
                  <SongItem key={song._id} song={song} queue={filteredSongs} />
                ))}
              </div>
            ) : (
              <div className="explore-empty">
                <h3>No songs found</h3>
                <p>Try another mood, country, or search term.</p>
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

                  <div className="explore-song-grid">
                    {group.songs.map((song) => (
                      <SongItem key={song._id} song={song} queue={group.songs} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        <aside className="explore-recommend-panel">
          <div className="now-exploring-card">
            <span className="pulse-dot"></span>
            <h3>Now Exploring</h3>

            {topTenLoading ? (
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
                  <span>{heroSong.country || selectedCountry}</span>
                  <span>{heroSong.mood || "Mood"}</span>
                  <span>{heroSong.genre || "Genre"}</span>
                </div>
              </>
            ) : (
              <p>No song selected</p>
            )}
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
        </aside>
      </section>
    </div>
  );
};

export default Explore;