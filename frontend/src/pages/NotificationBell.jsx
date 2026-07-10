import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  FaBell,
  FaCheckDouble,
  FaInbox,
  FaTimes,
  FaTrash,
} from "react-icons/fa";

import { MusicContext } from "../context/ShopContext";
import "./CSS/NotificationBell.css";
import { MusicPlayerContext } from "../context/MainPlayerContext";

const isBadTokenValue = (value) => {
  if (!value) return true;

  const cleanValue = String(value).trim().toLowerCase();

  return (
    cleanValue === "" ||
    cleanValue === "false" ||
    cleanValue === "null" ||
    cleanValue === "undefined" ||
    cleanValue === "none" ||
    cleanValue === "nan"
  );
};

const getValidToken = (token, getAuthToken) => {
  const cleanToken =
    getAuthToken?.() ||
    String(token || localStorage.getItem("token") || "").trim();

  return isBadTokenValue(cleanToken) ? "" : cleanToken;
};

const NotificationBell = () => {
  const { token, getAuthToken, backendUrl } = useContext(MusicContext);

  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const authToken = useMemo(() => {
    return getValidToken(token, getAuthToken);
  }, [token, getAuthToken]);

  const fetchNotifications = async () => {
    if (!authToken || !backendUrl) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    try {
      setLoading(true);

      const res = await axios.get(`${backendUrl}/api/notifications`, {
        headers: {
          token: authToken,
        },
      });

      if (res.data?.success) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(Number(res.data.unreadCount || 0));
      } else {
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (error) {
      console.log("Fetch notifications error:", error);
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    if (!authToken || !backendUrl) return;

    try {
      const res = await axios.get(
        `${backendUrl}/api/notifications/unread-count`,
        {
          headers: {
            token: authToken,
          },
        }
      );

      if (res.data?.success) {
        setUnreadCount(Number(res.data.unreadCount || 0));
      }
    } catch (error) {
      console.log("Fetch unread notifications error:", error);
    }
  };

  useEffect(() => {
    fetchNotifications();

    const interval = setInterval(fetchUnreadCount, 30000);

    window.addEventListener("notification-updated", fetchNotifications);
    window.addEventListener("playlist-shared", fetchNotifications);

    return () => {
      clearInterval(interval);
      window.removeEventListener("notification-updated", fetchNotifications);
      window.removeEventListener("playlist-shared", fetchNotifications);
    };
  }, [authToken, backendUrl]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!dropdownRef.current) return;

      if (!dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const markRead = async (notificationId) => {
    if (!notificationId || !authToken) return;

    try {
      const res = await axios.post(
        `${backendUrl}/api/notifications/${notificationId}/read`,
        {},
        {
          headers: {
            token: authToken,
          },
        }
      );

      if (res.data?.success) {
        setNotifications((prev) =>
          prev.map((notification) =>
            notification._id === notificationId
              ? {
                  ...notification,
                  isRead: true,
                  readAt: new Date().toISOString(),
                }
              : notification
          )
        );

        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.log("Mark notification read error:", error);
    }
  };

  const markAllRead = async () => {
    if (!authToken) return;

    try {
      const res = await axios.post(
        `${backendUrl}/api/notifications/read-all`,
        {},
        {
          headers: {
            token: authToken,
          },
        }
      );

      if (res.data?.success) {
        setNotifications((prev) =>
          prev.map((notification) => ({
            ...notification,
            isRead: true,
            readAt: notification.readAt || new Date().toISOString(),
          }))
        );

        setUnreadCount(0);
      }
    } catch (error) {
      console.log("Mark all notifications read error:", error);
    }
  };

  const deleteNotification = async (notificationId) => {
    if (!notificationId || !authToken) return;

    try {
      const notification = notifications.find(
        (item) => item._id === notificationId
      );

      const res = await axios.delete(
        `${backendUrl}/api/notifications/${notificationId}`,
        {
          headers: {
            token: authToken,
          },
        }
      );

      if (res.data?.success) {
        setNotifications((prev) =>
          prev.filter((item) => item._id !== notificationId)
        );

        if (notification && !notification.isRead) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      }
    } catch (error) {
      console.log("Delete notification error:", error);
    }
  };

  const openNotification = async (notification) => {
    if (!notification?._id) return;

    if (!notification.isRead) {
      await markRead(notification._id);
    }

    setOpen(false);

    if (notification.link) {
      navigate(notification.link);
    }
  };

  const formatDate = (date) => {
    if (!date) return "Now";

    const value = new Date(date);

    if (Number.isNaN(value.getTime())) return "Now";

    const diffMs = Date.now() - value.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return value.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  if (!authToken) {
    return null;
  }

  return (
    <div className="notification-bell-wrap" ref={dropdownRef}>
      <button
        type="button"
        className={open ? "notification-bell-btn active" : "notification-bell-btn"}
        onClick={() => {
          setOpen((prev) => !prev);
          fetchNotifications();
        }}
        aria-label="Notifications"
      >
        <FaBell />

        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notification-dropdown">
          <div className="notification-dropdown-header">
            <div>
              <h3>Notifications</h3>
              <p>{unreadCount} unread</p>
            </div>

            <div className="notification-header-actions">
              {unreadCount > 0 && (
                <button type="button" onClick={markAllRead}>
                  <FaCheckDouble />
                </button>
              )}

              <button type="button" onClick={() => setOpen(false)}>
                <FaTimes />
              </button>
            </div>
          </div>

          <div className="notification-list">
            {loading ? (
              <div className="notification-empty">
                <FaInbox />
                <p>Loading notifications...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="notification-empty">
                <FaInbox />
                <p>No notifications yet.</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  className={
                    notification.isRead
                      ? "notification-item"
                      : "notification-item unread"
                  }
                  key={notification._id}
                >
                  <button
                    type="button"
                    className="notification-main"
                    onClick={() => openNotification(notification)}
                  >
                    <span className="notification-dot"></span>

                    <div>
                      <h4>{notification.title}</h4>

                      <p>{notification.message}</p>

                      <small>{formatDate(notification.createdAt)}</small>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="notification-delete"
                    onClick={() => deleteNotification(notification._id)}
                    aria-label="Delete notification"
                  >
                    <FaTrash />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;