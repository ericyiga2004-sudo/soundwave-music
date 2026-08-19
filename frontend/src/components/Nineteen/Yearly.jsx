import SongActionMenu from "../SongActions/SongActionMenu";
import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaPlay } from "react-icons/fa";
import { MusicPlayerContext } from "../../context/MainPlayerContext";
import "./Yearly.css";

import { API_BASE_URL } from "../../config/api";

const yearSections = [
  {
    title: "1900s Classics",
    subtitle: "Old-school gems from 1900 to 1999",
    fromYear: 1900,
    toYear: 1999,
    slug: "1900s",
    banner:
      "https://images.unsplash.com/photo-1494232410401-ad00d5433cfa?auto=format&fit=crop&w=1600&q=80",
  },
  {
    title: "2000s Hits",
    subtitle: "Popular songs from 2000 to 2009",
    fromYear: 2000,
    toYear: 2009,
    slug: "2000s",
    banner:
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1600&q=80",
  },
  {
    title: "2010s Hits",
    subtitle: "Popular songs from 2010 to 2019",
    fromYear: 2010,
    toYear: 2019,
    slug: "2010s",
    banner:
      "https://images.unsplash.com/photo-1507874457470-272b3c8d8ee2?auto=format&fit=crop&w=1600&q=80",
  },
  {
    title: "2020s Hits",
    subtitle: "Popular songs from 2020 to 2026",
    fromYear: 2020,
    toYear: 2026,
    slug: "2020s",
    banner:
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1600&q=80",
  },
];

const skeletonCards = Array.from({ length: 6 });

const normalizeText = (value) => {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

const normalizeSongs = (songs = []) => {
  const seen = new Set();

  return songs.filter((song) => {
    if (!song?._id || seen.has(song._id)) return false;

    seen.add(song._id);
    return true;
  });
};

const getSongCountry = (song) => {
  return song?.country || song?.artist?.country || song?.album?.country || "";
};

const getDateValue = (song = {}) => {
  const value =
    song.releaseDate ||
    song.createdAt ||
    song.updatedAt ||
    song.uploadedAt ||
    song.uploadTime;

  if (!value) return 0;

  const dateValue =
    typeof value === "number" ? value : new Date(value).getTime();

  return Number.isNaN(dateValue) ? 0 : dateValue;
};

const buildRankMap = (items = [], key = "name") => {
  const map = new Map();

  items.forEach((item, index) => {
    const value = item?.[key];

    if (value !== undefined && value !== null && value !== "") {
      map.set(normalizeText(value), index);
    }
  });

  return map;
};

const sortSongsByUserTaste = (songs = [], preferences = {}) => {
  const countryRank = buildRankMap(preferences.countries || [], "name");
  const genreRank = buildRankMap(preferences.genres || [], "name");
  const moodRank = buildRankMap(preferences.moods || [], "name");
  const languageRank = buildRankMap(preferences.languages || [], "name");

  return normalizeSongs(songs).sort((a, b) => {
    const countryA = normalizeText(getSongCountry(a));
    const countryB = normalizeText(getSongCountry(b));

    const genreA = normalizeText(a.genre);
    const genreB = normalizeText(b.genre);

    const moodA = normalizeText(a.mood);
    const moodB = normalizeText(b.mood);

    const languageA = normalizeText(a.songLanguage);
    const languageB = normalizeText(b.songLanguage);

    const countryRankA = countryRank.has(countryA)
      ? countryRank.get(countryA)
      : 999;

    const countryRankB = countryRank.has(countryB)
      ? countryRank.get(countryB)
      : 999;

    // 1. User preferred country first
    if (countryRankA !== countryRankB) {
      return countryRankA - countryRankB;
    }

    // 2. Most listened songs in that country
    const playsA = Number(a.plays || 0);
    const playsB = Number(b.plays || 0);

    if (playsB !== playsA) {
      return playsB - playsA;
    }

    // 3. User preferred genre
    const genreRankA = genreRank.has(genreA) ? genreRank.get(genreA) : 999;
    const genreRankB = genreRank.has(genreB) ? genreRank.get(genreB) : 999;

    if (genreRankA !== genreRankB) {
      return genreRankA - genreRankB;
    }

    // 4. User preferred mood
    const moodRankA = moodRank.has(moodA) ? moodRank.get(moodA) : 999;
    const moodRankB = moodRank.has(moodB) ? moodRank.get(moodB) : 999;

    if (moodRankA !== moodRankB) {
      return moodRankA - moodRankB;
    }

    // 5. User preferred language
    const languageRankA = languageRank.has(languageA)
      ? languageRank.get(languageA)
      : 999;

    const languageRankB = languageRank.has(languageB)
      ? languageRank.get(languageB)
      : 999;

    if (languageRankA !== languageRankB) {
      return languageRankA - languageRankB;
    }

    // 6. Most liked
    const likesA = Number(a.likes || 0);
    const likesB = Number(b.likes || 0);

    if (likesB !== likesA) {
      return likesB - likesA;
    }

    // 7. Backend recommendation score
    const scoreA = Number(a.recommendationScore || 0);
    const scoreB = Number(b.recommendationScore || 0);

    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }

    // 8. Newest tie-breaker
    return getDateValue(b) - getDateValue(a);
  });
};

const YearSongSkeleton = () => {
  return (
    <div className="col-6 col-sm-4 col-md-3 col-lg-2">
      <div className="year-song-card year-song-skeleton" aria-hidden="true">
        <div className="year-song-img-wrap skeleton-img"></div>

        <div className="year-song-info">
          <div className="skeleton-line skeleton-title"></div>
          <div className="skeleton-line skeleton-artist"></div>
          <div className="skeleton-line skeleton-year"></div>
        </div>
      </div>
    </div>
  );
};

const Yearly = () => {
  const { playSong } = useContext(MusicPlayerContext);

  const [sections, setSections] = useState(
    yearSections.map((section) => ({
      ...section,
      songs: [],
      loading: true,
      error: "",
    }))
  );

  const [preferences, setPreferences] = useState({});

  const fetchSections = async () => {
    try {
      const token = String(localStorage.getItem("token") || "").trim();

      let fetchedPreferences = {};
      if (token) {
        try {
          const preferencesRes = await fetch(
            `${API_BASE_URL}/api/recommend/preferences`,
            { headers: { token } }
          );
          if (preferencesRes.ok) {
            const preferencesData = await preferencesRes.json();
            if (preferencesData.success) {
              fetchedPreferences = preferencesData.preferences || {};
            }
          }
        } catch (error) {
          console.log("Yearly preferences unavailable:", error);
        }
      }

      setPreferences(fetchedPreferences);

      const results = await Promise.allSettled(
        yearSections.map(async (section) => {
          const url = new URL("/api/songs/filter", API_BASE_URL);
          url.searchParams.set("fromYear", String(section.fromYear));
          url.searchParams.set("toYear", String(section.toYear));
          url.searchParams.set("limit", "8");
          url.searchParams.set("sort", "popular");

          const res = await fetch(url.toString());
          if (!res.ok) {
            throw new Error(`Request failed with status ${res.status}`);
          }

          const data = await res.json();
          const fetchedSongs = data.success ? data.songs || [] : [];

          const sortedSongs = token
            ? sortSongsByUserTaste(fetchedSongs, fetchedPreferences)
            : normalizeSongs(fetchedSongs).sort((a, b) => {
                const playsA = Number(a.plays || 0);
                const playsB = Number(b.plays || 0);
                if (playsB !== playsA) return playsB - playsA;

                const likesA = Number(a.likes || 0);
                const likesB = Number(b.likes || 0);
                if (likesB !== likesA) return likesB - likesA;

                return getDateValue(b) - getDateValue(a);
              });

          return {
            ...section,
            songs: sortedSongs.slice(0, 6),
            loading: false,
            error: "",
          };
        })
      );

      setSections(
        results.map((result, index) => {
          if (result.status === "fulfilled") return result.value;
          return {
            ...yearSections[index],
            songs: [],
            loading: false,
            error: "Could not load this collection.",
          };
        })
      );
    } catch (error) {
      console.log("Yearly sections error:", error);
      setSections(
        yearSections.map((section) => ({
          ...section,
          songs: [],
          loading: false,
          error: "Could not load this collection.",
        }))
      );
    }
  };

  useEffect(() => {
    fetchSections();

    window.addEventListener("music-history-updated", fetchSections);
    window.addEventListener("music-liked-updated", fetchSections);
    window.addEventListener("artist-follow-updated", fetchSections);
    window.addEventListener("soundwave-personalization-updated", fetchSections);

    return () => {
      window.removeEventListener("music-history-updated", fetchSections);
      window.removeEventListener("music-liked-updated", fetchSections);
      window.removeEventListener("artist-follow-updated", fetchSections);
      window.removeEventListener("soundwave-personalization-updated", fetchSections);
    };
  }, []);

  const handlePlaySong = (event, song, sectionSongs) => {
    event.preventDefault();
    event.stopPropagation();

    const playlist = sortSongsByUserTaste(sectionSongs, preferences);

    playSong(song, playlist);
  };

  return (
    <main className="yearly-page">
      <div className="container-fluid px-0">
        <div className="yearly-header mb-4">
          <span className="yearly-kicker">Browse by year</span>

          <h1>Yearly Music Collections</h1>

          <p>
            Explore decade hits ranked by your likes, plays, favorite country,
            genre, and mood.
          </p>
        </div>

        <div className="yearly-sections">
          {sections.map((section) => {
            const playlist = sortSongsByUserTaste(section.songs, preferences);

            return (
              <section className="year-block" key={section.slug}>
                <div className="year-banner">
                  <img className="year-banner-art" src={section.banner} alt="" loading="lazy" decoding="async" />
                  <div className="year-banner-content">
                    <span className="year-range">
                      {section.fromYear === section.toYear ? section.fromYear : `${section.fromYear} - ${section.toYear}`}
                    </span>
                    <h2>{section.title}</h2>
                    <p>{section.subtitle}</p>
                  </div>
                  <Link
                    onClick={() => window.scrollTo(0, 0)}
                    to={`/yearly/${section.slug}`}
                    className="year-view-btn"
                  >
                    See All
                  </Link>
                </div>

                {section.loading ? (
                  <div className="row g-3 mt-2">
                    {skeletonCards.map((_, index) => (
                      <YearSongSkeleton
                        key={`${section.slug}-skeleton-${index}`}
                      />
                    ))}
                  </div>
                ) : section.error ? (
                  <div className="year-section-error">{section.error}</div>
                ) : playlist.length > 0 ? (
                  <div className="row g-3 mt-2">
                    {playlist.map((song) => (
                      <div className="col-6 col-sm-4 col-md-3 col-lg-2" key={song._id}>
                        <div className="year-song-card">
                          <Link
                            to={`/song/${song._id}`}
                            state={{
                              playlist,
                            }}
                            className="year-song-link text-decoration-none"
                            onClick={() => window.scrollTo(0, 0)}
                          >
                            <div className="year-song-img-wrap">
                              <img
                                src={song.imageUrl || "/fallback-cover.svg"}
                                alt={song.title || "Song cover"}
                                className="year-song-img"
                                loading="lazy"
                              />

                              <button
                                type="button"
                                className="year-play-btn"
                                aria-label={`Play ${
                                  song.title || "this song"
                                }`}
                                onClick={(event) =>
                                  handlePlaySong(event, song, playlist)
                                }
                              >
                                <FaPlay />
                              </button>
                            </div>

                            <div className="year-song-info">
                              <h3>{song.title || "Unknown Song"}</h3>

                              <p>
                                {song.artist?.name ||
                                  song.artist?.artistName ||
                                  "Unknown Artist"}
                              </p>

                              <span>
                                {song.releaseYear || "Unknown year"}
                                {getSongCountry(song)
                                  ? ` • ${getSongCountry(song)}`
                                  : ""}
                              </span>
                            </div>
                          </Link>
                          <SongActionMenu song={song} queue={playlist} triggerClassName="sw2324-overlay-more sw2324-yearly-more" triggerLabel={`More options for ${song.title}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
};

export default Yearly;