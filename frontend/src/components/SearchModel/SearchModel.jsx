import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  Search,
  X,
  ChevronDown,
  Music2,
  Disc3,
  User,
} from "lucide-react";
import "./SearchModel.css";

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;

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

const getArtistName = (song) => {
  return song?.artist?.name || song?.artistName || "Unknown Artist";
};

const getAlbumTitle = (song) => {
  return song?.album?.title || song?.albumTitle || "";
};

const getSongCountry = (song) => {
  return song?.country || song?.artist?.country || song?.album?.country || "";
};

const filterArtists = (artists = [], search = "") => {
  return artists.filter((artist) => {
    const searchableText = [
      artist.name,
      artist.country,
      artist.bio,
    ]
      .filter(Boolean)
      .join(" ");

    return includesSearch(searchableText, search);
  });
};

const filterAlbums = (albums = [], search = "") => {
  return albums.filter((album) => {
    const searchableText = [
      album.title,
      album.artist?.name,
      album.artistName,
      album.description,
      album.country,
      album.genre,
    ]
      .filter(Boolean)
      .join(" ");

    return includesSearch(searchableText, search);
  });
};

const sortSongsByTaste = (songs = [], preferences = {}) => {
  const countryRank = new Map();
  const genreRank = new Map();
  const moodRank = new Map();

  (preferences.countries || []).forEach((item, index) => {
    if (item?.name) {
      countryRank.set(normalizeText(item.name), index);
    }
  });

  (preferences.genres || []).forEach((item, index) => {
    if (item?.name) {
      genreRank.set(normalizeText(item.name), index);
    }
  });

  (preferences.moods || []).forEach((item, index) => {
    if (item?.name) {
      moodRank.set(normalizeText(item.name), index);
    }
  });

  return [...songs].sort((a, b) => {
    const countryA = normalizeText(getSongCountry(a));
    const countryB = normalizeText(getSongCountry(b));

    const genreA = normalizeText(a.genre);
    const genreB = normalizeText(b.genre);

    const moodA = normalizeText(a.mood);
    const moodB = normalizeText(b.mood);

    const countryRankA = countryRank.has(countryA)
      ? countryRank.get(countryA)
      : 999;

    const countryRankB = countryRank.has(countryB)
      ? countryRank.get(countryB)
      : 999;

    if (countryRankA !== countryRankB) {
      return countryRankA - countryRankB;
    }

    const genreRankA = genreRank.has(genreA) ? genreRank.get(genreA) : 999;
    const genreRankB = genreRank.has(genreB) ? genreRank.get(genreB) : 999;

    if (genreRankA !== genreRankB) {
      return genreRankA - genreRankB;
    }

    const moodRankA = moodRank.has(moodA) ? moodRank.get(moodA) : 999;
    const moodRankB = moodRank.has(moodB) ? moodRank.get(moodB) : 999;

    if (moodRankA !== moodRankB) {
      return moodRankA - moodRankB;
    }

    const scoreA = Number(a.recommendationScore || 0);
    const scoreB = Number(b.recommendationScore || 0);

    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }

    const playsA = Number(a.plays || 0);
    const playsB = Number(b.plays || 0);

    if (playsB !== playsA) {
      return playsB - playsA;
    }

    return Number(b.likes || 0) - Number(a.likes || 0);
  });
};

const SearchModal = ({
  isOpen,
  onClose,
  onPlaySong,
  onArtistClick,
  onAlbumClick,
}) => {
  const modalRef = useRef(null);
  const inputRef = useRef(null);

  const [query, setQuery] = useState("");

  const [songs, setSongs] = useState([]);
  const [artists, setArtists] = useState([]);
  const [albums, setAlbums] = useState([]);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setTimeout(() => {
      inputRef.current?.focus();
    }, 200);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKey);

    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClick = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClick);

    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!query.trim()) {
      setSongs([]);
      setArtists([]);
      setAlbums([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);

        const token = localStorage.getItem("token");

        const songsRequest = axios.get(`${API_BASE_URL}/api/songs/search`, {
          params: {
            q: query,
          },
        });

        const artistsRequest = axios.get(`${API_BASE_URL}/api/artists`);

        const albumsRequest = axios.get(`${API_BASE_URL}/api/albums`);

        const preferencesRequest = token
          ? axios.get(`${API_BASE_URL}/api/recommend/preferences`, {
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

        const [songsRes, artistsRes, albumsRes, preferencesRes] =
          await Promise.all([
            songsRequest,
            artistsRequest,
            albumsRequest,
            preferencesRequest,
          ]);

        const fetchedSongs = songsRes.data?.success
          ? songsRes.data.songs || []
          : [];

        const fetchedArtists = artistsRes.data?.success
          ? artistsRes.data.artists || []
          : [];

        const fetchedAlbums = albumsRes.data?.success
          ? albumsRes.data.albums || []
          : [];

        const preferences = preferencesRes.data?.preferences || {};

        setSongs(sortSongsByTaste(fetchedSongs, preferences).slice(0, 20));
        setArtists(filterArtists(fetchedArtists, query).slice(0, 10));
        setAlbums(filterAlbums(fetchedAlbums, query).slice(0, 10));
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
  }, [query]);

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
              <button onClick={() => setQuery("")}>
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
                    onClick={() => {
                      onArtistClick?.(artist);
                      onClose?.();
                    }}
                  >
                    <img
                      src={artist.image || "/fallback-cover.png"}
                      alt={artist.name || "Artist"}
                    />

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
                    onClick={() => {
                      onAlbumClick?.(album);
                      onClose?.();
                    }}
                  >
                    <img
                      src={album.coverImage || "/fallback-cover.png"}
                      alt={album.title || "Album"}
                    />

                    <div>
                      <h4>{album.title || "Untitled Album"}</h4>
                      <p>
                        {album.artist?.name || album.artistName || "Album"}
                      </p>
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
                    onClick={() => {
                      onPlaySong?.(song, songs);
                      onClose?.();
                    }}
                  >
                    <img
                      src={song.imageUrl || "/fallback-cover.png"}
                      alt={song.title || "Song"}
                    />

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