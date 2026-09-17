import React, { useContext, useEffect, useState } from "react";
import SongItem from "../SongItem/SongItem";
import { MusicContext } from "../../context/ShopContext";
import "./Trending.tailwind.css";

const Trending = () => {
  const { songs, catalogSongs = [] } = useContext(MusicContext);
  const [trending, setTrending] = useState([]);

  useEffect(() => {
    const sourceSongs = catalogSongs.length ? catalogSongs : songs;
    if (sourceSongs?.length > 0) {
      const sorted = [...sourceSongs]
        .sort((a, b) => {
          const aFollowers = a?.artist?.followers || 0;
          const bFollowers = b?.artist?.followers || 0;
          return bFollowers - aFollowers; // DESCENDING
        })
        

      setTrending(sorted);
    }
  }, [songs, catalogSongs]);

  return (
    <section className="trending-section">
      <h2 className="trending-title">Trending Now 🔥</h2>

      <div className="release-grid">
        {trending.map((song) => (
          <SongItem key={song._id} song={song} />
        ))}
      </div>
    </section>
  );
};

export default Trending;