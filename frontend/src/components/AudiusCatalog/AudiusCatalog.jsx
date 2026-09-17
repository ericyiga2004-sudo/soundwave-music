import { useContext, useMemo } from "react";
import { MusicContext } from "../../context/ShopContext";
import SongItem from "../SongItem/SongItem";
import "./AudiusCatalog.tailwind.css";

const AudiusCatalog = () => {
  const {
    audiusSongs = [],
    catalogSongs = [],
    catalogSource = "soundwave",
  } = useContext(MusicContext) || {};

  const visibleSongs = useMemo(() => {
    const source = audiusSongs.length ? audiusSongs : catalogSongs;
    return source.slice(0, 30);
  }, [audiusSongs, catalogSongs]);

  if (!visibleSongs.length) return null;

  const usingAudius = catalogSource === "audius" && audiusSongs.length > 0;

  return (
    <section className="sw-audius-catalog sw-container-fluid">
      <div className="sw-audius-catalog-heading">
        <div>
          <span>{usingAudius ? "AUDIUS DISCOVERY" : "SOUNDWAVE DISCOVERY"}</span>
          <h2>More music to explore</h2>
        </div>
        <p>
          {usingAudius
            ? "Playable tracks from the Audius catalog, alongside your Soundwave library."
            : "Audius is unavailable right now, so your normal Soundwave catalog is keeping this section alive."}
        </p>
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
