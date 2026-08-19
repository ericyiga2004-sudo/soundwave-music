import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { MusicContext } from "../../context/ShopContext";
import { useRealtime } from "../../context/RealtimeContext";
import { apiClient, authHeaders } from "../../config/apiClient";
import "../../pages/CSS/RoomReactionsReliable.css";

const EMOJIS = ["❤️", "🔥", "😂", "👏", "🎵", "🙌"];
const BUBBLE_MS = 3900;
const KEEP_SEEN_MS = 30000;

const hashString = (value = "") => {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const motionFor = (reactionId) => {
  const hash = hashString(reactionId);
  return {
    left: 10 + (hash % 80),
    drift: ((hash >>> 8) % 180) - 90,
    rotate: ((hash >>> 20) % 34) - 17,
    scale: 0.92 + ((hash >>> 25) % 24) / 100,
  };
};

const normalizePacket = (packet = {}, fallbackCode = "") => {
  const code = String(packet?.code || fallbackCode || "").trim().toUpperCase();
  const emoji = String(packet?.emoji || "");
  const reactionId = String(packet?.reactionId || "");
  if (!code || !reactionId || !EMOJIS.includes(emoji)) return null;

  const serverAtMsRaw = Number(packet?.serverAtMs || Date.parse(packet?.at || "") || Date.now());
  return {
    ...packet,
    code,
    emoji,
    reactionId,
    serverAtMs: Number.isFinite(serverAtMsRaw) ? serverAtMsRaw : Date.now(),
  };
};

const RoomReactionOverlayReliable = ({ roomCode = "", viewerId = "" }) => {
  const { token, getAuthToken } = useContext(MusicContext);
  const { socket, connected } = useRealtime();
  const authToken = getAuthToken?.() || token || "";
  const headers = useMemo(() => authHeaders(authToken), [authToken]);
  const code = String(roomCode || "").trim().toUpperCase();

  const [bubbles, setBubbles] = useState([]);
  const [sendError, setSendError] = useState("");
  const seenRef = useRef(new Map());
  const timersRef = useRef(new Map());
  const seqRef = useRef(0);
  const pollInFlightRef = useRef(false);

  const remember = useCallback((reactionId) => {
    const now = Date.now();
    for (const [id, expiresAt] of seenRef.current.entries()) {
      if (expiresAt <= now) seenRef.current.delete(id);
    }
    if (seenRef.current.has(reactionId)) return false;
    seenRef.current.set(reactionId, now + KEEP_SEEN_MS);
    return true;
  }, []);

  const showPacket = useCallback((rawPacket = {}, { local = false } = {}) => {
    const packet = normalizePacket(rawPacket, code);
    if (!packet || packet.code !== code) return false;
    if (!remember(packet.reactionId)) return false;

    const elapsed = local ? 0 : Math.max(0, Date.now() - packet.serverAtMs);
    if (elapsed >= BUBBLE_MS - 120) return false;

    const motion = motionFor(packet.reactionId);
    const bubble = {
      id: packet.reactionId,
      emoji: packet.emoji,
      ...motion,
      delay: -Math.min(elapsed, BUBBLE_MS - 150),
    };

    setBubbles((current) => [...current.slice(-119), bubble]);

    const timeoutMs = Math.max(180, BUBBLE_MS - elapsed + 220);
    const timer = window.setTimeout(() => {
      setBubbles((current) => current.filter((item) => item.id !== bubble.id));
      timersRef.current.delete(bubble.id);
    }, timeoutMs);
    timersRef.current.set(bubble.id, timer);
    return true;
  }, [code, remember]);

  // INSTANT PATH: receive the server SSE push.
  useEffect(() => {
    if (!socket || !code) return undefined;
    const onReaction = (packet) => showPacket(packet);
    socket.on("room:reaction", onReaction);
    return () => socket.off("room:reaction", onReaction);
  }, [socket, code, showPacket]);

  // RELIABILITY PATH: reconcile a tiny 12-second server buffer. This is what
  // makes reactions survive a stale/missed SSE connection, different browser
  // profiles, separate devices, and brief reconnect windows.
  const reconcile = useCallback(async () => {
    if (!code || !authToken || pollInFlightRef.current || document.visibilityState !== "visible") return;
    pollInFlightRef.current = true;
    try {
      const { data } = await apiClient.get(`/api/social/rooms/${code}/reactions/recent`, {
        headers,
        params: { _: Date.now() },
      });
      (data?.reactions || []).forEach((packet) => showPacket(packet));
    } catch {
      // SSE may still be healthy. Do not flash UI errors for background reconciliation.
    } finally {
      pollInFlightRef.current = false;
    }
  }, [authToken, code, headers, showPacket]);

  useEffect(() => {
    if (!code || !authToken) return undefined;
    reconcile();
    const interval = window.setInterval(reconcile, connected ? 850 : 450);
    const onVisible = () => document.visibilityState === "visible" && reconcile();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", reconcile);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", reconcile);
    };
  }, [authToken, code, connected, reconcile]);

  useEffect(() => () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current.clear();
    seenRef.current.clear();
  }, []);

  const react = useCallback(async (emoji) => {
    if (!code || !EMOJIS.includes(emoji)) return;

    seqRef.current += 1;
    const reactionId = `${viewerId || "member"}-${Date.now()}-${seqRef.current}-${
      globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 10)
    }`;

    // Critical UX rule: the tapper ALWAYS sees their own reaction immediately,
    // before any authentication/network/SSE work can succeed or fail.
    const optimistic = {
      code,
      reactionId,
      emoji,
      actorId: viewerId || "",
      serverAtMs: Date.now(),
      at: new Date().toISOString(),
    };
    showPacket(optimistic, { local: true });
    setSendError("");

    if (!authToken) {
      setSendError("Reconnect to send reactions live.");
      return;
    }

    try {
      const { data } = await apiClient.post(
        `/api/social/rooms/${code}/reactions`,
        { emoji, reactionId },
        { headers }
      );
      // Server echoes the authoritative packet. It is intentionally de-duped
      // against the already-visible optimistic bubble on the sender.
      if (data?.reaction) showPacket(data.reaction);
    } catch (error) {
      setSendError(error?.response?.data?.message || "Reaction could not reach the room.");
    }
  }, [authToken, code, headers, showPacket, viewerId]);

  if (!code) return null;

  return (
    <>
      <div className="sw2316-reaction-layer" aria-hidden="true">
        {bubbles.map((bubble) => (
          <span
            className="sw2316-reaction-bubble"
            key={bubble.id}
            style={{
              left: `${bubble.left}%`,
              "--sw2316-drift": `${bubble.drift}px`,
              "--sw2316-rotate": `${bubble.rotate}deg`,
              "--sw2316-scale": bubble.scale,
              animationDelay: `${bubble.delay}ms`,
            }}
          >
            {bubble.emoji}
          </span>
        ))}
      </div>

      <div className="sw2316-reaction-dock" aria-label="Live room reactions">
        {EMOJIS.map((emoji) => (
          <button type="button" key={emoji} onClick={() => react(emoji)} aria-label={`Send ${emoji}`}>
            {emoji}
          </button>
        ))}
      </div>

      {sendError ? <div className="sw2316-reaction-error" role="status">{sendError}</div> : null}
    </>
  );
};

export default RoomReactionOverlayReliable;
