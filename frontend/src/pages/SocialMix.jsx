import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Play, RefreshCw, Sparkles, UsersRound, WandSparkles } from "lucide-react";
import { MusicPlayerContext } from "../context/MainPlayerContext";
import { useRealtime } from "../context/RealtimeContext";
import { apiClient } from "../config/apiClient";
import { useSocialHome } from "../hooks/useSocialHome";
import { getArtistName, getSongCover } from "../utils/catalog";
import AccountRequired from "../components/UI/AccountRequired";
import CatalogSkeleton from "../components/UI/CatalogSkeleton";
import SocialPageHero from "../components/Social/SocialPageHero";
import { SOCIAL_IMAGES } from "../components/Social/socialImages";
import "./CSS/Social.css";
import "./CSS/SocialV20.css";

const nameOf = (user) => user?.username || user?.name || "Listener";

const SocialMix = () => {
  const navigate = useNavigate();
  const player = useContext(MusicPlayerContext);
  const { socket: realtimeSocket } = useRealtime();
  const { authToken, headers, home, loading, realtimeConnected, realtimeMode } = useSocialHome();
  const [selected, setSelected] = useState([]);
  const [mix, setMix] = useState([]);
  const [mixMeta, setMixMeta] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const builtRef = useRef(false);
  const rebuildTimerRef = useRef(null);
  const buildRequestRef = useRef(0);

  const following = home?.following || [];
  const followingSignature = useMemo(
    () => following.map((friend) => `${friend._id}:${friend.tasteMatch || 0}`).sort().join("|"),
    [following]
  );

  const toggle = (userId) => {
    setSelected((current) => current.includes(userId)
      ? current.filter((id) => id !== userId)
      : current.length >= 4 ? current : [...current, userId]);
  };

  const build = useCallback(async ({ quiet = false } = {}) => {
    if (!selected.length) {
      if (!quiet) setStatus("Choose at least one friend.");
      return;
    }
    const requestId = buildRequestRef.current + 1;
    buildRequestRef.current = requestId;
    if (!quiet) setBusy(true);
    if (!quiet) setStatus("");
    try {
      const { data } = await apiClient.post("/api/social/friend-mix", { userIds: selected }, { headers });
      if (requestId !== buildRequestRef.current) return;
      if (!data?.success) throw new Error(data?.message || "Could not build mix");
      const songs = data.songs || [];
      setMix(songs);
      setMixMeta(data.mixMeta || null);
      setParticipants(data.users || []);
      builtRef.current = true;
      setStatus(quiet
        ? `Friend Mix refreshed automatically · ${songs.length} songs`
        : `Built a ${songs.length}-song mix from ${data.mixMeta?.participantCount || selected.length + 1} listeners.`);
    } catch (error) {
      if (requestId === buildRequestRef.current && !quiet) {
        setStatus(error?.response?.data?.message || error.message || "Could not build Friend Mix.");
      }
    } finally {
      if (!quiet) setBusy(false);
    }
  }, [headers, selected]);

  useEffect(() => {
    const allowed = new Set(following.map((friend) => String(friend._id)));
    setSelected((current) => current.filter((userId) => allowed.has(String(userId))));
  }, [followingSignature]);

  useEffect(() => {
    if (selected.length) return;
    buildRequestRef.current += 1;
    if (builtRef.current) {
      builtRef.current = false;
      setMix([]);
      setMixMeta(null);
      setParticipants([]);
    }
  }, [selected.length]);

  useEffect(() => {
    if (!builtRef.current || !selected.length) return undefined;
    if (rebuildTimerRef.current) window.clearTimeout(rebuildTimerRef.current);
    rebuildTimerRef.current = window.setTimeout(() => build({ quiet: true }), 650);
    return () => {
      if (rebuildTimerRef.current) window.clearTimeout(rebuildTimerRef.current);
    };
  }, [selected.join("|"), build]);

  useEffect(() => {
    if (!realtimeSocket || !builtRef.current || !selected.length) return undefined;
    const onParticipantUpdate = (event) => {
      const changedUserId = String(event?.userId || event?.targetId || event?.actorId || "");
      const participantIds = new Set([String(home?.me?._id || ""), ...selected.map(String)]);
      if (changedUserId && !participantIds.has(changedUserId)) return;
      if (rebuildTimerRef.current) window.clearTimeout(rebuildTimerRef.current);
      rebuildTimerRef.current = window.setTimeout(() => build({ quiet: true }), 900);
    };
    ["taste:update", "profile:update", "people:update"].forEach((event) => realtimeSocket.on(event, onParticipantUpdate));
    return () => ["taste:update", "profile:update", "people:update"].forEach((event) => realtimeSocket.off(event, onParticipantUpdate));
  }, [realtimeSocket, selected.join("|"), home?.me?._id, build]);

  useEffect(() => {
    if (!builtRef.current || !selected.length) return undefined;
    if (rebuildTimerRef.current) window.clearTimeout(rebuildTimerRef.current);
    rebuildTimerRef.current = window.setTimeout(() => build({ quiet: true }), 1100);
    return () => {
      if (rebuildTimerRef.current) window.clearTimeout(rebuildTimerRef.current);
    };
  }, [followingSignature]);

  useEffect(() => {
    if (!builtRef.current || !selected.length) return undefined;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") build({ quiet: true });
    }, 45000);
    return () => window.clearInterval(interval);
  }, [selected.join("|"), followingSignature, build]);

  if (!authToken) return <div className="sw-social-page"><AccountRequired title="Sign in to build a Friend Mix" /></div>;
  if (loading && !home) return <div className="sw-social-page"><CatalogSkeleton count={8} /></div>;

  const play = (song) => {
    if (!song?._id) return;
    player?.playSong?.(song, mix.length ? mix : [song]);
    navigate(`/song/${song._id}`, { state: { song, playlist: mix.length ? mix : [song] } });
  };

  const playMix = () => {
    if (!mix.length) return;
    player?.playSong?.(mix[0], mix);
  };

  return (
    <div className="sw-social-page sw20-page container-fluid px-0">
      <SocialPageHero
        kicker="Friend Mix"
        title="A mix where everybody gets a say."
        description="Choose up to four people you follow. SoundWave balances each person's taste, rewards true overlap, avoids repeating one artist too much and keeps the mix fresh as your listening changes."
        image={SOCIAL_IMAGES.mix}
        live={realtimeConnected}
      >
        <span className={realtimeConnected ? "sw20-realtime-pill online" : realtimeMode === "polling" ? "sw20-realtime-pill fallback" : "sw20-realtime-pill"}>
          {realtimeConnected ? "Live mix data" : realtimeMode === "polling" ? "Auto-updating" : "Syncing"}
        </span>
      </SocialPageHero>

      <section className="sw-social-panel sw20-panel">
        <div className="sw-social-section-heading"><div><span className="sw-social-kicker">Step one</span><h2>Choose friends</h2></div><UsersRound size={20} /></div>
        <div className="sw20-mix-people">
          {following.map((friend) => {
            const active = selected.includes(String(friend._id));
            return (
              <button type="button" className={active ? "active" : ""} key={friend._id} onClick={() => toggle(String(friend._id))}>
                <span className="sw-social-avatar">{friend.image ? <img src={friend.image} alt="" /> : nameOf(friend).slice(0, 1).toUpperCase()}</span>{friend.online ? <i className="sw-online-dot" title="Online" aria-label="Online" /> : null}
                <span><strong>{nameOf(friend)}</strong><small>{friend.tasteMatch || 0}% taste match</small></span>
                <i>{active ? <Check size={15} /> : <Sparkles size={15} />}</i>
              </button>
            );
          })}
          {!following.length ? <div className="sw20-empty-card"><UsersRound size={24} /><strong>Follow someone first.</strong><p>Your saved Following network becomes available here automatically.</p><button type="button" className="sw-secondary-btn" onClick={() => navigate("/social/people")}>Find people</button></div> : null}
        </div>

        <div className="sw22-mix-actions mt-3">
          <button type="button" className="sw-primary-btn" onClick={() => build()} disabled={busy || !selected.length}><WandSparkles size={16} /> {busy ? "Mixing…" : `Build Friend Mix${selected.length ? ` (${selected.length + 1} people)` : ""}`}</button>
          {mix.length ? <button type="button" className="sw-secondary-btn" onClick={playMix}><Play size={15} fill="currentColor" /> Play mix</button> : null}
          {mix.length ? <button type="button" className="sw-secondary-btn" onClick={() => build({ quiet: true })} disabled={busy}><RefreshCw size={15} /> Refresh</button> : null}
        </div>
        {status ? <div className="sw-social-message mt-3">{status}</div> : null}
      </section>

      {mix.length ? (
        <section className="sw-social-panel sw20-panel mt-3 mt-xl-4">
          <div className="sw-social-section-heading"><div><span className="sw-social-kicker">Your live mix</span><h2>Play the overlap</h2></div><Play size={19} /></div>

          <div className="sw22-mix-summary">
            <div><strong>{mixMeta?.participantCount || participants.length || selected.length + 1}</strong><small>listeners blended</small></div>
            <div><strong>{mixMeta?.diversity?.artists || new Set(mix.map((song) => String(song.artist?._id || song.artist || ""))).size}</strong><small>artists represented</small></div>
            <div><strong>{mixMeta?.diversity?.genres || new Set(mix.map((song) => song.genre).filter(Boolean)).size}</strong><small>genres represented</small></div>
            <div><strong>{mixMeta?.strongestScore || mix[0]?.friendMixScore || 0}%</strong><small>strongest group fit</small></div>
          </div>

          <div className="sw20-mix-song-grid sw22-mix-song-grid">
            {mix.slice(0, 30).map((song) => (
              <button type="button" key={song._id} onClick={() => play(song)}>
                <img src={getSongCover(song)} alt="" loading="lazy" decoding="async" />
                <span>
                  <strong>{song.title}</strong>
                  <small>{getArtistName(song)}</small>
                  <em className="sw22-mix-reasons">{(song.friendMixReasons || []).slice(0, 2).join(" · ") || "Balanced for the group"}</em>
                </span>
                <i className="sw22-mix-score"><b>{song.friendMixScore || 0}</b><Play size={12} fill="currentColor" /></i>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default SocialMix;
