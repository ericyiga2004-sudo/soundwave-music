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

  // Autofocus
  useEffect(() => {
    if (!isOpen) return;

    setTimeout(() => {
      inputRef.current?.focus();
    }, 200);
  }, [isOpen]);

  // ESC
  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKey);

    return () =>
      window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // Outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClick = (e) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(e.target)
      ) {
        onClose();
      }
    };

    document.addEventListener(
      "mousedown",
      handleClick
    );

    return () =>
      document.removeEventListener(
        "mousedown",
        handleClick
      );
  }, [isOpen, onClose]);

  // Backend Search
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

        const { data } = await axios.get(
          `${API_BASE_URL}/api/songs/search`,
          {
            params: {
              query,
            },
          }
        );

        if (data.success) {
          setSongs(data.songs || []);
          setArtists(data.artists || []);
          setAlbums(data.albums || []);
        }
      } catch (err) {
        console.log(err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="sw-search-overlay">
      <div
        className="sw-search-modal"
        ref={modalRef}
      >
        <div
          className="sw-search-handle"
          onClick={onClose}
        >
          <ChevronDown size={24} />
        </div>

        <div className="sw-search-header">
          <div className="sw-search-input">
            <Search size={18} />

            <input
              ref={inputRef}
              value={query}
              onChange={(e) =>
                setQuery(e.target.value)
              }
              placeholder="Search songs, artists, albums..."
            />

            {query && (
              <button
                onClick={() => setQuery("")}
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {!query && (
          <div className="sw-search-empty">
            <Search size={60} />
            <h2>Search Music</h2>
            <p>
              Songs, Artists, Albums,
              Genres, Countries...
            </p>
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
                    onClick={() =>
                      onArtistClick?.(artist)
                    }
                  >
                    <img
                      src={artist.image}
                      alt={artist.name}
                    />

                    <div>
                      <h4>{artist.name}</h4>
                      <p>
                        {artist.country}
                      </p>
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
                    onClick={() =>
                      onAlbumClick?.(album)
                    }
                  >
                    <img
                      src={album.coverImage}
                      alt={album.title}
                    />

                    <div>
                      <h4>{album.title}</h4>
                      <p>
                        {album.artist?.name ||
                          album.artistName ||
                          "Album"}
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
                    onClick={() =>
                      onPlaySong?.(song)
                    }
                  >
                    <img
                      src={song.imageUrl}
                      alt={song.title}
                    />

                    <div>
                      <h4>{song.title}</h4>

                      <p>
                        {song.artist?.name} •{" "}
                        {song.album?.title}
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

                  <p>
                    Nothing matched "{query}"
                  </p>
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchModal;