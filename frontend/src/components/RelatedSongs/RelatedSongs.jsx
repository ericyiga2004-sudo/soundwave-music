import React, { useEffect, useState } from "react";
import axios from "axios";
import SongItem from "../SongItem/SongItem";
import "./RelatedSongs.css";

const RelatedSongs = ({ currentSong }) => {
  const [related, setRelated] = useState([]);
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  useEffect(() => {
    const fetchRelated = async () => {
      try {
        const res = await axios.get(`${backendUrl}/api/songs`);

        if (res.data.success) {
          const allSongs = res.data.songs;

          const filtered = allSongs.filter((s) => {
            if (!currentSong) return false;

            return (
              s._id !== currentSong._id &&
              (
                s.artist?._id === currentSong.artist?._id ||
                s.album?._id === currentSong.album?._id ||
                s.genre === currentSong.genre
              )
            );
          });

          setRelated(filtered.slice(0, 6));
        }
      } catch (err) {
        console.log(err);
      }
    };

    if (currentSong) fetchRelated();
  }, [currentSong]);

  if (!related.length) return null;

  return (
    <div className="related">
      <h2>Related Songs</h2>

      <div className="related-grid">
        {related.map((song) => (
          <SongItem key={song._id} song={song} />
        ))}
      </div>
    </div>
  );
};

export default RelatedSongs;