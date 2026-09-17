import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { MusicContext } from "../../context/ShopContext";
import { useRealtime } from "../../context/RealtimeContext";
import { apiClient, authHeaders } from "../../config/apiClient";
import "../../pages/CSS/RoomReactionsV2.tailwind.css";

const REACTIONS = ["❤️", "🔥", "😂", "👏", "🎵", "🙌"];
const CHANNEL_NAME = "soundwave-room-reactions-v2";
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value)));

const RoomReactionOverlayV2 = ({ roomCode = "", viewerId = "" }) => {
  const { token, getAuthToken } = useContext(MusicContext);
  const { socket } = useRealtime();
  const authToken = getAuthToken?.() || token || "";
  const headers = useMemo(() => authHeaders(authToken), [authToken]);
  const normalizedCode = String(roomCode || "").toUpperCase();

  const [bubbles, setBubbles] = useState([]);
  const seenRef = useRef(new Map());
  const timersRef = useRef(new Map());
  const channelRef = useRef(null);
  const sequenceRef = useRef(0);

  const showReaction = useCallback((packet = {}) => {
    if (!packet?.emoji || String(packet?.code || "").toUpperCase() !== normalizedCode) return;

    const now = Date.now();
    for (const [key, expiresAt] of seenRef.current.entries()) {
      if (expiresAt <= now) seenRef.current.delete(key);
    }

    const reactionId = String(packet.reactionId || "");
    if (!reactionId || seenRef.current.has(reactionId)) return;
    seenRef.current.set(reactionId, now + 20000);

    const duration = clamp(packet.duration || 3600, 2200, 6000);
    const startedAt = Number(packet.startedAt || now);
    const elapsed = clamp(now - startedAt, 0, duration - 20);
    const bubble = {
      id: reactionId,
      emoji: String(packet.emoji),
      x: clamp(packet.x ?? 50, 5, 95),
      drift: clamp(packet.drift ?? 0, -180, 180),
      scale: clamp(packet.scale ?? 1, 0.78, 1.55),
      duration,
      delay: -elapsed,
    };

    setBubbles((current) => [...current.slice(-159), bubble]);
    const timer = window.setTimeout(() => {
      setBubbles((current) => current.filter((item) => item.id !== reactionId));
      timersRef.current.delete(reactionId);
    }, Math.max(250, duration - elapsed + 500));
    timersRef.current.set(reactionId, timer);
  }, [normalizedCode]);

  useEffect(() => {
    if (!socket || !normalizedCode) return undefined;
    const onReaction = (packet) => showReaction(packet);
    socket.on("room:reaction:v2", onReaction);
    return () => socket.off("room:reaction:v2", onReaction);
  }, [socket, normalizedCode, showReaction]);

  useEffect(() => {
    if (!normalizedCode || typeof window === "undefined" || !("BroadcastChannel" in window)) return undefined;
    const channel = new BroadcastChannel(`${CHANNEL_NAME}:${normalizedCode}`);
    channelRef.current = channel;
    channel.onmessage = (event) => showReaction(event?.data || {});
    return () => {
      try { channel.close(); } catch {}
      if (channelRef.current === channel) channelRef.current = null;
    };
  }, [normalizedCode, showReaction]);

  useEffect(() => () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current.clear();
    seenRef.current.clear();
  }, []);

  const react = useCallback((emoji) => {
    if (!normalizedCode || !authToken || !REACTIONS.includes(emoji)) return;

    sequenceRef.current += 1;
    const packet = {
      code: normalizedCode,
      reactionId: `${viewerId || "member"}-${Date.now()}-${sequenceRef.current}-${Math.random().toString(36).slice(2, 7)}`,
      emoji,
      actorId: viewerId || "",
      startedAt: Date.now(),
      x: 8 + Math.random() * 84,
      drift: -95 + Math.random() * 190,
      scale: 0.88 + Math.random() * 0.38,
      duration: 3100 + Math.floor(Math.random() * 1300),
    };

    // Sender sees it immediately.
    showReaction(packet);

    // Same-device tabs/windows get the exact same bubble instantly.
    try { channelRef.current?.postMessage(packet); } catch {}

    // Every remote member in the same room receives the same V2 packet.
    const post = () => apiClient.post(
      `/api/social/rooms/${normalizedCode}/live-reactions-v2`,
      packet,
      { headers },
    );
    post().catch(() => window.setTimeout(() => post().catch(() => {}), 180));
  }, [authToken, headers, normalizedCode, showReaction, viewerId]);

  if (!normalizedCode) return null;

  return (
    <>
      <div className="sw2414-reaction-layer" aria-hidden="true">
        {bubbles.map((bubble) => (
          <span
            key={bubble.id}
            className="sw2414-reaction-bubble"
            style={{
              left: `${bubble.x}vw`,
              "--sw2414-drift": `${bubble.drift}px`,
              "--sw2414-scale": bubble.scale,
              "--sw2414-duration": `${bubble.duration}ms`,
              animationDelay: `${bubble.delay}ms`,
            }}
          >
            {bubble.emoji}
          </span>
        ))}
      </div>

      <div className="sw2414-reaction-dock" aria-label="Live room reactions">
        {REACTIONS.map((emoji) => (
          <button type="button" key={emoji} onClick={() => react(emoji)} aria-label={`Send ${emoji} reaction`}>
            {emoji}
          </button>
        ))}
      </div>
    </>
  );
};

export default RoomReactionOverlayV2;
