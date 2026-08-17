import { useContext, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { HeartHandshake, LockKeyhole, Play, UserPlus, UsersRound } from "lucide-react";
import { MusicContext } from "../context/ShopContext";
import { MusicPlayerContext } from "../context/MainPlayerContext";
import { apiClient, authHeaders } from "../config/apiClient";
import { getArtistName, getSongCover } from "../utils/catalog";
import CatalogSkeleton from "../components/UI/CatalogSkeleton";
import EmptyState from "../components/UI/EmptyState";
import "./CSS/Social.css";

const personName = (user) => user?.username || user?.name || "SoundWave listener";

const SocialProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { token, getAuthToken } = useContext(MusicContext);
  const player = useContext(MusicPlayerContext);
  const authToken = getAuthToken?.() || token || "";
  const [profile, setProfile] = useState(null);
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true); setError("");
    try {
      const { data } = await apiClient.get(`/api/social/users/${userId}`, { headers: authHeaders(authToken) });
      if (!data?.success) throw new Error(data?.message || "Profile not available");
      setProfile(data);
      if (authToken && data.user?._id && data.user.socialSettings?.allowTasteMatch !== false) {
        apiClient.get(`/api/social/users/${userId}/match`, { headers: authHeaders(authToken) }).then(({data:matchData}) => { if (matchData?.success) setMatch(matchData); }).catch(()=>{});
      }
    } catch (err) { setError(err?.response?.data?.message || err.message || "Profile not available"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [userId, authToken]);

  const follow = async () => {
    if (!authToken) { navigate("/account"); return; }
    setBusy(true);
    try {
      const { data } = await apiClient.post(`/api/social/users/${userId}/follow`, {}, { headers: authHeaders(authToken) });
      if (data?.success) setProfile((current) => current ? { ...current, user: { ...current.user, isFollowing: data.following, followersCount: data.followersCount } } : current);
    } finally { setBusy(false); }
  };

  if (loading) return <div className="sw-social-page"><CatalogSkeleton count={8}/></div>;
  if (error || !profile?.user) return <div className="sw-social-page"><EmptyState title="Profile unavailable" message={error || "This music profile is private."} onRetry={load}/></div>;
  const user = profile.user;

  return (
    <div className="sw-social-page sw-profile-page">
      <header className="sw-profile-hero">
        <span className="sw-profile-avatar">{user.image ? <img src={user.image} alt=""/> : personName(user).slice(0,1).toUpperCase()}</span>
        <div className="sw-profile-copy"><span className="sw-social-kicker">Music profile</span><h1>{personName(user)}</h1><p>{user.bio || "Listening on SoundWave."}</p><div className="sw-profile-counts"><span><strong>{user.followersCount || 0}</strong> followers</span><span><strong>{user.followingCount || 0}</strong> following</span></div></div>
        <div className="sw-profile-actions">
          {authToken ? <button type="button" className={user.isFollowing ? "sw-secondary-btn" : "sw-primary-btn"} onClick={follow} disabled={busy}><UserPlus size={16}/>{user.isFollowing ? "Following" : "Follow"}</button> : <button type="button" className="sw-primary-btn" onClick={() => navigate("/account")}><LockKeyhole size={16}/> Sign in to follow</button>}
          <button type="button" className="sw-secondary-btn" onClick={() => navigate("/social")}><UsersRound size={16}/> Social</button>
        </div>
      </header>

      <div className="row g-3 g-xl-4 mt-1">
        <div className="col-12 col-lg-4">
          <section className="sw-social-panel h-100"><div className="sw-social-section-heading"><div><span className="sw-social-kicker">Compatibility</span><h2>Taste Match</h2></div><HeartHandshake size={20}/></div>
            {authToken ? match ? <div className="sw-match-score"><strong>{match.score}%</strong><span>music match</span><p>{[...(match.overlap?.genres || []), ...(match.overlap?.languages || [])].slice(0,5).join(" · ") || "Keep listening to reveal more overlap."}</p></div> : <p className="sw-social-muted">Taste Match is still learning or this listener keeps it private.</p> : <p className="sw-social-muted">Create an account to compare your music taste.</p>}
          </section>
        </div>
        <div className="col-12 col-lg-8">
          <section className="sw-social-panel h-100"><div className="sw-social-section-heading"><div><span className="sw-social-kicker">Identity</span><h2>Top taste</h2></div></div><div className="sw-tag-group">{(profile.topGenres || []).map((tag)=><span key={`g-${tag}`}>{tag}</span>)}{(profile.topLanguages || []).map((tag)=><span key={`l-${tag}`}>{tag}</span>)}</div><div className="sw-profile-artists">{(profile.topArtists || []).map((artist)=><button type="button" key={artist._id} onClick={()=>navigate(`/artist/${artist._id}`)}><span className="sw-social-avatar small">{artist.image?<img src={artist.image} alt=""/>:String(artist.name||"A").slice(0,1)}</span><span>{artist.name}</span></button>)}</div></section>
        </div>
      </div>

      <section className="sw-social-panel mt-3 mt-xl-4">
        <div className="sw-social-section-heading"><div><span className="sw-social-kicker">Recent listening</span><h2>{user.socialSettings?.listeningActivity === false ? "Listening activity is private" : "Recently played"}</h2></div></div>
        {(profile.recentlyPlayed || []).length ? <div className="sw-profile-recent">{profile.recentlyPlayed.map((song,index)=><button type="button" key={`${song._id}-${index}`} onClick={()=>{player?.playSong?.(song,profile.recentlyPlayed);navigate(`/song/${song._id}`,{state:{song,playlist:profile.recentlyPlayed}})}}><img src={getSongCover(song)} alt=""/><span><strong>{song.title}</strong><small>{getArtistName(song)}</small></span><Play size={16}/></button>)}</div> : <p className="sw-social-muted">No public listening activity to show.</p>}
      </section>
    </div>
  );
};

export default SocialProfile;
