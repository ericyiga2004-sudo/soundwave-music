import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { FaPlay } from "react-icons/fa";
import "./Albums.css";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

const MAX_ALBUM_STATS_SONGS = 400;

const getAlbumIdFromSong = (song) => {
  return (
    song?.album?._id ||
    song?.album ||
    song?.albumId ||
    ""
  ).toString();
};

const getArtistIdFromAlbum = (album) => {
  return (
    album?.artist?._id ||
    album?.artist ||
    album?.artistId ||
    ""
  ).toString();
};

const getArtistIdFromSong = (song) => {
  return (
    song?.artist?._id ||
    song?.artist ||
    song?.artistId ||
    ""
  ).toString();
};

const getPreferenceArtistId = (item) => {
  return (
    item?.artist?._id ||
    item?.artist ||
    ""
  ).toString();
};

const buildPreferenceScoreMap = (items = [], key = "name") => {
  const map = new Map();

  items.forEach((item) => {
    const value =
      key === "artist" ? getPreferenceArtistId(item) : item?.[key];

    if (value !== undefined && value !== null && value !== "") {
      map.set(value.toString().toLowerCase(), Number(item.score || 0));
    }
  });

  return map;
};

const getTopValueFromMap = (countMap) => {
  let topValue = "";
  let topCount = 0;

  countMap.forEach((count, value) => {
    if (count > topCount) {
      topValue = value;
      topCount = count;
    }
  });

  return topValue;
};

const addCount = (map, value) => {
  if (!value) return;

  const key = value.toString();

  map.set(key, Number(map.get(key) || 0) + 1);
};

const buildAlbumSongStats = ({
  songs = [],
  countryScoreMap = new Map(),
  genreScoreMap = new Map(),
  moodScoreMap = new Map(),
  languageScoreMap = new Map(),
  yearScoreMap = new Map(),
  artistScoreMap = new Map(),
}) => {
  const statsMap = new Map();

  songs.forEach((song) => {
    const albumId = getAlbumIdFromSong(song);

    if (!albumId) return;

    const current = statsMap.get(albumId) || {
      songCount: 0,
      totalLikes: 0,
      totalPlays: 0,

      countryScore: 0,
      genreScore: 0,
      moodScore: 0,
      languageScore: 0,
      yearScore: 0,
      artistScore: 0,

      countryCounts: new Map(),
      genreCounts: new Map(),
      moodCounts: new Map(),
    };

    const artistId = getArtistIdFromSong(song);
    const country = song.country?.toString();
    const genre = song.genre?.toString();
    const mood = song.mood?.toString();
    const language = song.songLanguage?.toString();
    const year = song.releaseYear?.toString();

    current.songCount += 1;
    current.totalLikes += Number(song.likes || 0);
    current.totalPlays += Number(song.plays || 0);

    current.countryScore += Number(
      countryScoreMap.get(country?.toLowerCase()) || 0
    );

    current.genreScore += Number(
      genreScoreMap.get(genre?.toLowerCase()) || 0
    );

    current.moodScore += Number(
      moodScoreMap.get(mood?.toLowerCase()) || 0
    );

    current.languageScore += Number(
      languageScoreMap.get(language?.toLowerCase()) || 0
    );

    current.yearScore += Number(
      yearScoreMap.get(year?.toLowerCase()) || 0
    );

    current.artistScore += Number(
      artistScoreMap.get(artistId?.toLowerCase()) || 0
    );

    addCount(current.countryCounts, country);
    addCount(current.genreCounts, genre);
    addCount(current.moodCounts, mood);

    statsMap.set(albumId, current);
  });

  return statsMap;
};

const sortAlbumsByUserTaste = ({
  albums = [],
  songs = [],
  preferences = {},
}) => {
  const artistScoreMap = buildPreferenceScoreMap(
    preferences.artists || [],
    "artist"
  );

  const countryScoreMap = buildPreferenceScoreMap(
    preferences.countries || [],
    "name"
  );

  const genreScoreMap = buildPreferenceScoreMap(
    preferences.genres || [],
    "name"
  );

  const moodScoreMap = buildPreferenceScoreMap(
    preferences.moods || [],
    "name"
  );

  const languageScoreMap = buildPreferenceScoreMap(
    preferences.languages || [],
    "name"
  );

  const yearScoreMap = buildPreferenceScoreMap(
    preferences.years || [],
    "year"
  );

  const albumSongStatsMap = buildAlbumSongStats({
    songs,
    countryScoreMap,
    genreScoreMap,
    moodScoreMap,
    languageScoreMap,
    yearScoreMap,
    artistScoreMap,
  });

  return [...albums]
    .map((album) => {
      const albumId = album._id?.toString();
      const albumArtistId = getArtistIdFromAlbum(album);

      const artistCountry =
        album?.artist?.country ||
        album?.country ||
        "";

      const stats = albumSongStatsMap.get(albumId) || {
        songCount: Array.isArray(album.songs) ? album.songs.length : 0,
        totalLikes: 0,
        totalPlays: Number(album.totalPlays || 0),

        countryScore: 0,
        genreScore: 0,
        moodScore: 0,
        languageScore: 0,
        yearScore: 0,
        artistScore: 0,

        countryCounts: new Map(),
        genreCounts: new Map(),
        moodCounts: new Map(),
      };

      const albumArtistScore = Number(
        artistScoreMap.get(albumArtistId?.toLowerCase()) || 0
      );

      const albumCountryScore = Number(
        countryScoreMap.get(artistCountry?.toString().toLowerCase()) || 0
      );

      const rankingScore =
        albumArtistScore * 1500 +
        stats.artistScore * 800 +
        albumCountryScore * 400 +
        stats.countryScore * 250 +
        stats.genreScore * 200 +
        stats.moodScore * 150 +
        stats.languageScore * 90 +
        stats.yearScore * 50 +
        stats.totalLikes * 10 +
        stats.totalPlays * 2 +
        Number(album.totalPlays || 0) * 2 +
        stats.songCount * 25;

      return {
        ...album,
        rankingScore,
        albumStats: {
          ...stats,
          topCountry: getTopValueFromMap(stats.countryCounts),
          topGenre: getTopValueFromMap(stats.genreCounts),
          topMood: getTopValueFromMap(stats.moodCounts),
        },
      };
    })
    .sort((a, b) => {
      if (b.rankingScore !== a.rankingScore) {
        return b.rankingScore - a.rankingScore;
      }

      if (b.albumStats.totalLikes !== a.albumStats.totalLikes) {
        return b.albumStats.totalLikes - a.albumStats.totalLikes;
      }

      if (b.albumStats.totalPlays !== a.albumStats.totalPlays) {
        return b.albumStats.totalPlays - a.albumStats.totalPlays;
      }

      return Number(b.totalPlays || 0) - Number(a.totalPlays || 0);
    });
};

const Albums = () => {
  const [albums, setAlbums] = useState([]);
  const [songsForStats, setSongsForStats] = useState([]);
  const [preferences, setPreferences] = useState({});
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  const fetchAlbums = async () => {
    try {
      setLoading(true);

      const token = localStorage.getItem("token");

      const albumsRequest = axios.get(`${backendUrl}/api/albums`);

      const songsRequest = axios.get(
        `${backendUrl}/api/songs?limit=${MAX_ALBUM_STATS_SONGS}&sort=popular`
      );

      const preferencesRequest = token
        ? axios.get(`${backendUrl}/api/recommend/preferences`, {
            headers: {
              token,
            },
          })
        : Promise.resolve({
            data: {
              success: true,
              preferences: {},
            },
          });

      const [albumsRes, songsRes, preferencesRes] = await Promise.all([
        albumsRequest,
        songsRequest,
        preferencesRequest,
      ]);

      if (albumsRes.data.success) {
        setAlbums(Array.isArray(albumsRes.data.albums) ? albumsRes.data.albums : []);
      } else {
        setAlbums([]);
      }

      if (songsRes.data.success) {
        setSongsForStats(Array.isArray(songsRes.data.songs) ? songsRes.data.songs : []);
      } else {
        setSongsForStats([]);
      }

      if (preferencesRes.data.success) {
        setPreferences(preferencesRes.data.preferences || {});
      } else {
        setPreferences({});
      }
    } catch (error) {
      console.log("Fetch albums error:", error);
      setAlbums([]);
      setSongsForStats([]);
      setPreferences({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlbums();

    window.addEventListener("music-history-updated", fetchAlbums);
    window.addEventListener("music-liked-updated", fetchAlbums);
    window.addEventListener("artist-follow-updated", fetchAlbums);

    return () => {
      window.removeEventListener("music-history-updated", fetchAlbums);
      window.removeEventListener("music-liked-updated", fetchAlbums);
      window.removeEventListener("artist-follow-updated", fetchAlbums);
    };
  }, []);

  const sortedAlbums = useMemo(() => {
    return sortAlbumsByUserTaste({
      albums,
      songs: songsForStats,
      preferences,
    });
  }, [albums, songsForStats, preferences]);

  if (loading) {
    return <div className="albums-loading">Loading albums...</div>;
  }

  if (!loading && sortedAlbums.length === 0) {
    return null;
  }

  return (
    <section className="albums-section">
      <div className="albums-header">
        <div>
          <span>FULL COLLECTIONS</span>
          <h2>Albums 💿</h2>
        </div>

        <button
          className="view-albums-btn"
          onClick={() => navigate("/albums")}
        >
          View All
        </button>
      </div>

      <div className="albums-scroll-wrapper">
        <div className="albums-grid">
          {sortedAlbums.map((album) => {
            const albumImage =
              album.coverImage ||
              album.imageUrl ||
              album.image ||
              "/fallback-cover.png";

            const artistName =
              album.artist?.name ||
              album.artistName ||
              "Unknown Artist";

            const songCount =
              album.albumStats?.songCount ||
              album.songs?.length ||
              0;

            const displayGenre =
              album.albumStats?.topGenre ||
              album.genre ||
              album.albumStats?.topMood ||
              "Mixed";

            return (
              <div key={album._id} className="featured-album-card">
                <img
                  src={albumImage}
                  alt={album.title || "Album cover"}
                  className="featured-bg"
                  onClick={() => {
                    navigate(`/album/${album._id}`, {
                      state: {
                        album,
                      },
                    });

                    window.scrollTo(0, 0);
                  }}
                  style={{ cursor: "pointer" }}
                />

                <div className="featured-overlay">
                  <span className="album-label">
                    FEATURED ALBUM
                  </span>

                  <h3>{album.title || "Untitled Album"}</h3>
                  <p>{artistName}</p>

                  <div className="album-details">
                    <span>
                      {songCount} {songCount === 1 ? "Song" : "Songs"}
                    </span>

                    <span>{displayGenre}</span>
                  </div>

                  <div className="album-actions">
                    <button
                      type="button"
                      onClick={() => {
                        navigate(`/album/${album._id}`, {
                          state: {
                            album,
                          },
                        });

                        window.scrollTo(0, 0);
                      }}
                    >
                      <FaPlay />
                      Play
                    </button>

                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        navigate(`/album/${album._id}`, {
                          state: {
                            album,
                          },
                        });

                        window.scrollTo(0, 0);
                      }}
                    >
                      View
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Albums;