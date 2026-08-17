import { useContext, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Copy, LogOut, Play, Plus, RadioTower, UsersRound } from "lucide-react";
import { MusicContext } from "../context/ShopContext";
import { MusicPlayerContext } from "../context/MainPlayerContext";
import { apiClient, authHeaders } from "../config/apiClient";
import { getArtistName, getSongCover } from "../utils/catalog";
import AccountRequired from "../components/UI/AccountRequired";
import CatalogSkeleton from "../components/UI/CatalogSkeleton";
import EmptyState from "../components/UI/EmptyState";
import SocialSongPicker from "../components/Social/SocialSongPicker";
import "./CSS/Social.css";

const nameOf = (u) => u?.username || u?.name || "Listener";
const Circle = () => {
  const { circleId } = useParams();
  const navigate = useNavigate();
  const { token, getAuthToken, songs = [] } = useContext(MusicContext);
  const player = useContext(MusicPlayerContext);
  const authToken = getAuthToken?.() || token || "";
  const [circle, setCircle] = useState(null);
  const [loading, setLoading] = useState(Boolean(authToken));
  const [error, setError] = useState("");
  const [songId, setSongId] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    if (!authToken) return;
    setLoading(true); setError("");
    try { const {data}=await apiClient.get(`/api/social/circles/${circleId}`,{headers:authHeaders(authToken)}); if(!data?.success)throw new Error(data?.message); setCircle(data.circle); }
    catch(err){setError(err?.response?.data?.message||err.message||"Could not load Circle");}
    finally{setLoading(false);}
  };
  useEffect(()=>{load();},[circleId,authToken]);

  if(!authToken)return <div className="sw-social-page"><AccountRequired title="Sign in to open this Circle"/></div>;
  if(loading&&!circle)return <div className="sw-social-page"><CatalogSkeleton count={8}/></div>;
  if(error&&!circle)return <div className="sw-social-page"><EmptyState title="Circle unavailable" message={error} onRetry={load}/></div>;
  if(!circle)return null;

  const addSong=async(e)=>{e.preventDefault();if(!songId)return;try{const{data}=await apiClient.post(`/api/social/circles/${circleId}/songs`,{songId,note},{headers:authHeaders(authToken)});if(data?.success){setSongId("");setNote("");setMessage("Song shared with your Circle.");load();}}catch(err){setMessage(err?.response?.data?.message||"Could not share song.");}};
  const copy=async()=>{try{await navigator.clipboard.writeText(circle.inviteCode);setMessage("Invite code copied.");}catch{setMessage(`Invite code: ${circle.inviteCode}`)}};
  const leave=async()=>{try{const{data}=await apiClient.post(`/api/social/circles/${circleId}/leave`,{},{headers:authHeaders(authToken)});if(data?.success)navigate("/social");else setMessage(data?.message||"Could not leave Circle.");}catch(err){setMessage(err?.response?.data?.message||"Could not leave Circle.");}};
  const startRoom=async()=>{try{const{data}=await apiClient.post("/api/social/rooms",{name:`${circle.name} — Pass the Aux`},{headers:authHeaders(authToken)});if(data?.success)navigate(`/social/rooms/${data.room.code}`);}catch{setMessage("Could not start room.");}};
  const circleSongs=(circle.songs||[]).map((entry)=>entry.song).filter(Boolean);

  return <div className="sw-social-page">
    <header className="sw-circle-hero"><span className="sw-circle-hero-icon"><UsersRound size={28}/></span><div><span className="sw-social-kicker">Sound Circle</span><h1>{circle.name}</h1><p>{circle.description||"A private place to share music with people you know."}</p><div className="sw-circle-code"><code>{circle.inviteCode}</code><button type="button" onClick={copy}><Copy size={14}/> Copy invite</button></div></div><div className="sw-circle-hero-actions"><button className="sw-primary-btn" type="button" onClick={startRoom}><RadioTower size={16}/> Pass the Aux</button><button className="sw-secondary-btn" type="button" onClick={leave}><LogOut size={16}/> Leave</button></div></header>
    {message?<div className="sw-social-message">{message}</div>:null}
    <div className="row g-3 g-xl-4">
      <div className="col-12 col-lg-8"><section className="sw-social-panel"><div className="sw-social-section-heading"><div><span className="sw-social-kicker">Shared queue</span><h2>Circle songs</h2></div></div>
        <form className="sw-circle-share-form" onSubmit={addSong}>
          <SocialSongPicker songs={songs} value={songId} onChange={setSongId} label="Choose a song to share" maxVisible={8} compact/>
          <div className="sw-social-compose-row mt-3"><input value={note} onChange={e=>setNote(e.target.value.slice(0,220))} placeholder="Add a note"/><button className="sw-primary-btn" type="submit" disabled={!songId}><Plus size={15}/> Share</button></div>
        </form>
        {(circle.songs||[]).length?<div className="sw-circle-song-list">{circle.songs.map((entry)=><article key={entry._id}><button type="button" className="sw-circle-song-main" onClick={()=>{player?.playSong?.(entry.song,circleSongs);navigate(`/song/${entry.song._id}`,{state:{song:entry.song,playlist:circleSongs}})}}><img src={getSongCover(entry.song)} alt=""/><span><strong>{entry.song?.title}</strong><small>{getArtistName(entry.song)} · added by {nameOf(entry.addedBy)}</small>{entry.note?<em>{entry.note}</em>:null}</span><Play size={16}/></button></article>)}</div>:<p className="sw-social-muted">No songs yet. Share the first one.</p>}
      </section></div>
      <div className="col-12 col-lg-4"><section className="sw-social-panel"><div className="sw-social-section-heading"><div><span className="sw-social-kicker">Members</span><h2>{circle.members?.length||1} people</h2></div></div><div className="sw-members-list">{(circle.members||[]).map(member=><button type="button" key={member.user?._id||member._id} onClick={()=>member.user?._id&&navigate(`/u/${member.user._id}`)}><span className="sw-social-avatar small">{member.user?.image?<img src={member.user.image} alt=""/>:nameOf(member.user).slice(0,1).toUpperCase()}</span><span><strong>{nameOf(member.user)}</strong><small>{member.role}</small></span></button>)}</div></section></div>
    </div>
  </div>;
};
export default Circle;
