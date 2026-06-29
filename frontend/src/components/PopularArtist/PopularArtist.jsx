import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  FaCheckCircle,
  FaUsers,
  FaMapMarkerAlt,
  FaArrowRight,
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
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArtists = async () => {
      try {
        const res = await axios.get(`${backendUrl}/api/artists`);

        if (res.data.success) {
          setArtists(Array.isArray(res.data.artists) ? res.data.artists : []);
        }
      } catch (error) {
        console.log(error);
      } finally {
        setLoading(false);
      }
    };

    fetchArtists();
  }, []);

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
          {artists.map((artist) => (
            <article className="popular-artist-card" key={artist._id}>
              <div className="popular-artist-image-wrap">
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
                <h3>
                  {artist.name || "Unknown Artist"}
                </h3>

                <p className="popular-artist-country">
                  <FaMapMarkerAlt />
                  <span>{artist.country || "Unknown Location"}</span>
                </p>

                <div className="popular-artist-stats">
                  <FaUsers />
                  <span>{formatFollowers(artist.followers)} followers</span>
                </div>

                <button type="button" className="popular-artist-button">
                  View Artist
                  <FaArrowRight />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="popular-artists-empty">
          No popular artists found.
        </div>
      )}
    </section>
  );
};

export default PopularArtist;