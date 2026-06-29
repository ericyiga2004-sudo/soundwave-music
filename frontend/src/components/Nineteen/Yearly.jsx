import React, { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaPlay } from "react-icons/fa";
import { MusicPlayerContext } from "../../context/MainPlayerContext";
import "./Yearly.css";

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;

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
    title: "2010s Hits",
    subtitle: "Popular songs from 2010 to 2019",
    fromYear: 2010,
    toYear: 2019,
    slug: "2010s",
    banner:
      "https://images.unsplash.com/photo-1507874457470-272b3c8d8ee2?auto=format&fit=crop&w=1600&q=80",
  },
  {
    title: "2020 Collection",
    subtitle: "Songs released in 2020",
    fromYear: 2020,
    toYear: 2020,
    slug: "2020",
    banner:
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1600&q=80",
  },
  {
    title: "2026 Fresh Sounds",
    subtitle: "New music from 2026",
    fromYear: 2026,
    toYear: 2026,
    slug: "2026",
    banner:
      "https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=1600&q=80",
  },
];

const normalizeSongs = (songs = []) => {
  const seen = new Set();

  return songs.filter((song) => {
    if (!song?._id || seen.has(song._id)) return false;

    seen.add(song._id);
    return true;
  });
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

  useEffect(() => {
    const fetchSections = async () => {
      if (!API_BASE_URL) {
        console.error("VITE_BACKEND_URL is missing");

        setSections((prev) =>
          prev.map((section) => ({
            ...section,
            loading: false,
            error: "Backend URL is missing.",
          }))
        );

        return;
      }

      try {
        const results = await Promise.allSettled(
          yearSections.map(async (section) => {
            const url = new URL("/api/songs/filter", API_BASE_URL);

            url.searchParams.set("fromYear", section.fromYear);
            url.searchParams.set("toYear", section.toYear);
            url.searchParams.set("limit", "6");
            url.searchParams.set("sort", "popular");

            const res = await fetch(url.toString());

            if (!res.ok) {
              throw new Error(`Request failed with status ${res.status}`);
            }

            const data = await res.json();

            return {
              ...section,
              songs: data.success ? data.songs || [] : [],
              loading: false,
              error: data.success ? "" : data.message || "Failed to load songs",
            };
          })
        );

        const updatedSections = results.map((result, index) => {
          if (result.status === "fulfilled") {
            return result.value;
          }

          console.error(
            `Failed to fetch songs for ${yearSections[index].title}:`,
            result.reason
          );

          return {
            ...yearSections[index],
            songs: [],
            loading: false,
            error: "Could not load songs for this collection.",
          };
        });

        setSections(updatedSections);
      } catch (error) {
        console.error("Failed to fetch yearly songs:", error);

        setSections((prev) =>
          prev.map((section) => ({
            ...section,
            loading: false,
            error: "Could not load songs.",
          }))
        );
      }
    };

    fetchSections();
  }, []);

  const handlePlaySong = (song, sectionSongs) => {
    const playlist = normalizeSongs(sectionSongs);

    playSong(song, playlist);
  };

  return (
    <main className="yearly-page">
      <div className="container py-4 py-lg-5">
        <div className="yearly-header mb-4">
          <span className="yearly-kicker">Browse by year</span>
          <h1>Yearly Music Collections</h1>
          <p>
            Explore classics, decade hits, and fresh releases grouped by release
            year.
          </p>
        </div>

        <div className="yearly-sections">
          {sections.map((section) => {
            const playlist = normalizeSongs(section.songs);

            return (
              <section className="year-block" key={section.slug}>
                <div
                  className="year-banner"
                  style={{
                    backgroundImage: `linear-gradient(90deg, rgba(5, 5, 12, 0.92), rgba(5, 5, 12, 0.38)), url(${section.banner})`,
                  }}
                >
                  <div className="year-banner-content">
                    <span className="year-range">
                      {section.fromYear === section.toYear
                        ? section.fromYear
                        : `${section.fromYear} - ${section.toYear}`}
                    </span>

                    <h2>{section.title}</h2>
                    <p>{section.subtitle}</p>
                  </div>

                  <Link
                    to={`/yearly/${section.slug}`}
                    className="btn btn-light year-view-btn"
                  >
                    View All
                  </Link>
                </div>

                {section.loading ? (
                  <div className="year-loading">Loading songs...</div>
                ) : section.error ? (
                  <div className="year-empty">{section.error}</div>
                ) : section.songs.length > 0 ? (
                  <div className="row g-3 mt-2">
                    {section.songs.map((song) => (
                      <div className="col-6 col-md-4 col-lg-2" key={song._id}>
                        <div
                          className="year-song-card"
                          onClick={() => handlePlaySong(song, playlist)}
                        >
                          <Link
                            to={`/song/${song._id}`}
                            state={{
                              playlist,
                            }}
                            className="year-song-link text-decoration-none"
                          >
                            <div className="year-song-img-wrap">
                              <img
                                src={song.imageUrl || "/fallback-cover.png"}
                                alt={song.title || "Song cover"}
                                className="year-song-img"
                                loading="lazy"
                              />

                              <div className="year-play-btn">
                                <FaPlay />
                              </div>
                            </div>

                            <div className="year-song-info">
                              <h3>{song.title || "Unknown Song"}</h3>
                              <p>
                                {song.artist?.name ||
                                  song.artist?.artistName ||
                                  "Unknown Artist"}
                              </p>
                              <span>{song.releaseYear || "Unknown year"}</span>
                            </div>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="year-empty">
                    No songs found for this collection yet.
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
};

export default Yearly;