import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  Search,
  X,
  ChevronDown,
  Music2,
  Disc3,
  User,
} from "lucide-react";
import { MusicPlayerContext } from "../../context/MainPlayerContext";
import "./SearchModel.css";

import { API_BASE_URL } from "../../config/api";
import { trackTasteEvent } from "../../utils/personalization";

const MAX_SONG_POOL = 36;
const MAX_SONG_RESULTS = 15;
const MAX_ARTIST_RESULTS = 8;
const MAX_ALBUM_RESULTS = 8;

const normalizeText = (value) => {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const uniqueById = (items = []) => {
  const seen = new Set();

  return items.filter((item) => {
    if (!item?._id) return false;

    const id = item._id.toString();

    if (seen.has(id)) return false;

    seen.add(id);
    return true;
  });
};

const buildPlaylist = (selectedSong, songs = []) => {
  if (!selectedSong?._id) return [];

  return uniqueById([
    selectedSong,
    ...songs.filter((song) => song?._id !== selectedSong._id),
  ]);
};

const levenshteinDistance = (a = "", b = "") => {
  const s = normalizeText(a);
  const t = normalizeText(b);

  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;

  const matrix = Array.from({ length: s.length + 1 }, () =>
    Array(t.length + 1).fill(0)
  );

  for (let i = 0; i <= s.length; i += 1) {
    matrix[i][0] = i;
  }

  for (let j = 0; j <= t.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s.length; i += 1) {
    for (let j = 1; j <= t.length; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;

      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[s.length][t.length];
};

const similarityScore = (a = "", b = "") => {
  const s = normalizeText(a);
  const t = normalizeText(b);

  if (!s || !t) return 0;

  if (s === t) return 100;

  if (s.includes(t)) {
    return 94 - Math.min(20, s.length - t.length);
  }

  if (t.includes(s)) {
    return 88 - Math.min(20, t.length - s.length);
  }

  const distance = levenshteinDistance(s, t);
  const longest = Math.max(s.length, t.length);

  if (!longest) return 0;

  return Math.max(0, Math.round((1 - distance / longest) * 100));
};

const getBestTokenSimilarity = (fieldValue, query) => {
  const field = normalizeText(fieldValue);
  const search = normalizeText(query);

  if (!field || !search) return 0;

  const queryTokens = search.split(" ").filter(Boolean);
  const fieldTokens = field.split(" ").filter(Boolean);

  let total = 0;

  queryTokens.forEach((queryToken) => {
    let best = 0;

    fieldTokens.forEach((fieldToken) => {
      const score = similarityScore(fieldToken, queryToken);

      if (score > best) {
        best = score;
      }
    });

    total += best;
  });

  return total;
};

const scoreField = (fieldValue, query, weight = 1) => {
  const field = normalizeText(fieldValue);
  const search = normalizeText(query);

  if (!field || !search) return 0;

  let score = 0;

  if (field === search) {
    score += 160;
  } else if (field.startsWith(search)) {
    score += 130;
  } else if (field.includes(search)) {
    score += 105;
  }

  score += getBestTokenSimilarity(field, search);

  return score * weight;
};

const getMatchPriority = ({
  query,
  mainFields = [],
  secondaryFields = [],
}) => {
  const search = normalizeText(query);

  if (!search) return 99;

  const cleanMainFields = mainFields.map(normalizeText).filter(Boolean);
  const cleanSecondaryFields = secondaryFields.map(normalizeText).filter(Boolean);

  if (cleanMainFields.some((field) => field === search)) return 0;
  if (cleanMainFields.some((field) => field.startsWith(search))) return 1;
  if (cleanMainFields.some((field) => field.includes(search))) return 2;

  const mainSimilarity = Math.max(
    0,
    ...cleanMainFields.map((field) => similarityScore(field, search))
  );

  if (mainSimilarity >= 88) return 3;
  if (mainSimilarity >= 75) return 4;

  if (cleanSecondaryFields.some((field) => field === search)) return 5;
  if (cleanSecondaryFields.some((field) => field.startsWith(search))) return 6;
  if (cleanSecondaryFields.some((field) => field.includes(search))) return 7;

  const secondarySimilarity = Math.max(
    0,
    ...cleanSecondaryFields.map((field) => similarityScore(field, search))
  );

  if (secondarySimilarity >= 80) return 8;
  if (secondarySimilarity >= 68) return 9;

  return 20;
};

const getMinimumScore = (query) => {
  const cleanQuery = normalizeText(query);

  if (cleanQuery.length <= 2) return 95;
  if (cleanQuery.length <= 4) return 65;

  return 38;
};

const getArtistName = (song) => {
  return song?.artist?.name || song?.artistName || "Unknown Artist";
};

const getAlbumTitle = (song) => {
  return song?.album?.title || song?.albumTitle || "";
};

const getSongCountry = (song) => {
  return song?.country || song?.artist?.country || song?.album?.country || "";
};

const getSongLanguage = (song) => {
  return song?.songLanguage || song?.language || "";
};

const getSongArtistId = (song) => {
  return (song?.artist?._id || song?.artist || song?.artistId || "").toString();
};

const getPreferenceArtistId = (item) => {
  return (item?.artist?._id || item?.artist || "").toString();
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

const buildArtistScoreMap = (items = []) => {
  const map = new Map();

  items.forEach((item) => {
    const artistId = getPreferenceArtistId(item);

    if (artistId) {
      map.set(artistId.toLowerCase(), Number(item.score || 0));
    }
  });

  return map;
};

const getTasteScore = (song, preferences = {}) => {
  const countryRank = buildRankMap(preferences.countries || [], "name");
  const genreRank = buildRankMap(preferences.genres || [], "name");
  const moodRank = buildRankMap(preferences.moods || [], "name");
  const languageRank = buildRankMap(preferences.languages || [], "name");
  const artistScoreMap = buildArtistScoreMap(preferences.artists || []);

  let score = 0;

  const country = normalizeText(getSongCountry(song));
  const genre = normalizeText(song.genre);
  const mood = normalizeText(song.mood);
  const language = normalizeText(getSongLanguage(song));
  const artistId = getSongArtistId(song).toLowerCase();

  if (countryRank.has(country)) {
    score += 80 - countryRank.get(country) * 8;
  }

  if (genreRank.has(genre)) {
    score += 60 - genreRank.get(genre) * 6;
  }

  if (moodRank.has(mood)) {
    score += 40 - moodRank.get(mood) * 4;
  }

  if (languageRank.has(language)) {
    score += 30 - languageRank.get(language) * 3;
  }

  score += Number(artistScoreMap.get(artistId) || 0) * 5;
  score += Number(song.recommendationScore || 0);
  score += Number(song.plays || 0) * 0.02;
  score += Number(song.likes || 0) * 0.08;

  return score;
};

const getSongMainFields = (song) => {
  return [song.title, getArtistName(song), getAlbumTitle(song)];
};

const getSongSecondaryFields = (song) => {
  return [
    song.genre,
    song.mood,
    getSongCountry(song),
    getSongLanguage(song),
    song.releaseYear,
    ...(Array.isArray(song.tags) ? song.tags : []),
  ];
};

const getSongSearchText = (song) => {
  return [...getSongMainFields(song), ...getSongSecondaryFields(song)]
    .filter(Boolean)
    .join(" ");
};

const getSongMatchScore = (song, query) => {
  return (
    scoreField(song.title, query, 5) +
    scoreField(getArtistName(song), query, 3) +
    scoreField(getAlbumTitle(song), query, 2.4) +
    scoreField(song.genre, query, 1.2) +
    scoreField(song.mood, query, 1.1) +
    scoreField(getSongCountry(song), query, 1.1) +
    scoreField(getSongLanguage(song), query, 1) +
    scoreField(song.releaseYear, query, 0.8) +
    scoreField(Array.isArray(song.tags) ? song.tags.join(" ") : "", query, 1) +
    scoreField(getSongSearchText(song), query, 0.35)
  );
};

const getArtistMatchScore = (artist, query) => {
  return (
    scoreField(artist.name, query, 5) +
    scoreField(artist.country, query, 1.3) +
    scoreField(artist.bio, query, 0.5)
  );
};

const getAlbumMatchScore = (album, query) => {
  return (
    scoreField(album.title, query, 5) +
    scoreField(album.artist?.name || album.artistName, query, 3) +
    scoreField(album.description, query, 0.6) +
    scoreField(album.country, query, 1) +
    scoreField(album.genre, query, 1)
  );
};

const rankSongs = (songs = [], query = "", preferences = {}) => {
  const minimumScore = getMinimumScore(query);

  return uniqueById(songs)
    .map((song) => {
      const searchScore = getSongMatchScore(song, query);
      const tasteScore = getTasteScore(song, preferences);

      const matchPriority = getMatchPriority({
        query,
        mainFields: getSongMainFields(song),
        secondaryFields: getSongSecondaryFields(song),
      });

      return {
        ...song,
        searchScore,
        tasteScore,
        matchPriority,
        smartScore: searchScore * 100 + tasteScore,
      };
    })
    .filter((song) => {
      return song.searchScore >= minimumScore || song.matchPriority <= 9;
    })
    .sort((a, b) => {
      // Highest/closest match always comes first
      if (a.matchPriority !== b.matchPriority) {
        return a.matchPriority - b.matchPriority;
      }

      // Then stronger text match
      if (b.searchScore !== a.searchScore) {
        return b.searchScore - a.searchScore;
      }

      // Then user taste
      if (b.tasteScore !== a.tasteScore) {
        return b.tasteScore - a.tasteScore;
      }

      // Then popularity
      if (Number(b.plays || 0) !== Number(a.plays || 0)) {
        return Number(b.plays || 0) - Number(a.plays || 0);
      }

      return Number(b.likes || 0) - Number(a.likes || 0);
    })
    .slice(0, MAX_SONG_RESULTS);
};

const rankArtists = (artists = [], query = "", preferences = {}) => {
  const minimumScore = getMinimumScore(query);
  const artistScoreMap = buildArtistScoreMap(preferences.artists || []);
  const countryRank = buildRankMap(preferences.countries || [], "name");

  return uniqueById(artists)
    .map((artist) => {
      const searchScore = getArtistMatchScore(artist, query);

      const matchPriority = getMatchPriority({
        query,
        mainFields: [artist.name],
        secondaryFields: [artist.country, artist.bio],
      });

      const artistId = artist._id?.toString().toLowerCase();
      const country = normalizeText(artist.country);

      let tasteScore = 0;

      tasteScore += Number(artistScoreMap.get(artistId) || 0) * 8;

      if (countryRank.has(country)) {
        tasteScore += 50 - countryRank.get(country) * 5;
      }

      tasteScore += Number(artist.followers || 0) * 0.03;

      if (artist.verified) {
        tasteScore += 20;
      }

      return {
        ...artist,
        searchScore,
        tasteScore,
        matchPriority,
        smartScore: searchScore * 100 + tasteScore,
      };
    })
    .filter((artist) => {
      return artist.searchScore >= minimumScore || artist.matchPriority <= 9;
    })
    .sort((a, b) => {
      if (a.matchPriority !== b.matchPriority) {
        return a.matchPriority - b.matchPriority;
      }

      if (b.searchScore !== a.searchScore) {
        return b.searchScore - a.searchScore;
      }

      return b.tasteScore - a.tasteScore;
    })
    .slice(0, MAX_ARTIST_RESULTS);
};

const rankAlbums = (albums = [], query = "", preferences = {}) => {
  const minimumScore = getMinimumScore(query);
  const artistScoreMap = buildArtistScoreMap(preferences.artists || []);
  const countryRank = buildRankMap(preferences.countries || [], "name");

  return uniqueById(albums)
    .map((album) => {
      const searchScore = getAlbumMatchScore(album, query);

      const matchPriority = getMatchPriority({
        query,
        mainFields: [album.title, album.artist?.name || album.artistName],
        secondaryFields: [album.country, album.genre, album.description],
      });

      const artistId = (
        album?.artist?._id ||
        album?.artist ||
        album?.artistId ||
        ""
      )
        .toString()
        .toLowerCase();

      const country = normalizeText(album?.artist?.country || album?.country);

      let tasteScore = 0;

      tasteScore += Number(artistScoreMap.get(artistId) || 0) * 7;

      if (countryRank.has(country)) {
        tasteScore += 45 - countryRank.get(country) * 5;
      }

      tasteScore += Number(album.totalPlays || 0) * 0.05;
      tasteScore += Array.isArray(album.songs) ? album.songs.length * 3 : 0;

      return {
        ...album,
        searchScore,
        tasteScore,
        matchPriority,
        smartScore: searchScore * 100 + tasteScore,
      };
    })
    .filter((album) => {
      return album.searchScore >= minimumScore || album.matchPriority <= 9;
    })
    .sort((a, b) => {
      if (a.matchPriority !== b.matchPriority) {
        return a.matchPriority - b.matchPriority;
      }

      if (b.searchScore !== a.searchScore) {
        return b.searchScore - a.searchScore;
      }

      return b.tasteScore - a.tasteScore;
    })
    .slice(0, MAX_ALBUM_RESULTS);
};

const SearchModal = ({
  isOpen,
  onClose,
  onPlaySong,
  onArtistClick,
  onAlbumClick,
}) => {
  const navigate = useNavigate();
  const musicPlayer = useContext(MusicPlayerContext);

  const modalRef = useRef(null);
  const inputRef = useRef(null);

  const [query, setQuery] = useState("");

  const [songs, setSongs] = useState([]);
  const [artists, setArtists] = useState([]);
  const [albums, setAlbums] = useState([]);

  const [loading, setLoading] = useState(false);

  const cleanedQuery = useMemo(() => normalizeText(query), [query]);

  useEffect(() => {
    if (!isOpen) return;

    setTimeout(() => {
      inputRef.current?.focus();
    }, 200);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKey);

    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClick = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose?.();
      }
    };

    document.addEventListener("mousedown", handleClick);

    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!cleanedQuery) {
      setSongs([]);
      setArtists([]);
      setAlbums([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);

        const token = localStorage.getItem("token");

        const backendSearchRequest = axios.get(`${API_BASE_URL}/api/songs/search`, {
          params: {
            q: query,
          },
        });

        const songPoolRequest = axios.get(
          `${API_BASE_URL}/api/songs?limit=${MAX_SONG_POOL}&sort=popular`
        );

        const artistsRequest = axios.get(`${API_BASE_URL}/api/artists`, { params: { search: cleanedQuery, limit: 8, sort: "followers" } });

        const albumsRequest = axios.get(`${API_BASE_URL}/api/albums`, { params: { search: cleanedQuery, limit: 8, sort: "popular" } });

        const [backendSearchRes, songPoolRes, artistsRes, albumsRes] =
          await Promise.all([
            backendSearchRequest,
            songPoolRequest,
            artistsRequest,
            albumsRequest,
          ]);

        let preferences = {};
        if (token) {
          try {
            const preferencesRes = await axios.get(
              `${API_BASE_URL}/api/recommend/preferences`,
              { headers: { token } }
            );
            if (preferencesRes.data?.success) {
              preferences = preferencesRes.data.preferences || {};
            }
          } catch (error) {
            console.log("Search preferences unavailable:", error);
          }
        }

        const backendSongs = backendSearchRes.data?.success
          ? backendSearchRes.data.songs || []
          : [];

        const songPool = songPoolRes.data?.success
          ? songPoolRes.data.songs || []
          : [];

        const fetchedArtists = artistsRes.data?.success
          ? artistsRes.data.artists || []
          : [];

        const fetchedAlbums = albumsRes.data?.success
          ? albumsRes.data.albums || []
          : [];

        setSongs(rankSongs([...backendSongs, ...songPool], query, preferences));
        setArtists(rankArtists(fetchedArtists, query, preferences));
        setAlbums(rankAlbums(fetchedAlbums, query, preferences));
      } catch (err) {
        console.log("Search error:", err);

        setSongs([]);
        setArtists([]);
        setAlbums([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, cleanedQuery]);

  const closeModalAndScroll = () => {
    onClose?.();

    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 50);
  };

  const handleArtistOpen = (artist) => {
    if (!artist?._id) return;

    navigate(`/artist/${artist._id}`);

    onArtistClick?.(artist);

    closeModalAndScroll();
  };

  const handleAlbumOpen = (album) => {
    if (!album?._id) return;

    navigate(`/album/${album._id}`, {
      state: {
        album,
      },
    });

    onAlbumClick?.(album);

    closeModalAndScroll();
  };

  const handleSongOpen = (song) => {
    if (!song?._id) return;

    const playlist = buildPlaylist(song, songs);
    trackTasteEvent("search_play", { songId: song._id }, { cooldownMs: 30000 });

    if (musicPlayer?.playSong) {
      musicPlayer.playSong(song, playlist);
    } else {
      onPlaySong?.(song, playlist);
    }

    navigate(`/song/${song._id}`, {
      state: {
        playlist,
      },
    });

    closeModalAndScroll();
  };

  const handleKeyboardOpen = (event, callback) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      callback();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="sw-search-overlay">
      <div className="sw-search-modal" ref={modalRef}>
        <div className="sw-search-handle" onClick={onClose}>
          <ChevronDown size={24} />
        </div>

        <div className="sw-search-header">
          <div className="sw-search-input">
            <Search size={18} />

            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search songs, artists, albums..."
            />

            {query && (
              <button type="button" onClick={() => setQuery("")}>
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {!query && (
          <div className="sw-search-empty">
            <Search size={60} />
            <h2>Search Music</h2>
            <p>Songs, Artists, Albums, Genres, Countries...</p>
          </div>
        )}

        {loading && (
          <div className="sw-search-empty">
            <h3>Searching...</h3>
          </div>
        )}

        {!loading && query && (
          <div className="sw-search-results">
            {artists.length > 0 && (
              <>
                <h3>Artists</h3>

                {artists.map((artist) => (
                  <div
                    key={artist._id}
                    className="sw-search-item"
                    role="button"
                    tabIndex={0}
                    onClick={() => handleArtistOpen(artist)}
                    onKeyDown={(event) =>
                      handleKeyboardOpen(event, () => handleArtistOpen(artist))
                    }
                  >
                    <img
                      src={artist.image || "/fallback-cover.svg"}
                      alt={artist.name || "Artist"}
                     loading="lazy" decoding="async" />

                    <div>
                      <h4>{artist.name || "Unknown Artist"}</h4>
                      <p>{artist.country || "Unknown Location"}</p>
                    </div>

                    <User size={18} />
                  </div>
                ))}
              </>
            )}

            {albums.length > 0 && (
              <>
                <h3>Albums</h3>

                {albums.map((album) => (
                  <div
                    key={album._id}
                    className="sw-search-item"
                    role="button"
                    tabIndex={0}
                    onClick={() => handleAlbumOpen(album)}
                    onKeyDown={(event) =>
                      handleKeyboardOpen(event, () => handleAlbumOpen(album))
                    }
                  >
                    <img
                      src={album.coverImage || "/fallback-cover.svg"}
                      alt={album.title || "Album"}
                     loading="lazy" decoding="async" />

                    <div>
                      <h4>{album.title || "Untitled Album"}</h4>
                      <p>{album.artist?.name || album.artistName || "Album"}</p>
                    </div>

                    <Disc3 size={18} />
                  </div>
                ))}
              </>
            )}

            {songs.length > 0 && (
              <>
                <h3>Songs</h3>

                {songs.map((song) => (
                  <div
                    key={song._id}
                    className="sw-search-item"
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSongOpen(song)}
                    onKeyDown={(event) =>
                      handleKeyboardOpen(event, () => handleSongOpen(song))
                    }
                  >
                    <img
                      src={song.imageUrl || "/fallback-cover.svg"}
                      alt={song.title || "Song"}
                     loading="lazy" decoding="async" />

                    <div>
                      <h4>{song.title || "Unknown Song"}</h4>

                      <p>
                        {getArtistName(song)}
                        {getAlbumTitle(song) ? ` • ${getAlbumTitle(song)}` : ""}
                      </p>
                    </div>

                    <Music2 size={18} />
                  </div>
                ))}
              </>
            )}

            {songs.length === 0 &&
              artists.length === 0 &&
              albums.length === 0 && (
                <div className="sw-search-empty">
                  <Search size={55} />

                  <h2>No Results</h2>

                  <p>Nothing matched "{query}"</p>
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchModal;