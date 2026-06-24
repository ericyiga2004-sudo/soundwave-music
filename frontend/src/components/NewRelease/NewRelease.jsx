import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { FaPlay } from "react-icons/fa";
import { MusicPlayerContext } from "../../context/MainPlayerContext";
import "./NewRelease.css";
import { Link } from "react-router-dom";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

const NewRelease = () => {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { playSong } = useContext(MusicPlayerContext);

  useEffect(() => {
    const fetchNewReleases = async () => {
      try {
        const res = await axios.get(`${backendUrl}/api/songs/new-releases/all`);

        if (res.data.success) {
          setSongs(res.data.songs || []);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchNewReleases();
  }, []);

  if (loading) {
    return <div className="new-release-loading">Loading...</div>;
  }

  return (
    <section className="new-release">
      <div className="section-header">
        <h2>New Releases</h2>
      </div>

      <div className="release-grid">
        {songs.map((song) => (
          <div
            className="release-card"
            key={song._id}
            onClick={() => playSong(song, songs)}
          >
            <Link
              className="text-decoration-none"
              to={`/song/${song._id}`}
              state={{ playlist: songs }}
            >
              <div className="release-image">
                <img
                  src={song.imageUrl || "/fallback-cover.png"}
                  alt={song.title}
                />

                <div className="play-btn">
                  <FaPlay />
                </div>
              </div>

              <div className="release-content">
                <h3 className="text-white">{song.title}</h3>
                <p>{song.artist?.name || "Unknown Artist"}</p>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
};

export default NewRelease;