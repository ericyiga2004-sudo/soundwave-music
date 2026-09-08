import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

export default function AccountIdentity({ token, backendUrl }) {
  const [user, setUser] = useState(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setUser(null); setFailed(false);
    axios.get(`${backendUrl}/api/user/profile`, { headers: { token }, timeout: 15000 })
      .then(({data})=>{if (!cancelled) { if(data.user?._id) setUser(data.user); else setFailed(true); }})
      .catch(()=>{if(!cancelled) setFailed(true);});
    return ()=>{cancelled=true;};
  }, [token, backendUrl, attempt]);
  if (failed) return <div><p>Your profile could not load.</p><button className="sw-account-profile-link" type="button" onClick={()=>setAttempt(x=>x+1)}>Retry profile</button></div>;
  if (!user) return <p role="status">Loading your profile…</p>;
  return <div className="sw-account-identity"><strong>{user.username || user.name || "SoundWave listener"}</strong><p>{user.followersCount ?? user.followers?.length ?? 0} followers · {user.followingCount ?? user.followingUsers?.length ?? 0} following</p><Link className="sw-account-profile-link" to={`/u/${user._id}`}>View my profile</Link></div>;
}
