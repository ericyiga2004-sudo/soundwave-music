import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Copy, LogOut, Play, Plus, RadioTower, UsersRound } from "lucide-react";
import { MusicContext } from "../context/ShopContext";
import { MusicPlayerContext } from "../context/MainPlayerContext";
import { useRealtime } from "../context/RealtimeContext";
import { apiClient, authHeaders } from "../config/apiClient";
import { getArtistName, getSongCover } from "../utils/catalog";
import AccountRequired from "../components/UI/AccountRequired";
import CatalogSkeleton from "../components/UI/CatalogSkeleton";
import EmptyState from "../components/UI/EmptyState";
import SocialSongPicker from "../components/Social/SocialSongPicker";
import SocialNav from "../components/Social/SocialNav";
import { SOCIAL_IMAGES } from "../components/Social/socialImages";
import "./CSS/Social.css";
import "./CSS/SocialV20.css";

const nameOf = (user) => user?.username || user?.name || "Listener";

const Circle = () => {
  const { circleId } = useParams();
  const navigate = useNavigate();
  const { token, getAuthToken, songs = [] } = useContext(MusicContext);
  const player = useContext(MusicPlayerContext);
  const { socket, connected, mode } = useRealtime();
  const authToken = getAuthToken?.() || token || "";
  const headers = useMemo(() => authHeaders(authToken), [authToken]);
  const [circle, setCircle] = useState(null);
  const [loading, setLoading] = useState(Boolean(authToken));
  const [error, setError] = useState("");
  const [songId, setSongId] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  const load = async ({ quiet = false } = {}) => {
    if (!authToken) return;
    if (!quiet) setLoading(true);
    if (!quiet) setError("");
    try {
      const { data } = await apiClient.get(`/api/social/circles/${circleId}`, { headers });
      if (!data?.success) throw new Error(data?.message || "Could not load Circle");
      setCircle(data.circle);
    } catch (errorValue) {
      if (!quiet) setError(errorValue?.response?.data?.message || errorValue.message || "Could not load Circle");
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [circleId, authToken]);

  useEffect(() => {
    if (!socket || !circleId) return undefined;
    const onUpdate = (event) => {
      if (String(event?.circleId) === String(circleId)) load({ quiet: true });
    };
    socket.on("circle:update", onUpdate);
    return () => socket.off("circle:update", onUpdate);
  }, [socket, circleId, authToken]);

  useEffect(() => {
    if (!authToken || connected || mode !== "polling") return undefined;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") load({ quiet: true });
    }, 6000);
    return () => clearInterval(interval);
  }, [authToken, circleId, connected, mode]);

  useEffect(() => {
    if (!authToken) return undefined;
    const refresh = () => {
      if (document.visibilityState === "visible") load({ quiet: true });
    };
    const onMutation = (event) => {
      const eventCircle = String(event?.detail?.circleId || "");
      if (!eventCircle || eventCircle === String(circleId)) refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("soundwave-social-mutated", onMutation);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("soundwave-social-mutated", onMutation);
    };
  }, [authToken, circleId]);

  if (!authToken) return <div className="sw-social-page"><AccountRequired title="Sign in to open this Circle" /></div>;
  if (loading && !circle) return <div className="sw-social-page"><CatalogSkeleton count={8} /></div>;
  if (error && !circle) return <div className="sw-social-page"><EmptyState title="Circle unavailable" message={error} onRetry={() => load()} /></div>;
  if (!circle) return null;

  const addSong = async (event) => {
    event.preventDefault();
    if (!songId) return;
    try {
      const { data } = await apiClient.post(`/api/social/circles/${circleId}/songs`, { songId, note }, { headers });
      if (data?.success) {
        setSongId("");
        setNote("");
        setMessage("Song shared. Circle members receive the update live.");
        window.dispatchEvent(new CustomEvent("soundwave-social-mutated", { detail: { reason: "circle-song", circleId, songId } }));
        load({ quiet: true });
      }
    } catch (errorValue) {
      setMessage(errorValue?.response?.data?.message || "Could not share song.");
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(circle.inviteCode);
      setMessage("Invite code copied.");
    } catch {
      setMessage(`Invite code: ${circle.inviteCode}`);
    }
  };

  const leave = async () => {
    try {
      const { data } = await apiClient.post(`/api/social/circles/${circleId}/leave`, {}, { headers });
      if (data?.success) {
        window.dispatchEvent(new CustomEvent("soundwave-social-mutated", { detail: { reason: "circle-leave", circleId } }));
        navigate("/social/circles");
      }
      else setMessage(data?.message || "Could not leave Circle.");
    } catch (errorValue) {
      setMessage(errorValue?.response?.data?.message || "Could not leave Circle.");
    }
  };

  const startRoom = async () => {
    try {
      const { data } = await apiClient.post("/api/social/rooms", { name: `${circle.name} — Pass the Aux` }, { headers });
      if (data?.success) {
        window.dispatchEvent(new CustomEvent("soundwave-social-mutated", { detail: { reason: "room-create", code: data.room.code } }));
        navigate(`/social/rooms/${data.room.code}`);
      }
    } catch {
      setMessage("Could not start room.");
    }
  };

  const circleSongs = (circle.songs || []).map((entry) => entry.song).filter(Boolean);

  return (
    <div className="sw-social-page sw20-page">
      <SocialNav />
      <header className="sw-circle-hero sw20-detail-hero">
        <span className="sw-circle-hero-icon"><UsersRound size={28} /></span>
        <div>
          <div className="sw20-detail-kicker"><span className="sw-social-kicker">Sound Circle</span><span className={connected ? "sw20-realtime-pill online" : mode === "polling" ? "sw20-realtime-pill fallback" : "sw20-realtime-pill"}>{connected ? "Live" : mode === "polling" ? "Updates on" : "Checking"}</span></div>
          <h1>{circle.name}</h1>
          <p>{circle.description || "A private place to share music with people you know."}</p>
          <div className="sw-circle-code"><code>{circle.inviteCode}</code><button type="button" onClick={copy}><Copy size={14} /> Copy invite</button></div>
        </div>
        <div className="sw-circle-hero-actions"><button className="sw-primary-btn" type="button" onClick={startRoom}><RadioTower size={16} /> Pass the Aux</button><button className="sw-secondary-btn" type="button" onClick={leave}><LogOut size={16} /> Leave</button></div>
        <div className="sw20-detail-visual"><img src={SOCIAL_IMAGES.circles.src} alt={SOCIAL_IMAGES.circles.alt} loading="lazy" /></div>
      </header>

      {message ? <div className="sw-social-message">{message}</div> : null}

      <div className="row g-3 g-xl-4">
        <div className="col-12 col-lg-8">
          <section className="sw-social-panel sw20-panel">
            <div className="sw-social-section-heading"><div><span className="sw-social-kicker">Shared queue</span><h2>Circle songs</h2></div></div>
            <form className="sw-circle-share-form" onSubmit={addSong}>
              <SocialSongPicker songs={songs} value={songId} onChange={setSongId} label="Choose a song to share" maxVisible={8} compact />
              <div className="sw-social-compose-row mt-3"><input value={note} onChange={(event) => setNote(event.target.value.slice(0, 220))} placeholder="Add a note" /><button className="sw-primary-btn" type="submit" disabled={!songId}><Plus size={15} /> Share</button></div>
            </form>
            {(circle.songs || []).length ? (
              <div className="sw-circle-song-list">
                {circle.songs.map((entry) => (
                  <article key={entry._id}>
                    <button type="button" className="sw-circle-song-main" onClick={() => {
                      player?.playSong?.(entry.song, circleSongs);
                      navigate(`/song/${entry.song._id}`, { state: { song: entry.song, playlist: circleSongs } });
                    }}>
                      <img src={getSongCover(entry.song)} alt="" />
                      <span><strong>{entry.song?.title}</strong><small>{getArtistName(entry.song)} · added by {nameOf(entry.addedBy)}</small>{entry.note ? <em>{entry.note}</em> : null}</span>
                      <i className="sw20-circle-play"><Play size={15} fill="currentColor" /></i>
                    </button>
                  </article>
                ))}
              </div>
            ) : <p className="sw-social-muted">No songs yet. Share the first one.</p>}
          </section>
        </div>

        <div className="col-12 col-lg-4">
          <section className="sw-social-panel sw20-panel">
            <div className="sw-social-section-heading"><div><span className="sw-social-kicker">Members</span><h2>{circle.members?.length || 1} people</h2></div></div>
            <div className="sw-members-list">{(circle.members || []).map((member) => <button type="button" key={member.user?._id || member._id} onClick={() => member.user?._id && navigate(`/u/${member.user._id}`)}><span className="sw-social-avatar small">{member.user?.image ? <img src={member.user.image} alt="" /> : nameOf(member.user).slice(0, 1).toUpperCase()}</span><span><strong>{nameOf(member.user)}</strong><small>{member.role}</small></span></button>)}</div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Circle;
