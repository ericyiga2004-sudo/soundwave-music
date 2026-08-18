import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { MusicContext } from "../context/ShopContext";
import { useRealtime } from "../context/RealtimeContext";
import { apiClient, authHeaders } from "../config/apiClient";

const SOCIAL_EVENTS = [
  "social:refresh",
  "people:update",
  "profile:update",
  "daily:update",
  "share:update",
  "taste:update",
  "circle:update",
  "room:update",
];

export const announceSocialMutation = (reason = "social", detail = {}) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("soundwave-social-mutated", {
    detail: { reason, at: Date.now(), ...detail },
  }));
};

export const useSocialHome = ({ autoRefresh = true } = {}) => {
  const { token, getAuthToken } = useContext(MusicContext);
  const { socket, connected, mode } = useRealtime();
  const authToken = getAuthToken?.() || token || "";
  const headers = useMemo(() => authHeaders(authToken), [authToken]);
  const [home, setHome] = useState(null);
  const [loading, setLoading] = useState(Boolean(authToken));
  const [error, setError] = useState("");
  const refreshTimerRef = useRef(null);
  const requestRef = useRef(0);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!authToken) {
      setHome(null);
      setLoading(false);
      return null;
    }

    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    if (!quiet) setLoading(true);

    try {
      const { data } = await apiClient.get("/api/social/home", { headers });
      if (!data?.success) throw new Error(data?.message || "Could not load SoundWave Social");
      if (requestId !== requestRef.current) return data;
      setHome(data);
      setError("");
      return data;
    } catch (err) {
      if (!quiet && requestId === requestRef.current) {
        setError(err?.response?.data?.message || err.message || "Could not load SoundWave Social");
      }
      return null;
    } finally {
      if (!quiet && requestId === requestRef.current) setLoading(false);
    }
  }, [authToken, headers]);

  const scheduleRefresh = useCallback((delay = 90) => {
    if (!autoRefresh || !authToken) return;
    if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      if (document.visibilityState === "visible") load({ quiet: true });
    }, delay);
  }, [autoRefresh, authToken, load]);

  const invalidateSocial = useCallback((reason = "social", detail = {}) => {
    announceSocialMutation(reason, detail);
    scheduleRefresh(0);
  }, [scheduleRefresh]);

  useEffect(() => {
    load();
    return () => {
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    };
  }, [load]);


  useEffect(() => {
    if (!socket || !authToken) return undefined;
    const onPresence = (event) => {
      const userId = String(event?.userId || "");
      if (!userId) return;
      const online = Boolean(event?.online);
      const patch = (items = []) => items.map((user) => String(user?._id || "") === userId ? { ...user, online } : user);
      setHome((current) => current ? {
        ...current,
        me: String(current.me?._id || "") === userId ? { ...current.me, online } : current.me,
        people: patch(current.people || []),
        following: patch(current.following || []),
      } : current);
    };
    socket.on("presence:update", onPresence);
    return () => socket.off("presence:update", onPresence);
  }, [socket, authToken]);

  useEffect(() => {
    if (!autoRefresh || !socket || !authToken) return undefined;
    const refresh = () => scheduleRefresh(80);
    SOCIAL_EVENTS.forEach((event) => socket.on(event, refresh));
    return () => SOCIAL_EVENTS.forEach((event) => socket.off(event, refresh));
  }, [socket, authToken, autoRefresh, scheduleRefresh]);

  useEffect(() => {
    if (!autoRefresh || !authToken) return undefined;
    const onMutation = () => scheduleRefresh(0);
    window.addEventListener("soundwave-social-mutated", onMutation);
    return () => window.removeEventListener("soundwave-social-mutated", onMutation);
  }, [autoRefresh, authToken, scheduleRefresh]);

  useEffect(() => {
    if (!autoRefresh || !authToken || connected || mode !== "polling") return undefined;

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") load({ quiet: true });
    }, 6000);

    const refreshNow = () => {
      if (document.visibilityState === "visible") scheduleRefresh(0);
    };

    document.addEventListener("visibilitychange", refreshNow);
    window.addEventListener("focus", refreshNow);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshNow);
      window.removeEventListener("focus", refreshNow);
    };
  }, [autoRefresh, authToken, connected, mode, load, scheduleRefresh]);

  return {
    authToken,
    headers,
    home,
    setHome,
    loading,
    error,
    load,
    invalidateSocial,
    realtimeConnected: connected,
    realtimeMode: mode,
  };
};

export default useSocialHome;
