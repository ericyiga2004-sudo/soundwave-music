import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaBell, FaCheckDouble, FaInbox, FaTimes, FaTrash } from "react-icons/fa";
import { MusicContext } from "../context/ShopContext";
import { MusicPlayerContext } from "../context/MainPlayerContext";
import { useRealtime } from "../context/RealtimeContext";
import { apiClient } from "../config/apiClient";
import { getSongCover } from "../utils/catalog";
import { getSongAudioUrl } from "../utils/audioSource";
import "./CSS/NotificationBell.css";

const bad = new Set(["", "false", "null", "undefined", "none", "nan"]);
const getValidToken = (token, getAuthToken) => {
  const clean = String(getAuthToken?.() || token || localStorage.getItem("token") || "").trim();
  return bad.has(clean.toLowerCase()) ? "" : clean;
};
const actorName = (n) => n?.fromUser?.username || n?.fromUser?.name || "SoundWave";
const notificationTime = (notification) =>
  notification?.eventAt || notification?.updatedAt || notification?.createdAt || null;
const notificationEventKey = (notification) =>
  `${notification?._id || ""}:${notificationTime(notification) || ""}`;
const sortNotifications = (items = []) => [...items].sort((a, b) => {
  const aTime = new Date(notificationTime(a) || 0).getTime();
  const bTime = new Date(notificationTime(b) || 0).getTime();
  if (bTime !== aTime) return bTime - aTime;
  return String(b?._id || "").localeCompare(String(a?._id || ""));
});

const NotificationBell = () => {
  const { token, getAuthToken, songs = [] } = useContext(MusicContext);
  const player = useContext(MusicPlayerContext);
  const { socket, connected, mode } = useRealtime();
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const seenRef = useRef(new Set());
  const initializedRef = useRef(false);
  const toastTimersRef = useRef(new Map());
  const pendingUnreadRef = useRef(new Set());
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const authToken = useMemo(() => getValidToken(token, getAuthToken), [token, getAuthToken]);
  const headers = useMemo(() => ({ token: authToken }), [authToken]);

  const dismissToast = (id, { commitUnread = true } = {}) => {
    const timer = toastTimersRef.current.get(id);
    if (timer) clearTimeout(timer);
    toastTimersRef.current.delete(id);
    const wasPending = pendingUnreadRef.current.has(id);
    if (wasPending) {
      pendingUnreadRef.current.delete(id);
      if (commitUnread) setUnreadCount((count) => count + 1);
    }
    setToasts((items) => items.filter((item) => item._id !== id));
  };

  const pushToast = (notification) => {
    if (!notification?._id || notification.isRead) return;
    pendingUnreadRef.current.add(notification._id);
    setToasts((current) => [notification, ...current.filter((item) => item._id !== notification._id)].slice(0, 3));
    const previous = toastTimersRef.current.get(notification._id);
    if (previous) clearTimeout(previous);
    const timer = setTimeout(() => dismissToast(notification._id), 7000);
    toastTimersRef.current.set(notification._id, timer);
  };

  const announceList = (incoming) => {
    const ordered = sortNotifications(incoming || []);
    const fresh = ordered
      .filter((item) => !item.isRead && !seenRef.current.has(notificationEventKey(item)))
      .slice(0, 3);
    ordered.forEach((item) => seenRef.current.add(notificationEventKey(item)));
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }
    fresh.forEach(pushToast);
  };

  const fetchNotifications = async ({ quiet = false, showPopups = false } = {}) => {
    if (!authToken) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    try {
      if (!quiet) setLoading(true);
      const { data } = await apiClient.get("/api/notifications", { headers, params: { limit: 25 } });
      if (data?.success) {
        const list = sortNotifications(data.notifications || []);
        if (showPopups) announceList(list);
        else {
          list.forEach((item) => seenRef.current.add(notificationEventKey(item)));
          initializedRef.current = true;
        }
        setNotifications(list);
        setUnreadCount(Math.max(0, Number(data.unreadCount || 0) - pendingUnreadRef.current.size));
      }
    } catch (error) {
      console.log("Fetch notifications error:", error);
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    seenRef.current = new Set();
    initializedRef.current = false;
    pendingUnreadRef.current = new Set();
    setToasts([]);
    fetchNotifications();

    return () => {
      toastTimersRef.current.forEach(clearTimeout);
      toastTimersRef.current.clear();
      pendingUnreadRef.current.clear();
    };
  }, [authToken]);

  useEffect(() => {
    if (!authToken) return undefined;

    // Quiet fallback remains live-feeling without requiring the bell to open.
    const refresh = () => fetchNotifications({ quiet: true, showPopups: true });
    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && !connected) refresh();
    }, 3500);
    const onVisibility = () => { if (document.visibilityState === "visible" && !connected) refresh(); };
    const onFocus = () => { if (!connected) refresh(); };

    window.addEventListener("notification-updated", refresh);
    window.addEventListener("playlist-shared", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("notification-updated", refresh);
      window.removeEventListener("playlist-shared", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [authToken, connected]);

  useEffect(() => {
    if (!socket || !authToken) return undefined;

    const onNotification = (notification) => {
      if (!notification?._id) return;
      const eventKey = notificationEventKey(notification);
      const already = seenRef.current.has(eventKey);
      seenRef.current.add(eventKey);
      setNotifications((current) => sortNotifications([
        notification,
        ...current.filter((item) => item._id !== notification._id),
      ]).slice(0, 25));
      if (!notification.isRead && !already) {
        pushToast(notification);
        if (Number.isFinite(Number(notification.unreadCount))) {
          setUnreadCount(Math.max(0, Number(notification.unreadCount) - pendingUnreadRef.current.size));
        }
      }
      window.dispatchEvent(new CustomEvent("soundwave-realtime-notification", { detail: notification }));
    };

    const onNotificationUpdate = () => fetchNotifications({ quiet: true, showPopups: false });
    socket.on("notification:new", onNotification);
    socket.on("notification:update", onNotificationUpdate);
    return () => {
      socket.off("notification:new", onNotification);
      socket.off("notification:update", onNotificationUpdate);
    };
  }, [socket, authToken]);

  useEffect(() => {
    const outside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, []);

  const markRead = async (id) => {
    if (!id || !authToken) return;
    try {
      const { data } = await apiClient.post(`/api/notifications/${id}/read`, {}, { headers });
      if (data?.success) {
        const wasPending = pendingUnreadRef.current.delete(id);
        setNotifications((items) => items.map((n) => n._id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n));
        if (!wasPending) setUnreadCount((n) => Math.max(0, n - 1));
      }
    } catch (error) {
      console.log("Mark notification read error:", error);
    }
  };

  const markAllRead = async () => {
    if (!authToken) return;
    try {
      const { data } = await apiClient.post("/api/notifications/read-all", {}, { headers });
      if (data?.success) {
        setNotifications((items) => items.map((n) => ({ ...n, isRead: true, readAt: n.readAt || new Date().toISOString() })));
        setUnreadCount(0);
        pendingUnreadRef.current.clear();
        setToasts([]);
      }
    } catch (error) {
      console.log(error);
    }
  };

  const deleteNotification = async (id) => {
    if (!id || !authToken) return;
    const existing = notifications.find((n) => n._id === id);
    try {
      const { data } = await apiClient.delete(`/api/notifications/${id}`, { headers });
      if (data?.success) {
        const wasPending = pendingUnreadRef.current.has(id);
        setNotifications((items) => items.filter((n) => n._id !== id));
        dismissToast(id, { commitUnread: false });
        if (existing && !existing.isRead && !wasPending) setUnreadCount((n) => Math.max(0, n - 1));
      }
    } catch (error) {
      console.log(error);
    }
  };

  const resolveSharedSong = async (notification) => {
    const related = notification?.relatedSong;
    const songId = String(related?._id || related || "");
    if (!songId) return null;

    const catalogSong = (songs || []).find((song) => String(song?._id) === songId);
    if (catalogSong && getSongAudioUrl(catalogSong)) return catalogSong;
    if (related && typeof related === "object" && getSongAudioUrl(related)) return related;

    try {
      const { data } = await apiClient.get(`/api/songs/${songId}`);
      return data?.success ? data.song : null;
    } catch {
      return related && typeof related === "object" ? related : null;
    }
  };

  const openNotification = async (notification) => {
    if (!notification?._id) return;
    dismissToast(notification._id, { commitUnread: false });
    setOpen(false);

    if (notification.type === "live_started" && notification.link) {
      const match = String(notification.link).match(/\/social\/rooms\/([A-Z0-9]+)/i);
      const code = String(match?.[1] || "").toUpperCase();
      if (code) {
        try {
          await apiClient.post("/api/social/rooms/join", { code }, { headers });
          if (!notification.isRead) await markRead(notification._id);
          navigate(`/social/rooms/${code}`);
          return;
        } catch (error) {
          console.warn("Live room join from notification failed:", error?.response?.data?.message || error?.message);
        }
      }
    }

    if (["song_shared", "replay_for_you"].includes(notification.type) && notification.relatedSong) {
      const sharedSong = await resolveSharedSong(notification);
      if (sharedSong?._id) {
        await player?.playSong?.(sharedSong, [sharedSong]);
        window.dispatchEvent(new CustomEvent("soundwave-shared-song-played", {
          detail: { songId: String(sharedSong._id), notificationId: String(notification._id) },
        }));
        if (!notification.isRead) markRead(notification._id);
        return;
      }
    }

    if (!notification.isRead) markRead(notification._id);
    if (notification.link) navigate(notification.link);
  };

  const formatDate = (date) => {
    const value = new Date(date || 0);
    if (Number.isNaN(value.getTime())) return "Now";
    const deltaMs = Math.max(0, Date.now() - value.getTime());
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (deltaMs < minute) return "Just now";
    if (deltaMs < hour) return `${Math.max(1, Math.floor(deltaMs / minute))}m ago`;
    if (deltaMs < day) return `${Math.max(1, Math.floor(deltaMs / hour))}h ago`;
    if (deltaMs < 7 * day) return `${Math.max(1, Math.floor(deltaMs / day))}d ago`;
    return value.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  };

  if (!authToken) return null;

  return (
    <>
      <div className="notification-bell-wrap" ref={dropdownRef}>
        <button
          type="button"
          className={open ? "notification-bell-btn active" : "notification-bell-btn"}
          onClick={() => {
            if (!open && pendingUnreadRef.current.size) {
              const pending = pendingUnreadRef.current.size;
              pendingUnreadRef.current.clear();
              setUnreadCount((count) => count + pending);
            }
            setOpen((value) => !value);
          }}
          aria-label={`${unreadCount} unread notifications`}
          title={connected ? "Live notifications connected" : mode === "polling" ? "Notifications updating automatically" : "Notifications"}
        >
          <FaBell />
          {unreadCount > 0 ? <span className="notification-badge">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
          {connected ? <span className="notification-live-dot" aria-hidden="true" /> : null}
        </button>

        {open ? (
          <div className="notification-dropdown">
            <div className="notification-dropdown-header">
              <div>
                <h3>Notifications</h3>
                <p>{connected ? "Live" : mode === "polling" ? "Updates on" : `${unreadCount} unread`}</p>
              </div>
              <div className="notification-header-actions">
                {unreadCount > 0 ? <button type="button" onClick={markAllRead} aria-label="Mark all read"><FaCheckDouble /></button> : null}
                <button type="button" onClick={() => setOpen(false)} aria-label="Close"><FaTimes /></button>
              </div>
            </div>
            <div className="notification-list">
              {loading ? (
                <div className="notification-empty"><FaInbox /><p>Loading notifications…</p></div>
              ) : notifications.length === 0 ? (
                <div className="notification-empty"><FaInbox /><p>No notifications yet.</p></div>
              ) : notifications.map((notification) => (
                <div className={notification.isRead ? "notification-item" : "notification-item unread"} key={notification._id}>
                  <button type="button" className={notification.relatedSong ? "notification-main has-song" : "notification-main"} onClick={() => openNotification(notification)}>
                    <span className="notification-dot" />
                    <span className="notification-avatar">
                      {notification.fromUser?.image ? <img src={notification.fromUser.image} alt="" /> : actorName(notification).slice(0, 1).toUpperCase()}
                    </span>
                    <span className="notification-copy">
                      <h4>{notification.title}</h4>
                      <p>{notification.message}</p>
                      <small>{formatDate(notificationTime(notification))}</small>
                    </span>
                    {notification.relatedSong ? <img className="notification-song-cover" src={getSongCover(notification.relatedSong)} alt="" loading="lazy" /> : null}
                  </button>
                  <button type="button" className="notification-delete" onClick={() => deleteNotification(notification._id)} aria-label="Delete notification"><FaTrash /></button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {toasts.length ? (
        <div className="notification-toast-stack" aria-live="polite">
          {toasts.map((notification) => (
            <article className="notification-toast" key={notification._id}>
              <button type="button" className={notification.relatedSong ? "notification-toast-main has-song" : "notification-toast-main"} onClick={() => openNotification(notification)}>
                <span className="notification-avatar">
                  {notification.fromUser?.image ? <img src={notification.fromUser.image} alt="" /> : actorName(notification).slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <small>{connected ? "SoundWave · Live" : "SoundWave · New"}</small>
                  <strong>{notification.title}</strong>
                  <em>{notification.message}</em>
                </span>
                {notification.relatedSong ? <img className="notification-toast-song-cover" src={getSongCover(notification.relatedSong)} alt="" /> : null}
              </button>
              <button type="button" className="notification-toast-close" onClick={() => dismissToast(notification._id)} aria-label="Dismiss"><FaTimes /></button>
            </article>
          ))}
        </div>
      ) : null}
    </>
  );
};

export default NotificationBell;
