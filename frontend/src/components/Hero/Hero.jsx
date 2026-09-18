import SongActionMenu from "../SongActions/SongActionMenu";
import { useContext, useEffect, useMemo, useState } from "react";
import { Play, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MusicContext } from "../../context/ShopContext";
import { MusicPlayerContext } from "../../context/MainPlayerContext";
import { apiClient, authHeaders } from "../../config/apiClient";
import "./Hero.tailwind.css";
import { canUseSoundwaveSongApi } from "../../utils/songSource";
import { SongArtwork } from "../UI/CatalogArtwork";

const getArtist = (song) => song?.artist?.name || song?.artistName || song?.artist || "Unknown Artist";

const Hero = () => {
  const navigate = useNavigate();
  const { songs = [], catalogSongs = [], token, getAuthToken } = useContext(MusicContext);
  const { playSong } = useContext(MusicPlayerContext);
  const [personalized, setPersonalized] = useState([]);
  const authToken = getAuthToken?.() || token || "";

  useEffect(() => {
    if (!authToken) {
      setPersonalized([]);
      return undefined;
    }
    let controller = new AbortController();
    const loadPersonalized = () => {
      controller.abort();
      controller = new AbortController();
      apiClient.get("/api/recommend/home", {
        headers: authHeaders(authToken),
        params: { limit: 12 },
        signal: controller.signal,
      }).then(({ data }) => {
        if (!data?.success) return;
        const ranked = data.sections?.forYou || [];
        setPersonalized(ranked.slice(0, 8));
      }).catch(() => {});
    };
    loadPersonalized();
    window.addEventListener("soundwave-catalog-synced", loadPersonalized);
    return () => {
      controller.abort();
      window.removeEventListener("soundwave-catalog-synced", loadPersonalized);
    };
  }, [authToken]);

  const featured = useMemo(() => {
    if (personalized.length) return personalized.slice(0, 3);
    const browseSongs = catalogSongs.length ? catalogSongs : songs;
    return [...browseSongs]
      .sort((a, b) => {
        const scoreA = Number(a?.plays || 0) + Number(a?.likes || 0) * 2;
        const scoreB = Number(b?.plays || 0) + Number(b?.likes || 0) * 2;
        return scoreB - scoreA;
      })
      .slice(0, 3);
  }, [personalized, songs, catalogSongs]);

  const mainSong = featured[0];

  const playAndOpenHeroSong = (song, queue = featured.length ? featured : (catalogSongs.length ? catalogSongs : songs)) => {
    if (!song?._id) return;
    playSong?.(song, queue);
    if (canUseSoundwaveSongApi(song)) {
      navigate(`/song/${song._id}`, { state: { song, playlist: queue } });
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  };

  return (
    <section className="hero sw-container-fluid mx-auto w-full min-w-0 max-w-[1660px] px-4 pt-5 sm:px-6 sm:pt-6 xl:px-12 xl:pt-12">
      <div className="hero-heading-row !flex min-w-0 items-end justify-between gap-3">
        <div>
          <span>Listen Now</span>
          <h1 className="!text-[clamp(1.9rem,10vw,2.65rem)] sm:!text-[clamp(2rem,5vw,3.4rem)]">Made for the moment.</h1>
        </div>
        <button type="button" onClick={() => navigate("/explore")}>See All</button>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-3 xl:gap-6">
        <div className="min-w-0 xl:col-span-2">
          <article className="hero-feature-card !grid !min-h-0 min-w-0 !grid-cols-1 !gap-5 !p-[18px] sm:!p-6 md:!grid-cols-[minmax(0,1fr)_180px] md:!items-center xl:!min-h-[350px] xl:!grid-cols-[minmax(0,1fr)_minmax(190px,34%)] xl:!gap-8 xl:!p-[clamp(24px,4vw,46px)]">
            <div className="hero-feature-copy min-w-0">
              <span className="hero-kicker"><Sparkles size={14} /> {personalized.length ? "FOR YOU" : "FEATURED"}</span>
              <h2 className="!text-[clamp(1.9rem,9vw,3rem)] sm:!text-[clamp(2rem,5vw,4rem)] break-words">{mainSong?.title || "Your music, all in one beautiful place."}</h2>
              <p>
                {mainSong
                  ? `${getArtist(mainSong)} · ${personalized.length ? "Picked from your listening taste, country signals and plays." : "A standout from your SoundWave catalog."}`
                  : "Discover songs, albums, artists, radio and playlists with a cleaner listening experience."}
              </p>
              <div className="hero-buttons">
                <button
                  type="button"
                  className="hero-play-button"
                  onClick={() => (mainSong ? playSong?.(mainSong, featured.length ? featured : (catalogSongs.length ? catalogSongs : songs)) : navigate("/explore"))}
                >
                  <Play size={17} fill="currentColor" />
                  {mainSong ? "Play" : "Browse"}
                </button>
                <button type="button" className="hero-secondary-button" onClick={() => navigate("/radio")}>Start Radio</button>
              </div>
            </div>

            <div className="hero-artwork-wrap !w-full max-w-[220px] justify-self-start md:!w-[180px] md:justify-self-end xl:!w-[min(100%,300px)]" aria-hidden={!mainSong}>
              {mainSong ? (
                <button type="button" className="sw2323-song-art-button !block !h-full !w-full !border-0 !bg-transparent !p-0 !rounded-[inherit] overflow-hidden" onClick={() => playAndOpenHeroSong(mainSong)} aria-label={`Play and open ${mainSong.title}`}>
                  <SongArtwork src={mainSong.imageUrl || mainSong.image || mainSong.coverImage || mainSong.album?.coverImage} alt={mainSong.title || "Featured song"} />
                </button>
              ) : (
                <div className="hero-placeholder-art">♪</div>
              )}
            </div>
            {mainSong && canUseSoundwaveSongApi(mainSong) ? (
              <SongActionMenu
                song={mainSong}
                queue={featured.length ? featured : (catalogSongs.length ? catalogSongs : songs)}
                triggerClassName="sw2324-overlay-more sw2324-hero-main-more"
                triggerLabel={`More options for ${mainSong.title}`}
              />
            ) : null}
          </article>
        </div>

        <div className="min-w-0">
          <div className="hero-mini-stack !grid !h-auto grid-cols-1 !grid-rows-none gap-3 sm:grid-cols-2 xl:h-full xl:grid-cols-1 xl:!grid-rows-2">
            {(featured.length ? featured.slice(1, 3) : [null, null]).map((song, index) => (
              <article className="hero-mini-card !grid min-w-0 !min-h-[120px] !grid-cols-[76px_minmax(0,1fr)_44px] !gap-3 !p-3 sm:!grid-cols-[86px_minmax(0,1fr)_44px] xl:!min-h-[160px] xl:!grid-cols-[94px_minmax(0,1fr)_44px] xl:!gap-[14px] xl:!p-4" key={song?._id || index}>
                {song ? <button type="button" className="sw2323-song-art-button !block !h-[68px] !w-[68px] sm:!h-[86px] sm:!w-[86px] !border-0 !bg-transparent !p-0 !rounded-[11px] overflow-hidden" onClick={() => playAndOpenHeroSong(song, featured)} aria-label={`Play and open ${song.title}`}><SongArtwork src={song.imageUrl || song.image || song.coverImage || song.album?.coverImage} alt={song.title || "Song cover"} loading="lazy" /></button> : <div className="hero-mini-placeholder">♪</div>}
                <div>
                  <span>{index === 0 ? "Top Pick" : "Listen Again"}</span>
                  <h3>{song?.title || (index === 0 ? "New music, simplified" : "Your library, ready")}</h3>
                  <p>{song ? getArtist(song) : "SoundWave"}</p>
                </div>
                {song && (
                  <button type="button" className="!grid !h-11 !w-11 shrink-0 place-items-center !rounded-full" onClick={() => playSong?.(song, featured)} aria-label={`Play ${song.title}`}>
                    <Play className="!h-5 !w-5" fill="currentColor" />
                  </button>
                )}
                {song && canUseSoundwaveSongApi(song) ? (
                  <SongActionMenu
                    song={song}
                    queue={featured}
                    triggerClassName="sw2324-overlay-more sw2324-hero-mini-more"
                    triggerLabel={`More options for ${song.title}`}
                  />
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
