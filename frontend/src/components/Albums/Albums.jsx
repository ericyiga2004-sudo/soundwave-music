import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { FaPlay } from "react-icons/fa";
import "./Albums.css";

import { API_BASE_URL as backendUrl } from "../../config/api";

const MAX_ALBUM_STATS_SONGS = 80;

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
      map.set(value.toString().toLowerCase(), Number(item.effectiveScore ?? item.score ?? 0));
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

  const albumScoreMap = new Map(
    (preferences.albums || []).map((item) => [
      String(item?.album?._id || item?.album || "").toLowerCase(),
      Number(item?.effectiveScore ?? item?.score ?? 0),
    ]).filter(([id]) => id)
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

      const directAlbumScore = Number(
        albumScoreMap.get(albumId?.toLowerCase()) || 0
      );

      const albumArtistScore = Number(
        artistScoreMap.get(albumArtistId?.toLowerCase()) || 0
      );

      const albumCountryScore = Number(
        countryScoreMap.get(artistCountry?.toString().toLowerCase()) || 0
      );

      const rankingScore =
        directAlbumScore * 1800 +
        albumArtistScore * 900 +
        stats.artistScore * 500 +
        albumCountryScore * 180 +
        stats.countryScore * 100 +
        stats.genreScore * 160 +
        stats.moodScore * 90 +
        stats.languageScore * 150 +
        stats.yearScore * 35 +
        Math.log1p(stats.totalLikes) * 18 +
        Math.log1p(stats.totalPlays) * 9 +
        Math.log1p(Number(album.totalPlays || 0)) * 9 +
        stats.songCount * 8;

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

      const token = String(localStorage.getItem("token") || "").trim();

      // Albums and song statistics are public catalog data and always load first.
      const [albumsRes, songsRes] = await Promise.all([
        axios.get(`${backendUrl}/api/albums?limit=36&sort=popular`),
        axios.get(`${backendUrl}/api/songs?limit=${MAX_ALBUM_STATS_SONGS}&sort=popular`),
      ]);

      setAlbums(
        albumsRes.data?.success && Array.isArray(albumsRes.data.albums)
          ? albumsRes.data.albums
          : []
      );
      setSongsForStats(
        songsRes.data?.success && Array.isArray(songsRes.data.songs)
          ? songsRes.data.songs
          : []
      );

      // Preferences improve ranking only; they can never block the album catalog.
      if (token) {
        try {
          const preferencesRes = await axios.get(
            `${backendUrl}/api/recommend/preferences`,
            { headers: { token } }
          );
          setPreferences(
            preferencesRes.data?.success ? preferencesRes.data.preferences || {} : {}
          );
        } catch (error) {
          console.log("Album preferences unavailable:", error);
          setPreferences({});
        }
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
    window.addEventListener("soundwave-personalization-updated", fetchAlbums);

    return () => {
      window.removeEventListener("music-history-updated", fetchAlbums);
      window.removeEventListener("music-liked-updated", fetchAlbums);
      window.removeEventListener("artist-follow-updated", fetchAlbums);
      window.removeEventListener("soundwave-personalization-updated", fetchAlbums);
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
    return (
      <section className="albums-section container-fluid px-3 px-sm-4 px-xl-5">
        <div className="albums-header d-flex align-items-end justify-content-between gap-3">
          <div>
            <span>Full collections</span>
            <h2>Albums</h2>
          </div>
        </div>
        <div className="row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-xl-6 g-3 g-lg-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="col" key={index}>
              <div className="album-home-skeleton">
                <span className="album-home-skeleton-cover" />
                <span className="album-home-skeleton-line" />
                <span className="album-home-skeleton-line short" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!loading && sortedAlbums.length === 0) {
    return null;
  }

  const visibleAlbums = sortedAlbums.slice(0, 6);

  return (
    <section className="albums-section container-fluid px-3 px-sm-4 px-xl-5">
      <div className="albums-header d-flex align-items-end justify-content-between gap-3">
        <div>
          <span>Full collections</span>
          <h2>Albums</h2>
          <p>Complete releases from artists in your catalog.</p>
        </div>

        <button
          type="button"
          className="view-albums-btn"
          onClick={() => navigate("/albums")}
        >
          View All
        </button>
      </div>

      <div className="row row-cols-2 row-cols-sm-3 row-cols-md-4 row-cols-xl-6 g-3 g-lg-4">
        {visibleAlbums.map((album) => {
          const albumImage =
            album.coverImage ||
            album.imageUrl ||
            album.image ||
            "/fallback-cover.svg";

          const artistName =
            album.artist?.name ||
            album.artistName ||
            "Unknown Artist";

          const songCount =
            album.albumStats?.songCount ||
            album.songs?.length ||
            0;

          const openAlbum = () => {
            navigate(`/album/${album._id}`, { state: { album } });
            window.scrollTo(0, 0);
          };

          return (
            <div className="col" key={album._id}>
              <article className="featured-album-card h-100">
                <button
                  type="button"
                  className="album-home-cover-button"
                  onClick={openAlbum}
                  aria-label={`Open ${album.title || "album"}`}
                >
                  <span className="album-home-cover">
                    <img
                      src={albumImage}
                      alt={album.title || "Album cover"}
                      className="featured-bg"
                      loading="lazy"
                      decoding="async"
                    />
                    <span className="album-home-play" aria-hidden="true">
                      <FaPlay />
                    </span>
                  </span>
                </button>

                <button type="button" className="album-home-copy" onClick={openAlbum}>
                  <h3>{album.title || "Untitled Album"}</h3>
                  <p>{artistName}</p>
                  <small>
                    {songCount} {songCount === 1 ? "song" : "songs"}
                  </small>
                </button>
              </article>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default Albums;