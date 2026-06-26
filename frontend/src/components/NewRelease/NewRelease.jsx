import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { FaPlay } from "react-icons/fa";
import { MusicPlayerContext } from "../../context/MainPlayerContext";
import "./NewRelease.css";
import { Link } from "react-router-dom";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

const NewReleaseSkeleton = () => {
  return (
    <section className="new-release">
      <div className="section-header">
        <div className="nr-skeleton nr-skeleton-title"></div>
      </div>

      <div className="release-grid">
        {Array.from({ length: 8 }).map((_, index) => (
          <div className="release-card release-skeleton-card" key={index}>
            <div className="nr-skeleton nr-skeleton-image"></div>

            <div className="release-content">
              <div className="nr-skeleton nr-skeleton-line big"></div>
              <div className="nr-skeleton nr-skeleton-line small"></div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

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
    return <NewReleaseSkeleton />;
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
                  alt={song.title || "Song cover"}
                  loading="lazy"
                />

                <div className="play-btn">
                  <FaPlay />
                </div>
              </div>

              <div className="release-content">
                <h3 className="text-white">{song.title || "Unknown Song"}</h3>
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