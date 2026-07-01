import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { FaPlay } from "react-icons/fa";
import "./Albums.css";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

const Albums = () => {
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchAlbums = async () => {
      try {
        const res = await axios.get(`${backendUrl}/api/albums`);

        if (res.data.success) {
          setAlbums(res.data.albums);
        }
      } catch (error) {
        console.log(error);
      } finally {
        setLoading(false);
      }
    };

    fetchAlbums();
  }, []);

  if (loading) {
    return <div className="albums-loading">Loading albums...</div>;
  }

  return (
    <section className="albums-section">

      <div className="albums-header">
        <div>
          <span>FULL COLLECTIONS</span>
          <h2>Albums 💿</h2>
        </div>

        <button className="view-albums-btn">
          View All
        </button>
      </div>

      <div className="albums-scroll-wrapper">
        <div className="albums-grid">

          {albums.map((album) => (
            <div
              key={album._id}
              className="featured-album-card"
            >

              {/* IMAGE CLICK */}
              <img
                src={album.coverImage}
                alt={album.title}
                className="featured-bg"
                onClick={() => navigate(`/album/${album._id}`)}
                style={{ cursor: "pointer" }}
              />

              <div className="featured-overlay">

                <span className="album-label">
                  FEATURED ALBUM
                </span>

                <h3>{album.title}</h3>
                <p>{album.artist?.name}</p>

                <div className="album-details">
                  <span>
                    {album.songs?.length || 0} Songs
                  </span>
                  <span>{album.genre}</span>
                </div>

                <div className="album-actions">

                  {/* PLAY BUTTON (optional later queue) */}
                  <button>
                    <FaPlay />
                    Play
                  </button>

                  {/* VIEW BUTTON → NAVIGATE */}
                  <button
                    className="secondary"
                    onClick={() => {navigate(`/album/${album._id}`); window.scrollTo(0,0)}}
                  >
                    View
                  </button>

                </div>

              </div>
            </div>
          ))}

        </div>
      </div>

    </section>
  );
};

export default Albums;