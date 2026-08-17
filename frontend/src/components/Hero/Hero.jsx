import { useContext, useMemo } from "react";
import { Play, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MusicContext } from "../../context/ShopContext";
import { MusicPlayerContext } from "../../context/MainPlayerContext";
import "./Hero.css";

const getArtist = (song) => song?.artist?.name || song?.artistName || song?.artist || "Unknown Artist";

const Hero = () => {
  const navigate = useNavigate();
  const { songs = [] } = useContext(MusicContext);
  const { playSong } = useContext(MusicPlayerContext);

  const featured = useMemo(() => {
    return [...songs]
      .sort((a, b) => Number(b?.plays || 0) - Number(a?.plays || 0))
      .slice(0, 3);
  }, [songs]);

  const mainSong = featured[0];

  return (
    <section className="hero container-fluid px-3 px-sm-4 px-xl-5 pt-4 pt-xl-5">
      <div className="hero-heading-row">
        <div>
          <span>Listen Now</span>
          <h1>Made for the moment.</h1>
        </div>
        <button type="button" onClick={() => navigate("/explore")}>See All</button>
      </div>

      <div className="row g-3 g-xl-4">
        <div className="col-12 col-xl-8">
          <article className="hero-feature-card">
            <div className="hero-feature-copy">
              <span className="hero-kicker"><Sparkles size={14} /> FEATURED</span>
              <h2>{mainSong?.title || "Your music, all in one beautiful place."}</h2>
              <p>
                {mainSong
                  ? `${getArtist(mainSong)} · A standout from your SoundWave catalog.`
                  : "Discover songs, albums, artists, radio and playlists with a cleaner listening experience."}
              </p>
              <div className="hero-buttons">
                <button
                  type="button"
                  className="hero-play-button"
                  onClick={() => (mainSong ? playSong?.(mainSong, featured.length ? featured : songs) : navigate("/explore"))}
                >
                  <Play size={17} fill="currentColor" />
                  {mainSong ? "Play" : "Browse"}
                </button>
                <button type="button" className="hero-secondary-button" onClick={() => navigate("/radio")}>Start Radio</button>
              </div>
            </div>

            <div className="hero-artwork-wrap" aria-hidden={!mainSong}>
              {mainSong?.imageUrl ? (
                <img src={mainSong.imageUrl} alt={mainSong.title || "Featured song"} />
              ) : (
                <div className="hero-placeholder-art">♪</div>
              )}
            </div>
          </article>
        </div>

        <div className="col-12 col-xl-4">
          <div className="hero-mini-stack">
            {(featured.length ? featured.slice(1, 3) : [null, null]).map((song, index) => (
              <article className="hero-mini-card" key={song?._id || index}>
                {song?.imageUrl ? <img src={song.imageUrl} alt="" loading="lazy" /> : <div className="hero-mini-placeholder">♪</div>}
                <div>
                  <span>{index === 0 ? "Top Pick" : "Listen Again"}</span>
                  <h3>{song?.title || (index === 0 ? "New music, simplified" : "Your library, ready")}</h3>
                  <p>{song ? getArtist(song) : "SoundWave"}</p>
                </div>
                {song && (
                  <button type="button" onClick={() => playSong?.(song, featured)} aria-label={`Play ${song.title}`}>
                    <Play size={15} fill="currentColor" />
                  </button>
                )}
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
