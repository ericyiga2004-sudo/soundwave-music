import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CirclePlus,
  Copy,
  Headphones,
  HeartHandshake,
  MessageCircleHeart,
  Music2,
  Play,
  RadioTower,
  Search,
  Sparkles,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { MusicContext } from "../context/ShopContext";
import { MusicPlayerContext } from "../context/MainPlayerContext";
import { apiClient, authHeaders } from "../config/apiClient";
import { getArtistName, getSongCover } from "../utils/catalog";
import AccountRequired from "../components/UI/AccountRequired";
import CatalogSkeleton from "../components/UI/CatalogSkeleton";
import EmptyState from "../components/UI/EmptyState";
import SocialSongPicker from "../components/Social/SocialSongPicker";
import "./CSS/Social.css";

const personName = (user) => user?.username || user?.name || "Listener";
const compactDate = (date) => {
  if (!date) return "Now";
  const value = new Date(date);
  const diff = Math.max(0, Date.now() - value.getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

const activityLabel = (activity) => {
  const actor = personName(activity?.actor);
  if (activity?.type === "daily_pick") return `${actor} picked a song today`;
  if (activity?.type === "song_moment") return `${actor} reacted to a song moment`;
  if (activity?.type === "circle_song") return `${actor} added music to ${activity?.circle?.name || "a Circle"}`;
  if (activity?.type === "circle_created") return `${actor} started a new Circle`;
  if (activity?.type === "room_created") return `${actor} started Pass the Aux`;
  if (activity?.type === "follow") return `${actor} followed a listener`;
  return `${actor} shared music activity`;
};

const Social = () => {
  const navigate = useNavigate();
  const { token, getAuthToken, songs = [] } = useContext(MusicContext);
  const player = useContext(MusicPlayerContext);
  const authToken = getAuthToken?.() || token || "";

  const [home, setHome] = useState(null);
  const [loading, setLoading] = useState(Boolean(authToken));
  const [error, setError] = useState("");
  const [socialApiPending, setSocialApiPending] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [circleName, setCircleName] = useState("");
  const [circleDescription, setCircleDescription] = useState("");
  const [joinCircleCode, setJoinCircleCode] = useState("");
  const [roomName, setRoomName] = useState("Pass the Aux");
  const [roomCode, setRoomCode] = useState("");
  const [dailySongId, setDailySongId] = useState("");
  const [dailyNote, setDailyNote] = useState("");
  const [listenerQuery, setListenerQuery] = useState("");
  const [listenerResults, setListenerResults] = useState([]);
  const [friendSelection, setFriendSelection] = useState([]);
  const [friendMix, setFriendMix] = useState([]);

  const headers = useMemo(() => authHeaders(authToken), [authToken]);
  const heroSongs = useMemo(() => (songs || []).filter((song) => song?._id && getSongCover(song)).slice(0, 5), [songs]);

  const loadHome = async () => {
    if (!authToken) return;
    setLoading(true);
    setError("");
    setSocialApiPending(false);
    try {
      const { data } = await apiClient.get("/api/social/home", { headers });
      if (!data?.success) throw new Error(data?.message || "Could not load SoundWave Social");
      setHome(data);
      if (!dailySongId && data.dailyPicks?.length) {
        const mine = data.dailyPicks.find((pick) => String(pick.user?._id) === String(data.me?._id));
        if (mine?.song?._id) setDailySongId(mine.song._id);
      }
    } catch (err) {
      if (err?.response?.status === 404) {
        // The social frontend can arrive a few seconds before Render finishes
        // publishing the matching backend. Keep the page useful instead of blank.
        setSocialApiPending(true);
        try {
          const profile = await apiClient.get("/api/user/profile", { headers });
          setHome({ me: profile?.data?.user || null, circles: [], dailyPicks: [], feed: [], people: [], following: [], rooms: [] });
        } catch {
          setError("The social API is still deploying. Retry in a moment.");
        }
      } else {
        setError(err?.response?.data?.message || err.message || "Could not load SoundWave Social");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadHome(); }, [authToken]);

  const run = async (key, action) => {
    if (!authToken) { navigate("/account"); return null; }
    setBusy(key); setMessage("");
    try { return await action(); }
    catch (err) {
      if (err?.response?.status === 404 && String(err?.config?.url || "").includes("/api/social/")) {
        setSocialApiPending(true);
        setMessage("SoundWave Social is still deploying on the backend. Your music player is unaffected.");
      } else {
        setMessage(err?.response?.data?.message || err.message || "That action could not be completed.");
      }
      return null;
    } finally { setBusy(""); }
  };

  const createCircle = async (event) => {
    event.preventDefault();
    const name = circleName.trim();
    if (name.length < 2) return;
    const response = await run("circle-create", () => apiClient.post("/api/social/circles", { name, description: circleDescription.trim() }, { headers }));
    if (response?.data?.success) navigate(`/social/circles/${response.data.circle._id}`);
  };

  const joinCircle = async (event) => {
    event.preventDefault();
    if (!joinCircleCode.trim()) return;
    const response = await run("circle-join", () => apiClient.post("/api/social/circles/join", { code: joinCircleCode.trim() }, { headers }));
    if (response?.data?.success) navigate(`/social/circles/${response.data.circleId}`);
  };

  const createRoom = async () => {
    const response = await run("room-create", () => apiClient.post("/api/social/rooms", { name: roomName.trim() || "Pass the Aux" }, { headers }));
    if (response?.data?.success) navigate(`/social/rooms/${response.data.room.code}`);
  };

  const joinRoom = async (event) => {
    event.preventDefault();
    if (!roomCode.trim()) return;
    const response = await run("room-join", () => apiClient.post("/api/social/rooms/join", { code: roomCode.trim() }, { headers }));
    if (response?.data?.success) navigate(`/social/rooms/${response.data.code}`);
  };

  const submitDailyPick = async (event) => {
    event.preventDefault();
    if (!dailySongId) return;
    const response = await run("daily", () => apiClient.post("/api/social/daily", { songId: dailySongId, note: dailyNote.trim() }, { headers }));
    if (response?.data?.success) {
      setDailyNote("");
      setMessage("Today's song is live for your music friends.");
      loadHome();
    }
  };

  const follow = async (userId) => {
    const response = await run(`follow-${userId}`, () => apiClient.post(`/api/social/users/${userId}/follow`, {}, { headers }));
    if (response?.data?.success) {
      setListenerResults((current) => current.map((user) => user._id === userId ? { ...user, isFollowing: response.data.following, followersCount: response.data.followersCount } : user));
      loadHome();
    }
  };

  const searchListeners = async (event) => {
    event.preventDefault();
    const q = listenerQuery.trim();
    if (q.length < 2) { setListenerResults([]); return; }
    const response = await run("search", () => apiClient.get("/api/social/users/search", { params: { q }, headers }));
    if (response?.data?.success) setListenerResults(response.data.users || []);
  };

  const toggleFriend = (userId) => {
    setFriendSelection((current) => current.includes(userId) ? current.filter((id) => id !== userId) : current.length >= 4 ? current : [...current, userId]);
  };

  const buildMix = async () => {
    if (!friendSelection.length) { setMessage("Choose at least one music friend for Friend Mix."); return; }
    const response = await run("mix", () => apiClient.post("/api/social/friend-mix", { userIds: friendSelection }, { headers }));
    if (response?.data?.success) setFriendMix(response.data.songs || []);
  };

  const updatePrivacy = async (key, value) => {
    const response = await run(`privacy-${key}`, () => apiClient.patch("/api/social/profile", { [key]: value }, { headers }));
    if (response?.data?.success) setHome((current) => current ? { ...current, me: response.data.user } : current);
  };

  const playSong = (song, playlist = []) => {
    if (!song?._id) return;
    player?.playSong?.(song, playlist.length ? playlist : [song]);
    navigate(`/song/${song._id}`, { state: { song, playlist: playlist.length ? playlist : [song] } });
  };

  const copyCode = async (code) => {
    try { await navigator.clipboard.writeText(code); setMessage("Invite code copied."); }
    catch { setMessage(`Invite code: ${code}`); }
  };

  const jumpTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  if (!authToken) return <div className="sw-social-page"><AccountRequired /></div>;
  if (loading && !home) return <div className="sw-social-page"><CatalogSkeleton count={10} /></div>;
  if (error && !home) return <div className="sw-social-page"><EmptyState title="Social is unavailable" message={error} onRetry={loadHome} /></div>;

  const people = listenerResults.length ? listenerResults : (home?.people || []);
  const friends = home?.following || [];

  const quickLinks = [
    { id: "social-daily", label: "Song Today", sub: "Share one track", icon: Music2, image: heroSongs[0] },
    { id: "social-circles", label: "Circles", sub: "Private music groups", icon: UsersRound, image: heroSongs[1] || heroSongs[0] },
    { id: "social-rooms", label: "Pass the Aux", sub: "Live shared queue", icon: RadioTower, image: heroSongs[2] || heroSongs[0] },
    { id: "social-mix", label: "Friend Mix", sub: "Blend your taste", icon: Sparkles, image: heroSongs[3] || heroSongs[0] },
  ];

  return (
    <div className="sw-social-page container-fluid px-0">
      <header className="sw-social-header sw-social-header-rich">
        <div className="sw-social-hero-copy">
          <span className="sw-social-kicker">SoundWave Social</span>
          <h1>Music is better with people.</h1>
          <p>Share one song, react at the exact moment, build Circles, compare taste and pass the aux.</p>
          <div className="sw-social-hero-actions">
            <button type="button" className="sw-primary-btn" onClick={() => jumpTo("social-daily")}><Music2 size={15}/> Pick today's song</button>
            <button type="button" className="sw-secondary-btn" onClick={() => jumpTo("social-rooms")}><Headphones size={15}/> Open live rooms</button>
          </div>
        </div>

        <div className="sw-social-hero-media" aria-label="Music from your SoundWave catalog">
          <div className="sw-social-cover-stack">
            {heroSongs.slice(0, 4).map((song, index) => (
              <button type="button" key={song._id} className={`cover-${index + 1}`} onClick={() => playSong(song, heroSongs)} title={`Play ${song.title}`}>
                <img src={getSongCover(song)} alt="" loading="lazy" decoding="async" />
                <span><Play size={13} fill="currentColor"/></span>
              </button>
            ))}
          </div>
          <button type="button" className="sw-social-profile-button" onClick={() => home?.me?._id && navigate(`/u/${home.me._id}`)}>
            <span className="sw-social-avatar">{home?.me?.image ? <img src={home.me.image} alt=""/> : personName(home?.me).slice(0,1).toUpperCase()}</span>
            <span><small>Your music profile</small><strong>{personName(home?.me)}</strong></span>
            <ArrowRight size={16}/>
          </button>
        </div>
      </header>

      {socialApiPending ? (
        <div className="sw-social-deploy-notice" role="status">
          <RadioTower size={18}/>
          <span><strong>Social backend is updating.</strong><small>The page stays usable, but social writes will work after Render finishes the latest deployment.</small></span>
          <button type="button" onClick={loadHome}>Retry</button>
        </div>
      ) : null}

      <div className="sw-social-quick-grid" aria-label="Social shortcuts">
        {quickLinks.map((item) => {
          const Icon = item.icon;
          return (
            <button type="button" key={item.id} onClick={() => jumpTo(item.id)}>
              {item.image ? <img src={getSongCover(item.image)} alt="" loading="lazy" decoding="async"/> : null}
              <span className="sw-social-quick-icon"><Icon size={17}/></span>
              <span><strong>{item.label}</strong><small>{item.sub}</small></span>
              <ArrowRight size={15}/>
            </button>
          );
        })}
      </div>

      {message ? <div className="sw-social-message" role="status">{message}</div> : null}

      <div className="row g-3 g-xl-4">
        <div className="col-12 col-xl-8">
          <section className="sw-social-panel sw-social-feature-panel" id="social-daily">
            <div className="sw-social-section-heading"><div><span className="sw-social-kicker">Today</span><h2>One Song Today</h2></div><MessageCircleHeart size={20}/></div>
            <p className="sw-social-muted mb-3">Pick the exact real song from your catalog. Tap the play icon first if you want to hear it before sharing.</p>
            <form onSubmit={submitDailyPick}>
              <SocialSongPicker songs={songs} value={dailySongId} onChange={setDailySongId} label="Choose today's song" maxVisible={10}/>
              <div className="sw-social-compose-row mt-3">
                <input value={dailyNote} onChange={(e)=>setDailyNote(e.target.value.slice(0,180))} placeholder="Why this one? Optional" />
                <button type="submit" className="sw-primary-btn" disabled={!dailySongId || busy === "daily"}>{busy === "daily" ? "Sharing…" : "Share today's song"}</button>
              </div>
            </form>
            <div className="sw-daily-strip">
              {(home?.dailyPicks || []).length ? home.dailyPicks.map((pick) => (
                <button type="button" className="sw-daily-card" key={pick._id} onClick={() => playSong(pick.song, home.dailyPicks.map((item)=>item.song).filter(Boolean))}>
                  <img src={getSongCover(pick.song)} alt="" loading="lazy" decoding="async"/>
                  <span><small>{personName(pick.user)} picked</small><strong>{pick.song?.title || "Song"}</strong><em>{getArtistName(pick.song)}</em></span>
                  <Play size={16} fill="currentColor"/>
                </button>
              )) : <p className="sw-social-muted">No picks yet today. Yours can be first.</p>}
            </div>
          </section>

          <section className="sw-social-panel mt-3 mt-xl-4">
            <div className="sw-social-section-heading"><div><span className="sw-social-kicker">Friends</span><h2>Music activity</h2></div><HeartHandshake size={20}/></div>
            {(home?.feed || []).length ? <div className="sw-activity-list">{home.feed.map((activity) => (
              <button type="button" className="sw-activity-row" key={activity._id} onClick={() => activity.song?._id ? playSong(activity.song) : activity.room?.code ? navigate(`/social/rooms/${activity.room.code}`) : activity.circle?._id ? navigate(`/social/circles/${activity.circle._id}`) : undefined}>
                <span className="sw-social-avatar small">{activity.actor?.image ? <img src={activity.actor.image} alt=""/> : personName(activity.actor).slice(0,1).toUpperCase()}</span>
                <span className="sw-activity-copy"><strong>{activityLabel(activity)}</strong><small>{activity.note || activity.song?.title || "SoundWave"} · {compactDate(activity.createdAt)}</small></span>
                {activity.song ? <img className="sw-activity-cover" src={getSongCover(activity.song)} alt="" loading="lazy"/> : null}
              </button>
            ))}</div> : <p className="sw-social-muted">Follow listeners to build your music activity feed.</p>}
          </section>

          <section className="sw-social-panel mt-3 mt-xl-4" id="social-mix">
            <div className="sw-social-section-heading"><div><span className="sw-social-kicker">Compatibility</span><h2>Friend Mix</h2></div><Sparkles size={20}/></div>
            <p className="sw-social-muted mb-3">Choose up to four friends. SoundWave combines everyone's taste without downloading extra audio.</p>
            <div className="sw-friend-select">
              {friends.length ? friends.map((friend) => (
                <button type="button" className={friendSelection.includes(friend._id) ? "sw-friend-chip active" : "sw-friend-chip"} key={friend._id} onClick={() => toggleFriend(friend._id)}>
                  <span className="sw-social-avatar tiny">{friend.image ? <img src={friend.image} alt=""/> : personName(friend).slice(0,1).toUpperCase()}</span>
                  <span>{personName(friend)}</span><small>{friend.tasteMatch || 0}%</small>
                </button>
              )) : <span className="sw-social-muted">Follow someone first, then build a Friend Mix.</span>}
            </div>
            <button type="button" className="sw-secondary-btn mt-3" onClick={buildMix} disabled={!friendSelection.length || busy === "mix"}>{busy === "mix" ? "Mixing…" : "Build Friend Mix"}</button>
            {friendMix.length ? <div className="sw-social-song-list mt-3">{friendMix.slice(0,12).map((song,index) => (
              <button type="button" key={song._id} onClick={() => playSong(song, friendMix)}><span>{String(index+1).padStart(2,"0")}</span><img src={getSongCover(song)} alt=""/><span><strong>{song.title}</strong><small>{getArtistName(song)}</small></span><Play size={15}/></button>
            ))}</div> : null}
          </section>
        </div>

        <div className="col-12 col-xl-4">
          <section className="sw-social-panel" id="social-circles">
            <div className="sw-social-section-heading"><div><span className="sw-social-kicker">Private groups</span><h2>Sound Circles</h2></div><UsersRound size={20}/></div>
            <div className="sw-circle-list">
              {(home?.circles || []).map((circle) => (
                <div className="sw-circle-card" key={circle._id}>
                  <button type="button" onClick={() => navigate(`/social/circles/${circle._id}`)}><span className="sw-circle-icon"><UsersRound size={18}/></span><span><strong>{circle.name}</strong><small>{circle.members?.length || 1} members</small></span></button>
                  <button type="button" className="sw-icon-button" onClick={() => copyCode(circle.inviteCode)} title="Copy invite code"><Copy size={15}/></button>
                </div>
              ))}
              {!home?.circles?.length ? <p className="sw-social-muted">Create a private Circle for your closest music friends.</p> : null}
            </div>
            <details className="sw-social-details mt-3"><summary><CirclePlus size={16}/> Create Circle</summary><form onSubmit={createCircle}><input value={circleName} onChange={(e)=>setCircleName(e.target.value)} placeholder="Circle name"/><input value={circleDescription} onChange={(e)=>setCircleDescription(e.target.value)} placeholder="Short description"/><button className="sw-primary-btn" type="submit" disabled={busy === "circle-create"}>Create</button></form></details>
            <details className="sw-social-details"><summary><UserPlus size={16}/> Join with code</summary><form onSubmit={joinCircle}><input value={joinCircleCode} onChange={(e)=>setJoinCircleCode(e.target.value.toUpperCase())} placeholder="Invite code"/><button className="sw-secondary-btn" type="submit" disabled={busy === "circle-join"}>Join Circle</button></form></details>
          </section>

          <section className="sw-social-panel mt-3 mt-xl-4" id="social-rooms">
            <div className="sw-social-section-heading"><div><span className="sw-social-kicker">Live queue</span><h2>Pass the Aux</h2></div><RadioTower size={20}/></div>
            <p className="sw-social-muted">Create a lightweight room. Friends add real songs, preview them and vote; the host advances the shared queue.</p>
            {(home?.rooms || []).map((room) => <button type="button" key={room._id} className="sw-room-link" onClick={() => navigate(`/social/rooms/${room.code}`)}><Headphones size={17}/><span><strong>{room.name}</strong><small>{room.members?.length || 1} listening · {room.code}</small></span></button>)}
            <input className="sw-social-input mt-3" value={roomName} onChange={(e)=>setRoomName(e.target.value)} placeholder="Room name"/>
            <button type="button" className="sw-primary-btn w-100 mt-2" onClick={createRoom} disabled={busy === "room-create"}>Start a room</button>
            <form className="sw-inline-join mt-2" onSubmit={joinRoom}><input value={roomCode} onChange={(e)=>setRoomCode(e.target.value.toUpperCase())} placeholder="Room code"/><button className="sw-secondary-btn" type="submit">Join</button></form>
          </section>

          <section className="sw-social-panel mt-3 mt-xl-4">
            <div className="sw-social-section-heading"><div><span className="sw-social-kicker">Privacy</span><h2>Social controls</h2></div></div>
            <div className="sw-social-settings">
              {[
                ["publicProfile", "Public music profile", "Let people find your music profile."],
                ["listeningActivity", "Share recent listening", "Show recent songs on your profile."],
                ["allowTasteMatch", "Allow Taste Match", "Let other signed-in listeners compare taste."],
              ].map(([key,label,description]) => {
                const enabled = home?.me?.socialSettings?.[key] !== false && (key !== "listeningActivity" || home?.me?.socialSettings?.[key] === true);
                return <button type="button" className="sw-social-setting" key={key} onClick={() => updatePrivacy(key, !enabled)} disabled={busy === `privacy-${key}`}><span><strong>{label}</strong><small>{description}</small></span><i className={enabled ? "on" : ""}><b/></i></button>;
              })}
            </div>
          </section>

          <section className="sw-social-panel mt-3 mt-xl-4">
            <div className="sw-social-section-heading"><div><span className="sw-social-kicker">People</span><h2>Taste Match</h2></div><Search size={20}/></div>
            <form className="sw-listener-search" onSubmit={searchListeners}><input value={listenerQuery} onChange={(e)=>setListenerQuery(e.target.value)} placeholder="Search listeners"/><button type="submit" aria-label="Search"><Search size={16}/></button></form>
            <div className="sw-people-list">
              {people.slice(0,8).map((user) => (
                <div className="sw-person-row" key={user._id}>
                  <button type="button" className="sw-person-main" onClick={() => navigate(`/u/${user._id}`)}><span className="sw-social-avatar small">{user.image ? <img src={user.image} alt=""/> : personName(user).slice(0,1).toUpperCase()}</span><span><strong>{personName(user)}</strong><small>{user.tasteMatch || 0}% taste match</small></span></button>
                  <button type="button" className="sw-person-follow" onClick={() => follow(user._id)} disabled={busy === `follow-${user._id}`}>{user.isFollowing ? "Following" : "Follow"}</button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Social;
