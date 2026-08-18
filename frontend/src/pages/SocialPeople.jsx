import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Send, Sparkles, UserMinus, UserPlus, UsersRound } from "lucide-react";
import { apiClient } from "../config/apiClient";
import { useSocialHome } from "../hooks/useSocialHome";
import AccountRequired from "../components/UI/AccountRequired";
import CatalogSkeleton from "../components/UI/CatalogSkeleton";
import SocialPageHero from "../components/Social/SocialPageHero";
import { SOCIAL_IMAGES } from "../components/Social/socialImages";
import "./CSS/Social.css";
import "./CSS/SocialV20.css";

const nameOf = (user) => user?.username || user?.name || "Listener";
const sameId = (a, b) => String(a || "") === String(b || "");

const SocialPeople = () => {
  const navigate = useNavigate();
  const {
    authToken,
    headers,
    home,
    setHome,
    loading,
    realtimeConnected,
    realtimeMode,
    invalidateSocial,
  } = useSocialHome();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState("");
  const [status, setStatus] = useState("");

  const following = home?.following || [];
  const followingIds = useMemo(() => new Set(following.map((user) => String(user._id))), [following]);

  if (!authToken) return <div className="sw-social-page"><AccountRequired title="Sign in to discover music people" /></div>;
  if (loading && !home) return <div className="sw-social-page"><CatalogSkeleton count={8} /></div>;

  const rawUsers = results.length ? results : (home?.people || []);
  const users = results.length ? rawUsers : rawUsers.filter((user) => !followingIds.has(String(user._id)));

  const search = async (event) => {
    event.preventDefault();
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setBusy("search");
    setStatus("");
    try {
      const { data } = await apiClient.get("/api/social/users/search", { params: { q }, headers });
      if (data?.success) setResults(data.users || []);
    } catch {
      setStatus("Could not search listeners.");
    } finally {
      setBusy("");
    }
  };

  const follow = async (user) => {
    const userId = String(user?._id || user || "");
    if (!userId) return;
    setBusy(`follow-${userId}`);
    setStatus("");
    try {
      const { data } = await apiClient.post(`/api/social/users/${userId}/follow`, {}, { headers });
      if (!data?.success) throw new Error(data?.message || "Could not update follow");

      const returnedUser = data.user || (typeof user === "object" ? user : null);
      const patchedUser = returnedUser ? {
        ...returnedUser,
        isFollowing: Boolean(data.following),
        followersCount: Number(data.followersCount ?? returnedUser.followersCount ?? 0),
      } : null;

      const patch = (list = []) => list.map((item) => sameId(item._id, userId)
        ? { ...item, isFollowing: Boolean(data.following), followersCount: Number(data.followersCount ?? item.followersCount ?? 0) }
        : item);

      setResults((current) => patch(current));
      setHome((current) => {
        if (!current) return current;
        const nextPeople = patch(current.people || []);
        let nextFollowing = [...(current.following || [])];
        if (data.following) {
          if (!nextFollowing.some((item) => sameId(item._id, userId)) && patchedUser) nextFollowing.unshift(patchedUser);
          nextFollowing = nextFollowing.map((item) => sameId(item._id, userId) ? { ...item, ...(patchedUser || {}), isFollowing: true } : item);
        } else {
          nextFollowing = nextFollowing.filter((item) => !sameId(item._id, userId));
        }
        return { ...current, people: nextPeople, following: nextFollowing };
      });

      setStatus(data.following
        ? `${nameOf(patchedUser || user)} is now in Following and will stay in your music network.`
        : `${nameOf(patchedUser || user)} was removed from Following.`);
      invalidateSocial(data.following ? "follow" : "unfollow", { userId });
    } catch (error) {
      setStatus(error?.response?.data?.message || error.message || "Could not update follow.");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="sw-social-page sw20-page container-fluid px-0">
      <SocialPageHero
        kicker="Taste Match"
        title="Find people through the music, not a popularity contest."
        description="SoundWave compares listening preferences to surface people with overlapping genres, artists, languages and songs. Followed listeners stay in your network until you unfollow them, and changes update automatically."
        image={SOCIAL_IMAGES.people}
        live={realtimeConnected}
      >
        <button type="button" className="sw-secondary-btn" onClick={() => navigate("/social/share")}><Send size={16} /> Share with someone</button>
        <span className={realtimeConnected ? "sw20-realtime-pill online" : realtimeMode === "polling" ? "sw20-realtime-pill fallback" : "sw20-realtime-pill"}>
          {realtimeConnected ? "Live network" : realtimeMode === "polling" ? "Auto-updating" : "Syncing"}
        </span>
      </SocialPageHero>

      <section className="sw-social-panel sw20-panel sw22-following-panel">
        <div className="sw-social-section-heading">
          <div><span className="sw-social-kicker">Your network</span><h2>Following {following.length ? `(${following.length})` : ""}</h2></div>
          <UsersRound size={20} />
        </div>
        {following.length ? (
          <div className="sw22-following-grid">
            {following.map((user) => (
              <article className="sw22-following-card" key={user._id}>
                <button type="button" className="sw22-following-profile" onClick={() => navigate(`/u/${user._id}`)}>
                  <span className="sw-social-avatar sw20-avatar-lg">{user.image ? <img src={user.image} alt="" /> : nameOf(user).slice(0, 1).toUpperCase()}</span>{user.online ? <i className="sw-online-dot" title="Online" aria-label="Online" /> : null}
                  <span><strong>{nameOf(user)}</strong><small>{user.tasteMatch || 0}% taste match</small></span>
                </button>
                <div className="sw22-following-actions">
                  <button type="button" className="sw-secondary-btn" onClick={() => navigate("/social/share", { state: { recipientId: String(user._id), recipient: user } })}><Send size={14} /> Share</button>
                  <button type="button" className="sw-secondary-btn danger-soft" onClick={() => follow(user)} disabled={busy === `follow-${user._id}`}><UserMinus size={14} /> {busy === `follow-${user._id}` ? "Updating…" : "Unfollow"}</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="sw20-empty-card"><UsersRound size={24} /><strong>Your Following list is empty.</strong><p>Follow a listener below and they will be saved here until you choose to unfollow them.</p></div>
        )}
      </section>

      <section className="sw-social-panel sw20-panel mt-3 mt-xl-4">
        <div className="sw-social-section-heading"><div><span className="sw-social-kicker">People</span><h2>{results.length ? "Search results" : "Discover listeners"}</h2></div><Search size={20} /></div>
        <form className="sw20-people-search sw20-people-search-wide" onSubmit={search}>
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or username" />
          <button type="submit">{busy === "search" ? "Searching…" : "Search"}</button>
        </form>

        <div className="sw20-discovery-grid">
          {users.map((user) => {
            const isFollowing = Boolean(user.isFollowing || followingIds.has(String(user._id)));
            return (
              <article className="sw20-discovery-card" key={user._id}>
                <button type="button" className="sw20-discovery-profile" onClick={() => navigate(`/u/${user._id}`)}>
                  <span className="sw-social-avatar sw20-avatar-lg">{user.image ? <img src={user.image} alt="" /> : nameOf(user).slice(0, 1).toUpperCase()}</span>{user.online ? <i className="sw-online-dot" title="Online" aria-label="Online" /> : null}
                  <span><strong>{nameOf(user)}</strong><small>{user.bio || "SoundWave listener"}</small></span>
                </button>
                <div className="sw20-match-score"><Sparkles size={15} /><strong>{user.tasteMatch || 0}%</strong><span>taste match</span></div>
                <div className="sw20-discovery-actions">
                  <button type="button" className={isFollowing ? "sw-secondary-btn" : "sw-primary-btn"} onClick={() => follow(user)} disabled={busy === `follow-${user._id}`}>
                    {isFollowing ? <UserMinus size={14} /> : <UserPlus size={14} />} {busy === `follow-${user._id}` ? "Updating…" : isFollowing ? "Unfollow" : "Follow"}
                  </button>
                  <button type="button" className="sw-secondary-btn" onClick={() => navigate("/social/share", { state: { recipientId: String(user._id), recipient: user } })}><Send size={14} /> Share</button>
                </div>
              </article>
            );
          })}
          {!users.length ? <div className="sw20-empty-card"><Search size={24} /><strong>No listeners found.</strong><p>Try another name or clear the search to return to suggestions.</p></div> : null}
        </div>
      </section>
      {status ? <div className="sw-social-message mt-3">{status}</div> : null}
    </div>
  );
};

export default SocialPeople;
