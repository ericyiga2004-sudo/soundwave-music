import { useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Check, Search, Send, UserRoundPlus, X } from "lucide-react";
import { MusicContext } from "../context/ShopContext";
import { apiClient } from "../config/apiClient";
import { useSocialHome } from "../hooks/useSocialHome";
import AccountRequired from "../components/UI/AccountRequired";
import CatalogSkeleton from "../components/UI/CatalogSkeleton";
import SocialPageHero from "../components/Social/SocialPageHero";
import SocialSongPicker from "../components/Social/SocialSongPicker";
import { SOCIAL_IMAGES } from "../components/Social/socialImages";
import "./CSS/Social.css";
import "./CSS/SocialV20.css";

const nameOf = (user) => user?.username || user?.name || "Listener";
const SHARE_ENDPOINTS = [
  "/api/social/share-song",
  "/api/social/share",
  "/api/social/songs/share",
  "/api/share-song",
];

const postShareWithCompatibility = async (payload, headers) => {
  let lastError = null;
  for (const endpoint of SHARE_ENDPOINTS) {
    try {
      return await apiClient.post(endpoint, payload, { headers });
    } catch (error) {
      lastError = error;
      const status = Number(error?.response?.status || 0);
      const message = String(error?.response?.data?.message || "").toLowerCase();
      const routeMissing = status === 405 || (status === 404 && (!message || message.includes("api route not found") || message.includes("cannot post")));
      if (!routeMissing) throw error;
    }
  }
  const error = lastError || new Error("Song sharing is not available on this backend yet.");
  error.soundwaveShareRoutesMissing = true;
  throw error;
};

const SocialShare = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { songs = [], token, getAuthToken } = useContext(MusicContext);
  const { authToken, headers, home, loading, realtimeConnected, invalidateSocial } = useSocialHome();
  const [songId, setSongId] = useState("");
  const [selectedPeople, setSelectedPeople] = useState([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);
  const cleanToken = authToken || getAuthToken?.() || token || "";

  const suggested = useMemo(() => {
    const merged = [location.state?.recipient, ...(home?.following || []), ...(home?.people || []), ...results].filter(Boolean);
    const map = new Map();
    merged.forEach((user) => user?._id && map.set(String(user._id), user));
    return [...map.values()].slice(0, 18);
  }, [home, results, location.state?.recipient]);

  useEffect(() => {
    const recipientId = String(location.state?.recipientId || "");
    if (recipientId) setSelectedPeople((current) => current.includes(recipientId) ? current : [recipientId, ...current].slice(0, 10));
  }, [location.state?.recipientId]);

  if (!cleanToken) return <div className="sw-social-page"><AccountRequired title="Sign in to share songs" /></div>;
  if (loading && !home) return <div className="sw-social-page"><CatalogSkeleton count={8} /></div>;

  const togglePerson = (userId) => {
    setSelectedPeople((current) => current.includes(userId)
      ? current.filter((id) => id !== userId)
      : current.length >= 10 ? current : [...current, userId]);
  };

  const search = async (event) => {
    event?.preventDefault();
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    try {
      const { data } = await apiClient.get("/api/social/users/search", { params: { q }, headers });
      if (data?.success) setResults(data.users || []);
    } catch {
      setStatus("Could not search listeners right now.");
    }
  };

  const share = async (event) => {
    event.preventDefault();
    if (!songId) return setStatus("Choose a song first.");
    if (!selectedPeople.length) return setStatus("Choose at least one person.");
    setSending(true);
    setStatus("");
    try {
      const { data } = await postShareWithCompatibility({
        songId,
        userIds: selectedPeople,
        message: message.trim(),
      }, headers);
      if (!data?.success) throw new Error(data?.message || "Could not share song");
      const names = (data.sharedWith || []).map(nameOf).slice(0, 3).join(", ");
      setStatus(`Shared live${names ? ` with ${names}` : ""}. Their notification arrives without reloading.`);
      setSelectedPeople([]);
      setMessage("");
      invalidateSocial("share-song", { songId, recipients: selectedPeople });
    } catch (error) {
      if (error?.soundwaveShareRoutesMissing) {
        setStatus("Share routes are missing on the deployed SoundWave API. Deploy the matching V23.2 backend, then this button will work without changing the page.");
      } else {
        setStatus(error?.response?.data?.message || error.message || "Could not share song.");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="sw-social-page sw20-page container-fluid px-0">
      <SocialPageHero
        kicker="Direct sharing"
        title="Send a song. They see it live."
        description="Choose a real SoundWave track, choose the people, add a short note and send. The receiver gets an in-app notification immediately while SoundWave is open—no refresh required."
        image={SOCIAL_IMAGES.share}
        live={realtimeConnected}
      >
        <button type="button" className="sw-secondary-btn" onClick={() => navigate("/social/people")}><UserRoundPlus size={16} /> Find more people</button>
      </SocialPageHero>

      <div className="sw20-share-flow">
        <section className="sw-social-panel sw20-panel">
          <div className="sw20-step-heading"><span>1</span><div><h2>Choose the song</h2><p>Preview it first so you know exactly what you are sending.</p></div></div>
          <SocialSongPicker songs={songs} value={songId} onChange={setSongId} label="Song to share" maxVisible={9} />
        </section>

        <section className="sw-social-panel sw20-panel">
          <div className="sw20-step-heading"><span>2</span><div><h2>Choose people</h2><p>Select up to 10 listeners. Your follows appear first.</p></div></div>
          <form className="sw20-people-search" onSubmit={search}>
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search listeners" />
            <button type="submit">Search</button>
          </form>
          <div className="sw20-person-grid">
            {suggested.map((user) => {
              const selected = selectedPeople.includes(String(user._id));
              return (
                <button type="button" className={selected ? "sw20-person-card selected" : "sw20-person-card"} key={user._id} onClick={() => togglePerson(String(user._id))}>
                  <span className="sw-social-avatar">{user.image ? <img src={user.image} alt="" /> : nameOf(user).slice(0, 1).toUpperCase()}</span>{user.online ? <i className="sw-online-dot" title="Online" aria-label="Online" /> : null}
                  <span><strong>{nameOf(user)}</strong><small>{Number(user.tasteMatch || 0)}% taste match</small></span>
                  <i>{selected ? <Check size={15} /> : <UserRoundPlus size={15} />}</i>
                </button>
              );
            })}
          </div>
          {selectedPeople.length ? <div className="sw20-selected-count"><Check size={15} /> {selectedPeople.length} selected <button type="button" onClick={() => setSelectedPeople([])}><X size={14} /> Clear</button></div> : null}
        </section>

        <form className="sw-social-panel sw20-panel sw20-send-panel" onSubmit={share}>
          <div className="sw20-step-heading"><span>3</span><div><h2>Add context and send</h2><p>A short reason makes a shared song feel personal.</p></div></div>
          <textarea value={message} onChange={(event) => setMessage(event.target.value.slice(0, 240))} placeholder="You need to hear the chorus at 1:42…" rows={3} />
          <div className="sw20-send-row">
            <small>{message.length}/240</small>
            <button type="submit" className="sw-primary-btn" disabled={sending || !songId || !selectedPeople.length}><Send size={16} /> {sending ? "Sending…" : "Share song live"}</button>
          </div>
          {status ? <div className="sw-social-message mt-3">{status}</div> : null}
        </form>
      </div>
    </div>
  );
};

export default SocialShare;
