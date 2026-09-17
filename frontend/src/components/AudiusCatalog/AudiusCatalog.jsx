import { useContext, useMemo } from "react";
import { MusicContext } from "../../context/ShopContext";
import SongItem from "../SongItem/SongItem";
import "./AudiusCatalog.tailwind.css";

const AudiusCatalog = () => {
  const { catalogSongs = [] } = useContext(MusicContext) || {};

  const visibleSongs = useMemo(() => catalogSongs.slice(0, 30), [catalogSongs]);
  if (!visibleSongs.length) return null;

  return (
    <section className="sw-audius-catalog sw-container-fluid">
      <div className="sw-audius-catalog-heading">
        <div>
          <span>DISCOVER</span>
          <h2>More music to explore</h2>
        </div>
        <p>Fresh picks mixed with music already on SoundWave.</p>
      </div>

      <div className="sw-audius-catalog-grid">
        {visibleSongs.map((song) => (
          <SongItem key={song._id} song={song} queue={visibleSongs} />
        ))}
      </div>
    </section>
  );
};

export default AudiusCatalog;
