import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Music2, Play, RadioTower, Send, Sparkles, UsersRound, UserRoundSearch } from "lucide-react";
import { MusicContext } from "../context/ShopContext";
import { MusicPlayerContext } from "../context/MainPlayerContext";
import { useSocialHome } from "../hooks/useSocialHome";
import { getArtistName, getSongCover } from "../utils/catalog";
import AccountRequired from "../components/UI/AccountRequired";
import CatalogSkeleton from "../components/UI/CatalogSkeleton";
import EmptyState from "../components/UI/EmptyState";
import SocialPageHero from "../components/Social/SocialPageHero";
import { SOCIAL_IMAGES } from "../components/Social/socialImages";
import "./CSS/Social.css";
import "./CSS/SocialV20.css";

const personName = (user) => user?.username || user?.name || "Listener";
const compactDate = (date) => {
  const value = new Date(date || 0);
  if (Number.isNaN(value.getTime())) return "Now";
  const minutes = Math.max(0, Math.floor((Date.now() - value.getTime()) / 60000));
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
};

const modes = [
  { to: "/social/share", title: "Share a song", copy: "Send a real track straight to a friend with an instant notification.", icon: Send, image: SOCIAL_IMAGES.share },
  { to: "/social/today", title: "One Song Today", copy: "Pick the one track that represents your day.", icon: Music2, image: SOCIAL_IMAGES.today },
  { to: "/social/circles", title: "Sound Circles", copy: "Private groups for sharing songs with people you actually know.", icon: UsersRound, image: SOCIAL_IMAGES.circles },
  { to: "/social/rooms", title: "Pass the Aux", copy: "A live shared queue with voting and synced room updates.", icon: RadioTower, image: SOCIAL_IMAGES.rooms },
  { to: "/social/mix", title: "Friend Mix", copy: "Blend your listening taste with up to four friends.", icon: Sparkles, image: SOCIAL_IMAGES.mix },
  { to: "/social/people", title: "Taste Match", copy: "Find listeners with music taste close to yours.", icon: UserRoundSearch, image: SOCIAL_IMAGES.people },
];

const Social = () => {
  const navigate = useNavigate();
  const { token, getAuthToken } = useContext(MusicContext);
  const player = useContext(MusicPlayerContext);
  const authToken = getAuthToken?.() || token || "";
  const { home, loading, error, load, realtimeConnected, realtimeMode } = useSocialHome();

  if (!authToken) return <div className="sw-social-page"><AccountRequired /></div>;
  if (loading && !home) return <div className="sw-social-page"><CatalogSkeleton count={8} /></div>;
  if (error && !home) return <div className="sw-social-page"><EmptyState title="Social is unavailable" message={error} onRetry={() => load()} /></div>;

  const playActivitySong = (activity) => {
    if (!activity?.song?._id) return;
    player?.playSong?.(activity.song, [activity.song]);
    navigate(`/song/${activity.song._id}`, { state: { song: activity.song, playlist: [activity.song] } });
  };

  return (
    <div className="sw-social-page sw20-page container-fluid px-0">
      <SocialPageHero
        title="Music becomes social when it moves between people."
        description="SoundWave Social is now split into focused spaces. Share tracks directly, build private Circles, start live rooms, compare taste and keep every interaction easy to find."
        image={SOCIAL_IMAGES.home}
        live={realtimeConnected}
      >
        <button type="button" className="sw-primary-btn" onClick={() => navigate("/social/share")}><Send size={16} /> Share a song</button>
        <button type="button" className="sw-secondary-btn" onClick={() => navigate("/social/rooms")}><RadioTower size={16} /> Start a room</button>
      </SocialPageHero>

      <section className="sw20-mode-grid" aria-label="Social modes">
        {modes.map(({ to, title, copy, icon: Icon, image }) => (
          <button type="button" className="sw20-mode-card" key={to} onClick={() => navigate(to)}>
            <div className="sw20-mode-art"><img src={image.src} alt={image.alt} loading="lazy" decoding="async" /></div>
            <div className="sw20-mode-body">
              <span className="sw20-mode-icon"><Icon size={18} /></span>
              <span><strong>{title}</strong><small>{copy}</small></span>
              <ArrowRight size={17} />
            </div>
          </button>
        ))}
      </section>

      <div className="row g-3 g-xl-4 mt-1">
        <div className="col-12 col-xl-8">
          <section className="sw-social-panel sw20-panel">
            <div className="sw-social-section-heading">
              <div><span className="sw-social-kicker">Live network</span><h2>What your music people are doing</h2></div>
              <span className={realtimeConnected ? "sw20-realtime-pill online" : realtimeMode === "polling" ? "sw20-realtime-pill fallback" : "sw20-realtime-pill"}>{realtimeConnected ? "Live updates" : realtimeMode === "polling" ? "Updates on" : "Checking"}</span>
            </div>
            <div className="sw20-activity-grid">
              {(home?.feed || []).slice(0, 8).map((activity) => (
                <article className="sw20-activity-card" key={activity._id}>
                  <button
                    type="button"
                    className="sw20-activity-main"
                    onClick={() => activity.song?._id ? playActivitySong(activity) : activity.room?.code ? navigate(`/social/rooms/${activity.room.code}`) : activity.circle?._id ? navigate(`/social/circles/${activity.circle._id}`) : undefined}
                  >
                    <span className="sw-social-avatar small">
                      {activity.actor?.image ? <img src={activity.actor.image} alt="" /> : personName(activity.actor).slice(0, 1).toUpperCase()}
                    </span>
                    <span>
                      <strong>{personName(activity.actor)}</strong>
                      <small>{activity.note || activity.song?.title || activity.type?.replaceAll("_", " ") || "Music activity"}</small>
                      <em>{compactDate(activity.createdAt)}</em>
                    </span>
                    {activity.song ? <img className="sw20-activity-cover" src={getSongCover(activity.song)} alt="" loading="lazy" /> : <ArrowRight size={16} />}
                  </button>
                  {activity.song ? <div className="sw20-activity-song"><Play size={13} fill="currentColor" /><span>{activity.song.title}</span><small>{getArtistName(activity.song)}</small></div> : null}
                </article>
              ))}
              {!home?.feed?.length ? <div className="sw20-empty-card"><UsersRound size={24} /><strong>Your social feed starts with people.</strong><p>Follow listeners, share songs or start a Circle and activity will appear here automatically.</p><button type="button" className="sw-secondary-btn" onClick={() => navigate("/social/people")}>Find people</button></div> : null}
            </div>
          </section>
        </div>

        <div className="col-12 col-xl-4">
          <section className="sw-social-panel sw20-panel">
            <div className="sw-social-section-heading"><div><span className="sw-social-kicker">Today</span><h2>Fast status</h2></div></div>
            <div className="sw20-status-list">
              <button type="button" onClick={() => navigate("/social/today")}><Music2 size={17} /><span><strong>{home?.dailyPicks?.length || 0}</strong><small>songs picked today</small></span><ArrowRight size={15} /></button>
              <button type="button" onClick={() => navigate("/social/circles")}><UsersRound size={17} /><span><strong>{home?.circles?.length || 0}</strong><small>active Circles</small></span><ArrowRight size={15} /></button>
              <button type="button" onClick={() => navigate("/social/rooms")}><RadioTower size={17} /><span><strong>{home?.rooms?.length || 0}</strong><small>rooms you can reopen</small></span><ArrowRight size={15} /></button>
              <button type="button" onClick={() => navigate("/social/people")}><UserRoundSearch size={17} /><span><strong>{home?.following?.length || 0}</strong><small>people you follow</small></span><ArrowRight size={15} /></button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Social;
