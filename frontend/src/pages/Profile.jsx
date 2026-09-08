import { useContext, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import axios from "axios";
import { MusicContext } from "../context/ShopContext";
export default function Profile() {
  const { token, backendUrl } = useContext(MusicContext);
  const [id, setId] = useState("");
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    if (token) axios.get(`${backendUrl}/api/user/profile`, {headers:{token},timeout:15000})
      .then(({data})=>{if(active) {if(data.user?._id) setId(data.user._id); else setError(true);}})
      .catch(()=>{if(active)setError(true);});
    return ()=>{active=false;};
  },[token,backendUrl,retry]);
  if (!token) return <Navigate to="/account" replace/>;
  if (id) return <Navigate to={`/u/${id}`} replace/>;
  return <div className="p-4"><p role="status">{error ? "Your profile could not load." : "Loading your profile…"}</p>{error && <button className="sw-account-profile-link" onClick={()=>setRetry(x=>x+1)}>Retry</button>}</div>;
}
