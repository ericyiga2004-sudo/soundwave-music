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

const normalizeSongs = (songs = []) => {
  const seen = new Set();

  return songs.filter((song) => {
    if (!song?._id || seen.has(song._id)) return false;

    seen.add(song._id);
    return true;
  });
};

const YearSongSkeleton = () => {
  return (
    <div className="col-6 col-md-4 col-lg-2">
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

            url.searchParams.set("fromYear", String(section.fromYear));
            url.searchParams.set("toYear", String(section.toYear));
            url.searchParams.set("limit", "6");
            url.searchParams.set("sort", "popular");

            const res = await fetch(url.toString());

            if (!res.ok) {
              throw new Error(`Request failed with status ${res.status}`);
            }

            const data = await res.json();

            console.log("YEAR SECTION RESPONSE:", section.title, {
              url: url.toString(),
              total: data.total,
              songs: data.songs,
            });

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

  const handlePlaySong = (event, song, sectionSongs) => {
    event.preventDefault();
    event.stopPropagation();

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
                    onClick={() => window.scrollTo(0, 0)}
                    to={`/yearly/${section.slug}`}
                    className="btn btn-light year-view-btn"
                  >
                    View All
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
                ) : section.songs.length > 0 ? (
                  <div className="row g-3 mt-2">
                    {section.songs.map((song) => (
                      <div className="col-6 col-md-4 col-lg-2" key={song._id}>
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
                                src={song.imageUrl || "/fallback-cover.png"}
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
                              <span>{song.releaseYear || "Unknown year"}</span>
                            </div>
                          </Link>
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