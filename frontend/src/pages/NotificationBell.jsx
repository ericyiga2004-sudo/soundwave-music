import { useContext, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { FaBell, FaCheckDouble, FaInbox, FaTimes, FaTrash } from "react-icons/fa";
import { MusicContext } from "../context/ShopContext";
import "./CSS/NotificationBell.css";

const bad = new Set(["", "false", "null", "undefined", "none", "nan"]);
const getValidToken = (token, getAuthToken) => {
  const clean = String(getAuthToken?.() || token || localStorage.getItem("token") || "").trim();
  return bad.has(clean.toLowerCase()) ? "" : clean;
};
const actorName = (n) => n?.fromUser?.username || n?.fromUser?.name || "SoundWave";

const NotificationBell = () => {
  const { token, getAuthToken, backendUrl } = useContext(MusicContext);
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const seenRef = useRef(new Set());
  const initializedRef = useRef(false);
  const toastTimersRef = useRef(new Map());
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const authToken = useMemo(() => getValidToken(token, getAuthToken), [token, getAuthToken]);

  const dismissToast = (id) => {
    const timer = toastTimersRef.current.get(id);
    if (timer) clearTimeout(timer);
    toastTimersRef.current.delete(id);
    setToasts((items) => items.filter((item) => item._id !== id));
  };

  const announce = (incoming) => {
    const fresh = (incoming || []).filter((item) => !item.isRead && !seenRef.current.has(item._id)).slice(0, 2);
    incoming.forEach((item) => seenRef.current.add(item._id));
    if (!initializedRef.current) { initializedRef.current = true; return; }
    if (!fresh.length) return;
    setToasts((current) => [...fresh, ...current.filter((item) => !fresh.some((n) => n._id === item._id))].slice(0, 3));
    fresh.forEach((item) => {
      const timer = setTimeout(() => dismissToast(item._id), 6500);
      toastTimersRef.current.set(item._id, timer);
    });
  };

  const fetchNotifications = async ({ quiet = false, showPopups = false } = {}) => {
    if (!authToken || !backendUrl) { setNotifications([]); setUnreadCount(0); return; }
    try {
      if (!quiet) setLoading(true);
      const res = await axios.get(`${backendUrl}/api/notifications`, { headers: { token: authToken }, params: { limit: 25 } });
      if (res.data?.success) {
        const list = res.data.notifications || [];
        if (showPopups) announce(list); else { list.forEach((item)=>seenRef.current.add(item._id)); initializedRef.current = true; }
        setNotifications(list);
        setUnreadCount(Number(res.data.unreadCount || 0));
      }
    } catch (error) { console.log("Fetch notifications error:", error); }
    finally { if (!quiet) setLoading(false); }
  };

  useEffect(() => {
    seenRef.current = new Set(); initializedRef.current = false; setToasts([]);
    fetchNotifications();
    const interval = setInterval(() => { if (document.visibilityState === "visible") fetchNotifications({ quiet: true, showPopups: true }); }, 25000);
    const refresh = () => fetchNotifications({ quiet: true, showPopups: true });
    window.addEventListener("notification-updated", refresh);
    window.addEventListener("playlist-shared", refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("notification-updated", refresh);
      window.removeEventListener("playlist-shared", refresh);
      toastTimersRef.current.forEach(clearTimeout);
      toastTimersRef.current.clear();
    };
  }, [authToken, backendUrl]);

  useEffect(() => {
    const outside = (event) => { if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setOpen(false); };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, []);

  const markRead = async (id) => {
    if (!id || !authToken) return;
    try {
      const res = await axios.post(`${backendUrl}/api/notifications/${id}/read`, {}, { headers: { token: authToken } });
      if (res.data?.success) {
        setNotifications((items)=>items.map((n)=>n._id===id?{...n,isRead:true,readAt:new Date().toISOString()}:n));
        setUnreadCount((n)=>Math.max(0,n-1));
      }
    } catch (error) { console.log("Mark notification read error:", error); }
  };
  const markAllRead = async () => {
    if (!authToken) return;
    try { const res=await axios.post(`${backendUrl}/api/notifications/read-all`,{}, {headers:{token:authToken}}); if(res.data?.success){setNotifications((items)=>items.map((n)=>({...n,isRead:true,readAt:n.readAt||new Date().toISOString()})));setUnreadCount(0);setToasts([]);} } catch(error){console.log(error);}
  };
  const deleteNotification = async (id) => {
    if (!id || !authToken) return;
    const existing=notifications.find((n)=>n._id===id);
    try { const res=await axios.delete(`${backendUrl}/api/notifications/${id}`,{headers:{token:authToken}}); if(res.data?.success){setNotifications((items)=>items.filter((n)=>n._id!==id));if(existing&&!existing.isRead)setUnreadCount((n)=>Math.max(0,n-1));dismissToast(id);} } catch(error){console.log(error);}
  };
  const openNotification = async (notification) => {
    if (!notification?._id) return;
    if (!notification.isRead) await markRead(notification._id);
    dismissToast(notification._id); setOpen(false);
    if (notification.link) navigate(notification.link);
  };
  const formatDate=(date)=>{const value=new Date(date||0);if(Number.isNaN(value.getTime()))return"Now";return value.toLocaleString(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});};

  if (!authToken) return null;
  return <>
    <div className="notification-bell-wrap" ref={dropdownRef}>
      <button type="button" className={open?"notification-bell-btn active":"notification-bell-btn"} onClick={()=>{setOpen((v)=>!v);fetchNotifications();}} aria-label={`${unreadCount} unread notifications`}><FaBell/>{unreadCount>0?<span className="notification-badge">{unreadCount>99?"99+":unreadCount}</span>:null}</button>
      {open?<div className="notification-dropdown"><div className="notification-dropdown-header"><div><h3>Notifications</h3><p>{unreadCount} unread</p></div><div className="notification-header-actions">{unreadCount>0?<button type="button" onClick={markAllRead} aria-label="Mark all read"><FaCheckDouble/></button>:null}<button type="button" onClick={()=>setOpen(false)} aria-label="Close"><FaTimes/></button></div></div><div className="notification-list">{loading?<div className="notification-empty"><FaInbox/><p>Loading notifications…</p></div>:notifications.length===0?<div className="notification-empty"><FaInbox/><p>No notifications yet.</p></div>:notifications.map((notification)=><div className={notification.isRead?"notification-item":"notification-item unread"} key={notification._id}><button type="button" className="notification-main" onClick={()=>openNotification(notification)}><span className="notification-dot"/><span className="notification-avatar">{notification.fromUser?.image?<img src={notification.fromUser.image} alt=""/>:actorName(notification).slice(0,1).toUpperCase()}</span><span className="notification-copy"><h4>{notification.title}</h4><p>{notification.message}</p><small>{formatDate(notification.createdAt)}</small></span></button><button type="button" className="notification-delete" onClick={()=>deleteNotification(notification._id)} aria-label="Delete notification"><FaTrash/></button></div>)}</div></div>:null}
    </div>
    {toasts.length?<div className="notification-toast-stack" aria-live="polite">{toasts.map((notification)=><article className="notification-toast" key={notification._id}><button type="button" className="notification-toast-main" onClick={()=>openNotification(notification)}><span className="notification-avatar">{notification.fromUser?.image?<img src={notification.fromUser.image} alt=""/>:actorName(notification).slice(0,1).toUpperCase()}</span><span><small>SoundWave</small><strong>{notification.title}</strong><em>{notification.message}</em></span></button><button type="button" className="notification-toast-close" onClick={()=>dismissToast(notification._id)} aria-label="Dismiss"><FaTimes/></button></article>)}</div>:null}
  </>;
};
export default NotificationBell;
