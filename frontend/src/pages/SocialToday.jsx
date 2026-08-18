import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircleHeart, Play, Send } from "lucide-react";
import { MusicContext } from "../context/ShopContext";
import { MusicPlayerContext } from "../context/MainPlayerContext";
import { apiClient } from "../config/apiClient";
import { useSocialHome } from "../hooks/useSocialHome";
import { getArtistName, getSongCover } from "../utils/catalog";
import AccountRequired from "../components/UI/AccountRequired";
import CatalogSkeleton from "../components/UI/CatalogSkeleton";
import SocialPageHero from "../components/Social/SocialPageHero";
import SocialSongPicker from "../components/Social/SocialSongPicker";
import { SOCIAL_IMAGES } from "../components/Social/socialImages";
import "./CSS/Social.css";
import "./CSS/SocialV20.css";

const nameOf = (user) => user?.username || user?.name || "Listener";

const SocialToday = () => {
  const navigate = useNavigate();
  const { songs = [] } = useContext(MusicContext);
  const player = useContext(MusicPlayerContext);
  const { authToken, headers, home, loading, load, realtimeConnected, invalidateSocial } = useSocialHome();
  const [songId, setSongId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const myPick = useMemo(
    () => (home?.dailyPicks || []).find((pick) => String(pick.user?._id) === String(home?.me?._id)),
    [home]
  );

  useEffect(() => {
    if (myPick?.song?._id && !songId) setSongId(String(myPick.song._id));
  }, [myPick?.song?._id]);

  if (!authToken) return <div className="sw-social-page"><AccountRequired title="Sign in to pick your song today" /></div>;
  if (loading && !home) return <div className="sw-social-page"><CatalogSkeleton count={8} /></div>;

  const save = async (event) => {
    event.preventDefault();
    if (!songId) return setStatus("Choose a song first.");
    setSaving(true);
    try {
      const { data } = await apiClient.post("/api/social/daily", { songId, note: note.trim() }, { headers });
      if (!data?.success) throw new Error(data?.message || "Could not save today's song");
      setStatus("Your song is live. Followers receive the update instantly while SoundWave is open.");
      setNote("");
      invalidateSocial("daily-pick", { songId });
      load({ quiet: true });
    } catch (error) {
      setStatus(error?.response?.data?.message || error.message || "Could not save today's song.");
    } finally {
      setSaving(false);
    }
  };

  const play = (song, playlist) => {
    if (!song?._id) return;
    player?.playSong?.(song, playlist);
    navigate(`/song/${song._id}`, { state: { song, playlist } });
  };

  const picks = home?.dailyPicks || [];

  return (
    <div className="sw-social-page sw20-page container-fluid px-0">
      <SocialPageHero
        kicker="One Song Today"
        title="One track can say more than a status."
        description="Pick one song for today. Friends can play it immediately, and the people who follow you receive a live SoundWave notification."
        image={SOCIAL_IMAGES.today}
        live={realtimeConnected}
      />

      <div className="row g-3 g-xl-4">
        <div className="col-12 col-xl-8">
          <section className="sw-social-panel sw20-panel">
            <div className="sw-social-section-heading"><div><span className="sw-social-kicker">Your pick</span><h2>Choose today&apos;s song</h2></div><MessageCircleHeart size={20} /></div>
            <form onSubmit={save}>
              <SocialSongPicker songs={songs} value={songId} onChange={setSongId} label="Choose today's song" maxVisible={9} />
              <div className="sw20-note-compose">
                <input value={note} onChange={(event) => setNote(event.target.value.slice(0, 180))} placeholder="Why this one? Optional" />
                <button type="submit" className="sw-primary-btn" disabled={!songId || saving}><Send size={15} /> {saving ? "Sharing…" : myPick ? "Update today's song" : "Share today's song"}</button>
              </div>
            </form>
            {status ? <div className="sw-social-message mt-3">{status}</div> : null}
          </section>
        </div>

        <div className="col-12 col-xl-4">
          <section className="sw-social-panel sw20-panel">
            <div className="sw-social-section-heading"><div><span className="sw-social-kicker">Friends</span><h2>Today&apos;s picks</h2></div></div>
            <div className="sw20-daily-list">
              {picks.map((pick) => (
                <button type="button" key={pick._id} onClick={() => play(pick.song, picks.map((item) => item.song).filter(Boolean))}>
                  <img src={getSongCover(pick.song)} alt="" loading="lazy" />
                  <span><small>{nameOf(pick.user)}</small><strong>{pick.song?.title || "Song"}</strong><em>{getArtistName(pick.song)}</em></span>
                  <i><Play size={14} fill="currentColor" /></i>
                </button>
              ))}
              {!picks.length ? <p className="sw-social-muted">No one in your network has picked a song yet today.</p> : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default SocialToday;
