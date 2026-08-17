import { useContext, useMemo } from "react";
import { Play, Radio as RadioIcon, Shuffle, Sparkles, Waves } from "lucide-react";
import { MusicContext } from "../context/ShopContext";
import { MusicPlayerContext } from "../context/MainPlayerContext";
import "./CSS/Radio.css";

const getArtist = (song) => song?.artist?.name || song?.artistName || song?.artist || "Unknown Artist";

const shuffleSongs = (songs = []) => {
  const copy = [...songs];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const Radio = () => {
  const { songs = [] } = useContext(MusicContext);
  const { playSong } = useContext(MusicPlayerContext);

  const genres = useMemo(() => {
    const values = [...new Set(songs.map((song) => song?.genre).filter(Boolean))];
    return values.slice(0, 4);
  }, [songs]);

  const stations = useMemo(() => {
    const top = [...songs].sort((a, b) => Number(b?.plays || 0) - Number(a?.plays || 0));
    const latest = [...songs].sort(
      (a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime()
    );

    const base = [
      {
        id: "soundwave-one",
        title: "SoundWave One",
        subtitle: "Big songs, new voices, all day.",
        icon: RadioIcon,
        queue: top.length ? top : songs,
      },
      {
        id: "discovery",
        title: "Discovery Station",
        subtitle: "A fresh mix built from your catalog.",
        icon: Sparkles,
        queue: shuffleSongs(songs),
      },
      {
        id: "new-music",
        title: "New Music Mix",
        subtitle: "Recent releases, continuously refreshed.",
        icon: Waves,
        queue: latest.length ? latest : songs,
      },
    ];

    genres.forEach((genre) => {
      const queue = songs.filter((song) => String(song?.genre || "").toLowerCase() === String(genre).toLowerCase());
      if (queue.length) {
        base.push({
          id: `genre-${genre}`,
          title: `${genre} Radio`,
          subtitle: `A continuous station for ${genre}.`,
          icon: RadioIcon,
          queue: shuffleSongs(queue),
        });
      }
    });

    return base;
  }, [genres, songs]);

  const startStation = (station) => {
    const queue = station.queue?.filter(Boolean) || [];
    if (!queue.length) return;
    playSong?.(queue[0], queue);
  };

  return (
    <div className="radio-page container-fluid px-3 px-sm-4 px-xl-5 py-4 py-xl-5">
      <header className="radio-page-header">
        <span>Live & continuous</span>
        <h1>Radio</h1>
        <p>Press play once and let SoundWave keep the music moving.</p>
      </header>

      <section className="radio-featured-card">
        <div>
          <span className="radio-live-pill">LIVE</span>
          <h2>SoundWave One</h2>
          <p>Hits, discoveries and standout releases from across your music catalog.</p>
        </div>
        <button type="button" onClick={() => startStation(stations[0])} disabled={!songs.length}>
          <Play size={18} fill="currentColor" />
          Play
        </button>
      </section>

      <div className="radio-section-heading">
        <div>
          <small>Stations for you</small>
          <h2>Listen without choosing every song</h2>
        </div>
      </div>

      <div className="row g-3 g-xl-4">
        {stations.map((station, index) => {
          const Icon = station.icon;
          const image = station.queue?.find((song) => song?.imageUrl)?.imageUrl;
          const preview = station.queue?.slice(0, 2) || [];
          return (
            <div className="col-12 col-sm-6 col-xl-4" key={station.id}>
              <article className="radio-station-card h-100">
                <div className={`radio-station-art radio-station-art-${(index % 4) + 1}`}>
                  {image ? <img src={image} alt="" loading="lazy" /> : <Icon size={42} />}
                  <span className="radio-station-overlay" />
                  <Icon className="radio-station-icon" size={28} />
                </div>
                <div className="radio-station-body">
                  <div className="radio-station-copy">
                    <h3>{station.title}</h3>
                    <p>{station.subtitle}</p>
                    {preview.length > 0 && (
                      <small>
                        {preview.map((song) => `${song.title} — ${getArtist(song)}`).join(" · ")}
                      </small>
                    )}
                  </div>
                  <button type="button" onClick={() => startStation(station)} disabled={!station.queue?.length}>
                    {station.id === "discovery" ? <Shuffle size={17} /> : <Play size={17} fill="currentColor" />}
                  </button>
                </div>
              </article>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Radio;
