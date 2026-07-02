import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  FaCheckCircle,
  FaUsers,
  FaMapMarkerAlt,
  FaArrowRight,
  FaUserPlus,
  FaUserCheck,
} from "react-icons/fa";
import "./PopularArtist.css";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

const formatFollowers = (value = 0) => {
  const number = Number(value || 0);

  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(number);
};

const PopularArtist = () => {
  const navigate = useNavigate();

  const [artists, setArtists] = useState([]);
  const [followedArtists, setFollowedArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followLoadingId, setFollowLoadingId] = useState("");

  const token = localStorage.getItem("token");

  const fetchArtists = async () => {
    try {
      const res = await axios.get(`${backendUrl}/api/artists`);

      if (res.data.success) {
        setArtists(Array.isArray(res.data.artists) ? res.data.artists : []);
      }
    } catch (error) {
      console.log("Fetch artists error:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFollowedArtists = async () => {
    if (!token) {
      setFollowedArtists([]);
      return;
    }

    try {
      const res = await axios.get(`${backendUrl}/api/artists/following`, {
        headers: {
          token,
        },
      });

      if (res.data.success) {
        const followedIds = (res.data.artists || []).map((artist) => artist._id);
        setFollowedArtists(followedIds);
      }
    } catch (error) {
      console.log("Fetch followed artists error:", error);
    }
  };

  useEffect(() => {
    fetchArtists();
    fetchFollowedArtists();
  }, []);

  const isFollowingArtist = (artistId) => {
    return followedArtists.includes(artistId);
  };

  const handleViewArtist = (artistId) => {
    navigate(`/artist/${artistId}`);
    window.scrollTo(0, 0);
  };

  const handleFollowArtist = async (artistId) => {
    if (!token) {
      navigate("/account");
      return;
    }

    if (!artistId || followLoadingId) return;

    try {
      setFollowLoadingId(artistId);

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
        setFollowedArtists((current) => {
          if (res.data.following) {
            return current.includes(artistId) ? current : [...current, artistId];
          }

          return current.filter((id) => id !== artistId);
        });

        setArtists((currentArtists) =>
          currentArtists.map((artist) =>
            artist._id === artistId
              ? {
                  ...artist,
                  followers: res.data.followers,
                }
              : artist
          )
        );
      }
    } catch (error) {
      console.log("Follow artist error:", error);
    } finally {
      setFollowLoadingId("");
    }
  };

  if (loading) {
    return (
      <section className="popular-artists-section">
        <div className="popular-artists-loading">Loading artists...</div>
      </section>
    );
  }

  return (
    <section className="popular-artists-section">
      <div className="popular-artists-header">
        <div>
          <span className="popular-artists-tag">Top Creators</span>
          <h2>Popular Artists</h2>
          <p>Discover the voices shaping the sound of the moment.</p>
        </div>

        <button type="button" className="popular-artists-view-all">
          View All
          <FaArrowRight />
        </button>
      </div>

      {artists.length > 0 ? (
        <div className="popular-artists-grid">
          {artists.map((artist) => {
            const following = isFollowingArtist(artist._id);
            const buttonLoading = followLoadingId === artist._id;

            return (
              <article className="popular-artist-card" key={artist._id}>
                <div
                  className="popular-artist-image-wrap"
                  onClick={() => handleViewArtist(artist._id)}
                  role="button"
                  tabIndex={0}
                >
                  <img
                    src={artist.image || "/fallback-cover.png"}
                    alt={artist.name || "Artist"}
                    className="popular-artist-image"
                  />

                  {artist.verified && (
                    <span className="popular-artist-verified-badge">
                      <FaCheckCircle />
                    </span>
                  )}
                </div>

                <div className="popular-artist-content">
                  <h3>{artist.name || "Unknown Artist"}</h3>

                  <p className="popular-artist-country">
                    <FaMapMarkerAlt />
                    <span>{artist.country || "Unknown Location"}</span>
                  </p>

                  <div className="popular-artist-stats">
                    <FaUsers />
                    <span>{formatFollowers(artist.followers)} followers</span>
                  </div>

                  <div className="popular-artist-actions">
                    <button
                      type="button"
                      className={`popular-artist-follow-btn ${
                        following ? "following" : ""
                      }`}
                      onClick={() => handleFollowArtist(artist._id)}
                      disabled={buttonLoading}
                    >
                      {buttonLoading ? (
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

                    <button
                      type="button"
                      className="popular-artist-button"
                      onClick={() => handleViewArtist(artist._id)}
                    >
                      View
                      <FaArrowRight />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="popular-artists-empty">No popular artists found.</div>
      )}
    </section>
  );
};

export default PopularArtist;