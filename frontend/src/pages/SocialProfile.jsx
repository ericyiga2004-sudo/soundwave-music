import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { HeartHandshake, LockKeyhole, Play, Send, UserMinus, UserPlus } from "lucide-react";
import { MusicContext } from "../context/ShopContext";
import { MusicPlayerContext } from "../context/MainPlayerContext";
import { useRealtime } from "../context/RealtimeContext";
import { apiClient, authHeaders } from "../config/apiClient";
import { getArtistName, getSongCover } from "../utils/catalog";
import CatalogSkeleton from "../components/UI/CatalogSkeleton";
import EmptyState from "../components/UI/EmptyState";
import SocialNav from "../components/Social/SocialNav";
import "./CSS/Social.css";
import "./CSS/SocialV20.css";

const personName = (user) => user?.username || user?.name || "SoundWave listener";

const SocialProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { token, getAuthToken } = useContext(MusicContext);
  const player = useContext(MusicPlayerContext);
  const { socket, connected, mode } = useRealtime();
  const authToken = getAuthToken?.() || token || "";
  const headers = useMemo(() => authHeaders(authToken), [authToken]);
  const [profile, setProfile] = useState(null);
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    if (!quiet) setError("");
    try {
      const { data } = await apiClient.get(`/api/social/users/${userId}`, { headers });
      if (!data?.success) throw new Error(data?.message || "Profile not available");
      setProfile(data);
      if (authToken && data.user?._id && data.user.socialSettings?.allowTasteMatch !== false) {
        apiClient.get(`/api/social/users/${userId}/match`, { headers })
          .then(({ data: matchData }) => { if (matchData?.success) setMatch(matchData); })
          .catch(() => {});
      }
    } catch (err) {
      if (!quiet) setError(err?.response?.data?.message || err.message || "Profile not available");
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => { load(); }, [userId, authToken]);

  useEffect(() => {
    if (!socket || !userId) return undefined;
    const refreshProfile = (event) => {
      const ids = [event?.userId, event?.targetId, event?.actorId].filter(Boolean).map(String);
      if (!ids.length || ids.includes(String(userId))) load({ quiet: true });
    };
    socket.on("profile:update", refreshProfile);
    socket.on("people:update", refreshProfile);
    socket.on("taste:update", refreshProfile);
    return () => {
      socket.off("profile:update", refreshProfile);
      socket.off("people:update", refreshProfile);
      socket.off("taste:update", refreshProfile);
    };
  }, [socket, userId, authToken]);

  useEffect(() => {
    if (!authToken) return undefined;
    const refresh = () => {
      if (document.visibilityState === "visible") load({ quiet: true });
    };
    // Even with SSE, a quiet low-frequency profile refresh keeps third-party
    // follower counts/taste summaries current without requiring a manual reload.
    const interval = window.setInterval(refresh, connected ? 20000 : mode === "polling" ? 7000 : 12000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("soundwave-social-mutated", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("soundwave-social-mutated", refresh);
    };
  }, [authToken, connected, mode, userId]);

  const follow = async () => {
    if (!authToken) { navigate("/account"); return; }
    setBusy(true);
    try {
      const { data } = await apiClient.post(`/api/social/users/${userId}/follow`, {}, { headers });
      if (data?.success) {
        setProfile((current) => current ? {
          ...current,
          user: {
            ...current.user,
            ...(data.user || {}),
            isFollowing: data.following,
            followersCount: data.followersCount,
          },
        } : current);
        window.dispatchEvent(new CustomEvent("soundwave-social-mutated", {
          detail: { reason: data.following ? "follow" : "unfollow", userId },
        }));
      }
    } finally { setBusy(false); }
  };

  if (loading) return <div className="sw-social-page"><CatalogSkeleton count={8} /></div>;
  if (error || !profile?.user) return <div className="sw-social-page"><EmptyState title="Profile unavailable" message={error || "This music profile is private."} onRetry={() => load()} /></div>;
  const user = profile.user;

  return (
    <div className="sw-social-page sw-profile-page sw20-page">
      <SocialNav />
      <header className="sw-profile-hero">
        <span className="sw-profile-avatar">{user.image ? <img src={user.image} alt="" /> : personName(user).slice(0, 1).toUpperCase()}</span>
        <div className="sw-profile-copy">
          <div className="sw20-detail-kicker">
            <span className="sw-social-kicker">Music profile</span>
            <span className={connected ? "sw20-realtime-pill online" : mode === "polling" ? "sw20-realtime-pill fallback" : "sw20-realtime-pill"}>{connected ? "Live profile" : mode === "polling" ? "Auto-updating" : "Syncing"}</span>
          </div>
          <h1>{personName(user)} {user.online ? <span className="sw-profile-online"><i className="sw-online-dot" /> Online</span> : null}</h1><p>{user.bio || "Listening on SoundWave."}</p>
          <div className="sw-profile-counts"><span><strong>{user.followersCount || 0}</strong> followers</span><span><strong>{user.followingCount || 0}</strong> following</span></div>
        </div>
        <div className="sw-profile-actions">
          {authToken ? (
            <button type="button" className={user.isFollowing ? "sw-secondary-btn" : "sw-primary-btn"} onClick={follow} disabled={busy}>
              {user.isFollowing ? <UserMinus size={16} /> : <UserPlus size={16} />}{busy ? "Updating…" : user.isFollowing ? "Unfollow" : "Follow"}
            </button>
          ) : <button type="button" className="sw-primary-btn" onClick={() => navigate("/account")}><LockKeyhole size={16} /> Sign in to follow</button>}
          <button type="button" className="sw-secondary-btn" onClick={() => navigate("/social/share", { state: { recipientId: String(user._id), recipient: user } })}><Send size={16} /> Share a song</button>
        </div>
      </header>

      <div className="row g-3 g-xl-4 mt-1">
        <div className="col-12 col-lg-4">
          <section className="sw-social-panel h-100"><div className="sw-social-section-heading"><div><span className="sw-social-kicker">Compatibility</span><h2>Taste Match</h2></div><HeartHandshake size={20} /></div>
            {authToken ? match ? <div className="sw-match-score"><strong>{match.score}%</strong><span>music match</span><p>{[...(match.overlap?.genres || []), ...(match.overlap?.languages || [])].slice(0, 5).join(" · ") || "Keep listening to reveal more overlap."}</p></div> : <p className="sw-social-muted">Taste Match is still learning or this listener keeps it private.</p> : <p className="sw-social-muted">Create an account to compare your music taste.</p>}
          </section>
        </div>
        <div className="col-12 col-lg-8">
          <section className="sw-social-panel h-100"><div className="sw-social-section-heading"><div><span className="sw-social-kicker">Identity</span><h2>Top taste</h2></div></div><div className="sw-tag-group">{(profile.topGenres || []).map((tag) => <span key={`g-${tag}`}>{tag}</span>)}{(profile.topLanguages || []).map((tag) => <span key={`l-${tag}`}>{tag}</span>)}</div><div className="sw-profile-artists">{(profile.topArtists || []).map((artist) => <button type="button" key={artist._id} onClick={() => navigate(`/artist/${artist._id}`)}><span className="sw-social-avatar small">{artist.image ? <img src={artist.image} alt="" /> : String(artist.name || "A").slice(0, 1)}</span><span>{artist.name}</span></button>)}</div></section>
        </div>
      </div>

      <section className="sw-social-panel mt-3 mt-xl-4">
        <div className="sw-social-section-heading"><div><span className="sw-social-kicker">Recent listening</span><h2>{user.socialSettings?.listeningActivity === false ? "Listening activity is private" : "Recently played"}</h2></div></div>
        {(profile.recentlyPlayed || []).length ? <div className="sw-profile-recent">{profile.recentlyPlayed.map((song, index) => <button type="button" key={`${song._id}-${index}`} onClick={() => { player?.playSong?.(song, profile.recentlyPlayed); navigate(`/song/${song._id}`, { state: { song, playlist: profile.recentlyPlayed } }); }}><img src={getSongCover(song)} alt="" /><span><strong>{song.title}</strong><small>{getArtistName(song)}</small></span><Play size={16} /></button>)}</div> : <p className="sw-social-muted">No public listening activity to show.</p>}
      </section>
    </div>
  );
};

export default SocialProfile;
