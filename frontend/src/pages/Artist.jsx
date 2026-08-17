import React, { useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import {
  FaArrowLeft,
  FaCheckCircle,
  FaCompactDisc,
  FaMapMarkerAlt,
  FaMusic,
  FaPlay,
  FaUserCheck,
  FaUserPlus,
  FaUsers,
  FaHeart,
} from "react-icons/fa";

import SongItem from "../components/SongItem/SongItem";
import { MusicContext } from "../context/ShopContext";
import { MusicPlayerContext } from "../context/MainPlayerContext";
import "./CSS/Artist.css";
import { trackTasteEvent } from "../utils/personalization";

const formatFollowers = (value = 0) => {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value || 0));
};

const getArtistIdFromSong = (song) => {
  return (song?.artist?._id || song?.artist || song?.artistId || "").toString();
};

const getAlbumIdFromSong = (song) => {
  return (song?.album?._id || song?.album || song?.albumId || "").toString();
};

const Artist = () => {
  const { artistId } = useParams();
  const navigate = useNavigate();

  const { songs = [], backendUrl } = useContext(MusicContext);
  const { playSong } = useContext(MusicPlayerContext);

  const [artist, setArtist] = useState(null);
  const [artistAlbums, setArtistAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [albumsLoading, setAlbumsLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const token = localStorage.getItem("token");

  const artistSongs = useMemo(() => {
    return (songs || []).filter((song) => getArtistIdFromSong(song) === artistId);
  }, [songs, artistId]);

  const featuredSongs = useMemo(() => {
    return [...artistSongs]
      .sort((a, b) => Number(b.plays || 0) - Number(a.plays || 0))
      .slice(0, 8);
  }, [artistSongs]);

  const mostLikedSongs = useMemo(() => {
    return [...artistSongs]
      .sort((a, b) => Number(b.likes || 0) - Number(a.likes || 0))
      .slice(0, 8);
  }, [artistSongs]);

  const albumSongsMap = useMemo(() => {
    const map = {};

    artistSongs.forEach((song) => {
      const albumId = getAlbumIdFromSong(song);
      if (!albumId) return;

      if (!map[albumId]) {
        map[albumId] = [];
      }

      map[albumId].push(song);
    });

    return map;
  }, [artistSongs]);

  const fetchArtist = async () => {
    try {
      setLoading(true);

      const res = await axios.get(`${backendUrl}/api/artists/${artistId}`);

      if (res.data.success) {
        setArtist(res.data.artist);
      }
    } catch (error) {
      console.log("Fetch artist error:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchArtistAlbums = async () => {
    try {
      setAlbumsLoading(true);

      const res = await axios.get(`${backendUrl}/api/albums`);

      if (res.data.success) {
        const albums = Array.isArray(res.data.albums) ? res.data.albums : [];

        const filteredAlbums = albums.filter((album) => {
          const albumArtistId =
            album?.artist?._id || album?.artist || album?.artistId || "";

          return albumArtistId?.toString() === artistId;
        });

        setArtistAlbums(filteredAlbums);
      } else {
        setArtistAlbums([]);
      }
    } catch (error) {
      console.log("Fetch artist albums error:", error);
      setArtistAlbums([]);
    } finally {
      setAlbumsLoading(false);
    }
  };

  const checkFollowStatus = async () => {
    if (!token || !artistId) return;

    try {
      const res = await axios.get(
        `${backendUrl}/api/artists/check-follow/${artistId}`,
        {
          headers: {
            token,
          },
        }
      );

      if (res.data.success) {
        setFollowing(Boolean(res.data.following));
      }
    } catch (error) {
      console.log("Check follow error:", error);
    }
  };

  useEffect(() => {
    fetchArtist();
    fetchArtistAlbums();
    checkFollowStatus();
  }, [artistId]);

  useEffect(() => {
    if (artist?._id) trackTasteEvent("artist_view", { artistId: artist._id }, { cooldownMs: 90000 });
  }, [artist?._id]);


  const handleFollow = async () => {
    if (!token) {
      navigate("/account");
      return;
    }

    try {
      setFollowLoading(true);

      const res = await axios.post(
        `${backendUrl}/api/artists/follow/${artistId}`,
        {},
        {
          headers: {
            token,
          },
        }
      );

      if (res.data.success) {
        setFollowing(Boolean(res.data.following));

        setArtist((prev) =>
          prev
            ? {
                ...prev,
                followers: res.data.followers,
              }
            : prev
        );
      }
    } catch (error) {
      console.log("Follow artist error:", error);
    } finally {
      setFollowLoading(false);
    }
  };

  const playArtistSongs = () => {
    if (!artistSongs.length) return;

    playSong(artistSongs[0], artistSongs);
  };

  const openAlbum = (albumId) => {
    if (!albumId) return;

    navigate(`/album/${albumId}`);
    window.scrollTo(0, 0);
  };

  if (loading) {
    return (
      <main className="artist-page">
        <div className="artist-loading-card">
          <div className="artist-loading-pulse"></div>
          <p>Loading artist...</p>
        </div>
      </main>
    );
  }

  if (!artist) {
    return (
      <main className="artist-page">
        <section className="artist-empty">
          <FaMusic />
          <h1>Artist not found</h1>
          <p>This artist may have been removed.</p>
          <button type="button" onClick={() => navigate("/")}>
            Go Home
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="artist-page">
      <div className="artist-bg" aria-hidden="true">
        <img src={artist.image || "/fallback-cover.svg"} alt="" />
      </div>

      <button
        type="button"
        className="artist-back-btn"
        onClick={() => navigate(-1)}
      >
        <FaArrowLeft />
        Back
      </button>

      <section className="artist-hero container-fluid">
        <div className="row g-4 align-items-end">
          <div className="col-12 col-md-auto text-center text-md-start">
            <div className="artist-hero-image mx-auto mx-md-0">
              <img src={artist.image || "/fallback-cover.svg"} alt={artist.name} />

              {artist.verified && (
                <span className="artist-verified">
                  <FaCheckCircle />
                </span>
              )}
            </div>
          </div>

          <div className="col-12 col-md">
            <span className="artist-kicker">
              {artist.verified ? "Verified Artist" : "Artist"}
            </span>

            <h1>{artist.name || "Unknown Artist"}</h1>

            <div className="artist-meta">
              <span>
                <FaUsers />
                {formatFollowers(artist.followers)} followers
              </span>

              <span>
                <FaMusic />
                {artistSongs.length} songs
              </span>

              <span>
                <FaCompactDisc />
                {artistAlbums.length} albums
              </span>

              <span>
                <FaMapMarkerAlt />
                {artist.country || "Unknown Location"}
              </span>
            </div>

            <p className="artist-bio">
              {artist.bio ||
                "Discover songs, albums, and popular tracks from this artist."}
            </p>

            <div className="artist-actions">
              <button
                type="button"
                className="artist-play-btn"
                onClick={playArtistSongs}
                disabled={!artistSongs.length}
              >
                <FaPlay />
                Play Songs
              </button>

              <button
                type="button"
                className={`artist-follow-btn ${following ? "following" : ""}`}
                onClick={handleFollow}
                disabled={followLoading}
              >
                {followLoading ? (
                  "..."
                ) : following ? (
                  <>
                    <FaUserCheck />
                    Following
                  </>
                ) : (
                  <>
                    <FaUserPlus />
                    Follow
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="artist-content container-fluid">
        <div className="artist-section-header">
          <div>
            <span>Discography</span>
            <h2>Popular Songs</h2>
          </div>
        </div>

        {featuredSongs.length > 0 ? (
          <div className="artist-song-slider">
            {featuredSongs.map((song) => (
              <div className="artist-song-slide" key={song._id}>
                <SongItem song={song} queue={artistSongs} />
              </div>
            ))}
          </div>
        ) : (
          <div className="artist-no-songs">
            <FaMusic />
            <p>No songs uploaded for this artist yet.</p>
          </div>
        )}

        <div className="artist-section-header artist-all-header">
          <div>
            <span>Albums</span>
            <h2>Albums by {artist.name}</h2>
          </div>
        </div>

        {albumsLoading ? (
          <div className="artist-no-songs">
            <FaCompactDisc />
            <p>Loading albums...</p>
          </div>
        ) : artistAlbums.length > 0 ? (
          <div className="artist-album-slider">
            {artistAlbums.map((album) => {
              const albumId = album._id;
              const albumSongs = albumSongsMap[albumId] || [];

              return (
                <button
                  type="button"
                  className="artist-album-card"
                  key={album._id}
                  onClick={() => openAlbum(album._id)}
                >
                  <img
                    src={
                      album.coverImage ||
                      album.imageUrl ||
                      album.image ||
                      "/fallback-cover.svg"
                    }
                    alt={album.title || album.name || "Album"}
                  />

                  <span>
                    <strong>{album.title || album.name || "Untitled Album"}</strong>
                    <small>
                      {album.releaseYear || album.year || "Album"} •{" "}
                      {albumSongs.length} songs
                    </small>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="artist-no-songs">
            <FaCompactDisc />
            <p>No albums found for this artist yet.</p>
          </div>
        )}

        {mostLikedSongs.length > 0 && (
          <>
            <div className="artist-section-header artist-all-header">
              <div>
                <span>Fan Favorites</span>
                <h2>Most Liked Songs</h2>
              </div>
            </div>

            <div className="artist-liked-list">
              {mostLikedSongs.map((song, index) => (
                <button
                  type="button"
                  className="artist-liked-row"
                  key={song._id}
                  onClick={() => playSong(song, artistSongs)}
                >
                  <span className="artist-liked-index">{index + 1}</span>

                  <img src={song.imageUrl || "/fallback-cover.svg"} alt="" />

                  <span className="artist-liked-copy">
                    <strong>{song.title}</strong>
                    <small>{song.genre || "Unknown Genre"}</small>
                  </span>

                  <span className="artist-liked-likes">
                    <FaHeart />
                    {Number(song.likes || 0).toLocaleString()}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {artistSongs.length > 8 && (
          <>
            <div className="artist-section-header artist-all-header">
              <div>
                <span>All Tracks</span>
                <h2>More From {artist.name}</h2>
              </div>
            </div>

            <div className="artist-all-grid row g-3 g-md-4">
              {artistSongs.slice(8).map((song) => (
                <div className="col-6 col-sm-4 col-lg-3 col-xl-2" key={song._id}>
                  <SongItem song={song} queue={artistSongs} />
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
};

export default Artist;