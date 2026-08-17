import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowBigUp, Copy, Play, Plus, RadioTower, RefreshCw, UsersRound } from "lucide-react";
import { MusicContext } from "../context/ShopContext";
import { MusicPlayerContext } from "../context/MainPlayerContext";
import { apiClient, authHeaders } from "../config/apiClient";
import { getArtistName, getSongCover } from "../utils/catalog";
import AccountRequired from "../components/UI/AccountRequired";
import CatalogSkeleton from "../components/UI/CatalogSkeleton";
import EmptyState from "../components/UI/EmptyState";
import "./CSS/Social.css";

const nameOf=(u)=>u?.username||u?.name||"Listener";
const LiveRoom=()=>{
  const {code}=useParams(); const navigate=useNavigate();
  const {token,getAuthToken,songs=[]}=useContext(MusicContext); const player=useContext(MusicPlayerContext);
  const authToken=getAuthToken?.()||token||"";
  const [room,setRoom]=useState(null); const [loading,setLoading]=useState(Boolean(authToken)); const [error,setError]=useState(""); const [songId,setSongId]=useState(""); const [message,setMessage]=useState(""); const [syncPlayback,setSyncPlayback]=useState(true);
  const lastSongRef=useRef("");
  const headers=useMemo(()=>authHeaders(authToken),[authToken]);
  const load=async({quiet=false}={})=>{if(!authToken)return;if(!quiet)setLoading(true);try{const{data}=await apiClient.get(`/api/social/rooms/${String(code||"").toUpperCase()}`,{headers});if(!data?.success)throw new Error(data?.message);setRoom(data.room);setError("");}catch(err){if(!quiet)setError(err?.response?.data?.message||err.message||"Could not load room");}finally{if(!quiet)setLoading(false);}};
  useEffect(()=>{load();},[code,authToken]);
  useEffect(()=>{if(!authToken)return;const id=setInterval(()=>{if(document.visibilityState==="visible")load({quiet:true});},8000);return()=>clearInterval(id);},[authToken,code]);
  useEffect(()=>{const current=room?.currentSong;if(!syncPlayback||!current?._id||lastSongRef.current===String(current._id))return;lastSongRef.current=String(current._id);player?.playSong?.(current,[current]).then(()=>{const started=new Date(room.currentStartedAt||0).getTime();if(started){const elapsed=Math.max(0,(Date.now()-started)/1000);setTimeout(()=>player?.seekTo?.(elapsed),250);}}).catch(()=>{});},[room?.currentSong?._id,syncPlayback]);
  if(!authToken)return <div className="sw-social-page"><AccountRequired title="Sign in to join Pass the Aux"/></div>;
  if(loading&&!room)return <div className="sw-social-page"><CatalogSkeleton count={8}/></div>;
  if(error&&!room)return <div className="sw-social-page"><EmptyState title="Room unavailable" message={error} onRetry={()=>load()}/></div>;
  if(!room)return null;
  const queue=[...(room.queue||[])].filter(e=>!e.played).sort((a,b)=>(b.votes?.length||0)-(a.votes?.length||0)||new Date(a.createdAt)-new Date(b.createdAt));
  const addSong=async(e)=>{e.preventDefault();if(!songId)return;try{const{data}=await apiClient.post(`/api/social/rooms/${room.code}/queue`,{songId},{headers});if(data?.success){setSongId("");setMessage("Added to the room queue.");load({quiet:true});}}catch(err){setMessage(err?.response?.data?.message||"Could not add song.");}};
  const vote=async(entryId)=>{try{await apiClient.post(`/api/social/rooms/${room.code}/queue/${entryId}/vote`,{},{headers});load({quiet:true});}catch{setMessage("Could not vote.");}};
  const advance=async()=>{try{const{data}=await apiClient.post(`/api/social/rooms/${room.code}/advance`,{},{headers});if(data?.success){if(data.currentSong){await player?.playSong?.(data.currentSong,[data.currentSong]);lastSongRef.current=String(data.currentSong._id);}load({quiet:true});}}catch(err){setMessage(err?.response?.data?.message||"Only the host can advance the room.");}};
  const copy=async()=>{try{await navigator.clipboard.writeText(room.code);setMessage("Room code copied.");}catch{setMessage(`Room code: ${room.code}`)}};
  return <div className="sw-social-page"><header className="sw-room-hero"><span className="sw-circle-hero-icon"><RadioTower size={28}/></span><div><span className="sw-social-kicker">Pass the Aux</span><h1>{room.name}</h1><p>{room.members?.length||1} listeners · shared queue voting</p><div className="sw-circle-code"><code>{room.code}</code><button type="button" onClick={copy}><Copy size={14}/> Copy code</button></div></div><button type="button" className={syncPlayback?"sw-sync-toggle active":"sw-sync-toggle"} onClick={()=>setSyncPlayback(v=>!v)}><RefreshCw size={15}/> Sync {syncPlayback?"on":"off"}</button></header>
  {message?<div className="sw-social-message">{message}</div>:null}
  <div className="row g-3 g-xl-4"><div className="col-12 col-lg-8"><section className="sw-social-panel"><div className="sw-social-section-heading"><div><span className="sw-social-kicker">Playing</span><h2>Now in the room</h2></div></div>{room.currentSong?<button type="button" className="sw-room-current" onClick={()=>{player?.playSong?.(room.currentSong,[room.currentSong]);navigate(`/song/${room.currentSong._id}`,{state:{song:room.currentSong,playlist:[room.currentSong]}})}}><img src={getSongCover(room.currentSong)} alt=""/><span><strong>{room.currentSong.title}</strong><small>{getArtistName(room.currentSong)}</small></span><Play size={18}/></button>:<p className="sw-social-muted">The host hasn’t started a song yet.</p>}
  <div className="sw-social-section-heading mt-4"><div><span className="sw-social-kicker">Vote</span><h2>Up next</h2></div></div><form className="sw-room-add" onSubmit={addSong}><select value={songId} onChange={e=>setSongId(e.target.value)}><option value="">Add a song…</option>{songs.slice(0,120).map(song=><option key={song._id} value={song._id}>{song.title} — {getArtistName(song)}</option>)}</select><button className="sw-primary-btn" type="submit"><Plus size={15}/> Queue</button></form><div className="sw-room-queue">{queue.length?queue.map((entry,index)=><article key={entry._id}><span className="sw-room-rank">{index+1}</span><img src={getSongCover(entry.song)} alt=""/><span className="sw-room-song-copy"><strong>{entry.song?.title}</strong><small>{getArtistName(entry.song)} · {nameOf(entry.addedBy)}</small></span><button type="button" onClick={()=>vote(entry._id)}><ArrowBigUp size={16}/><strong>{entry.votes?.length||0}</strong></button></article>):<p className="sw-social-muted">The queue is empty.</p>}</div><button type="button" className="sw-secondary-btn mt-3" onClick={advance}>Host: play highest voted</button></section></div>
  <div className="col-12 col-lg-4"><section className="sw-social-panel"><div className="sw-social-section-heading"><div><span className="sw-social-kicker">Room</span><h2>Listeners</h2></div><UsersRound size={19}/></div><div className="sw-members-list">{(room.members||[]).map(member=><button type="button" key={member.user?._id||member._id} onClick={()=>member.user?._id&&navigate(`/u/${member.user._id}`)}><span className="sw-social-avatar small">{member.user?.image?<img src={member.user.image} alt=""/>:nameOf(member.user).slice(0,1).toUpperCase()}</span><span><strong>{nameOf(member.user)}</strong><small>{String(room.host?._id||room.host)===String(member.user?._id)?"Host":"Listener"}</small></span></button>)}</div></section></div></div></div>;
};
export default LiveRoom;
