import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { MusicContext } from "../../context/ShopContext";
import { useRealtime } from "../../context/RealtimeContext";
import { apiClient, authHeaders } from "../../config/apiClient";
import "../../pages/CSS/RoomReactionsV3.css";

const REACTIONS = ["❤️", "🔥", "😂", "👏", "🎵", "🙌"];
const SAME_DEVICE_CHANNEL = "soundwave-room-reactions-v3";

const hashString = (value = "") => {
  let hash = 2166136261;
  const input = String(value);
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const motionFor = (reactionId) => {
  const h = hashString(reactionId);
  return {
    left: 10 + (h % 80),
    drift: ((h >>> 8) % 150) - 75,
    duration: 3000 + ((h >>> 16) % 1300),
    rotate: ((h >>> 22) % 28) - 14,
  };
};

const RoomReactionOverlayV3 = ({ roomCode = "", viewerId = "" }) => {
  const { token, getAuthToken } = useContext(MusicContext);
  const { socket } = useRealtime();
  const authToken = getAuthToken?.() || token || "";
  const headers = useMemo(() => authHeaders(authToken), [authToken]);
  const normalizedCode = String(roomCode || "").trim().toUpperCase();

  const [bubbles, setBubbles] = useState([]);
  const seenRef = useRef(new Map());
  const timersRef = useRef(new Map());
  const channelRef = useRef(null);
  const sequenceRef = useRef(0);

  const showReaction = useCallback((packet = {}) => {
    if (!normalizedCode) return;

    const packetCode = String(packet?.code || "").trim().toUpperCase();
    if (packetCode && packetCode !== normalizedCode) return;

    const emoji = String(packet?.emoji || "");
    if (!REACTIONS.includes(emoji)) return;

    const now = Date.now();
    for (const [id, expires] of seenRef.current.entries()) {
      if (expires <= now) seenRef.current.delete(id);
    }

    const reactionId = String(
      packet?.reactionId ||
      `${packet?.actorId || "room"}-${packet?.at || now}-${emoji}`
    );

    if (seenRef.current.has(reactionId)) return;
    seenRef.current.set(reactionId, now + 20000);

    const motion = motionFor(reactionId);
    const bubble = {
      id: reactionId,
      emoji,
      ...motion,
    };

    setBubbles((current) => [...current.slice(-119), bubble]);

    const timer = window.setTimeout(() => {
      setBubbles((current) => current.filter((item) => item.id !== reactionId));
      timersRef.current.delete(reactionId);
    }, motion.duration + 450);

    timersRef.current.set(reactionId, timer);
  }, [normalizedCode]);

  useEffect(() => {
    if (!socket || !normalizedCode) return undefined;

    // IMPORTANT: use the EXISTING deployed room reaction event.
    const onReaction = (packet) => showReaction(packet);
    socket.on("room:reaction", onReaction);

    return () => socket.off("room:reaction", onReaction);
  }, [socket, normalizedCode, showReaction]);

  useEffect(() => {
    if (
      !normalizedCode ||
      typeof window === "undefined" ||
      !("BroadcastChannel" in window)
    ) {
      return undefined;
    }

    const channel = new BroadcastChannel(`${SAME_DEVICE_CHANNEL}:${normalizedCode}`);
    channelRef.current = channel;
    channel.onmessage = (event) => showReaction(event?.data || {});

    return () => {
      try {
        channel.close();
      } catch {}
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
      reactionId: `${viewerId || "member"}-${Date.now()}-${sequenceRef.current}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      emoji,
      actorId: viewerId || "",
      at: new Date().toISOString(),
    };

    // The person who taps sees it immediately.
    showReaction(packet);

    // Other tabs/windows on this same computer see it immediately too.
    try {
      channelRef.current?.postMessage(packet);
    } catch {}

    // Remote room members receive it through the EXISTING Render endpoint.
    // No new backend route is required by V23.15.
    apiClient
      .post(
        `/api/social/rooms/${normalizedCode}/reactions`,
        { emoji, reactionId: packet.reactionId },
        { headers }
      )
      .catch((error) => {
        // Keep local animation intact, but expose transport failures clearly.
        if (import.meta?.env?.DEV) {
          console.warn("[SoundWave room reaction] send failed", error?.response?.status || error);
        }
      });
  }, [authToken, headers, normalizedCode, showReaction, viewerId]);

  if (!normalizedCode) return null;

  return (
    <>
      <div className="sw2515-reaction-overlay" aria-hidden="true">
        {bubbles.map((bubble) => (
          <span
            key={bubble.id}
            className="sw2515-reaction-bubble"
            style={{
              left: `${bubble.left}%`,
              "--sw2515-drift": `${bubble.drift}px`,
              "--sw2515-duration": `${bubble.duration}ms`,
              "--sw2515-rotate": `${bubble.rotate}deg`,
            }}
          >
            {bubble.emoji}
          </span>
        ))}
      </div>

      <div className="sw2515-reaction-controls" aria-label="Live room reactions">
        {REACTIONS.map((emoji) => (
          <button
            type="button"
            key={emoji}
            onClick={() => react(emoji)}
            aria-label={`Send ${emoji} live reaction`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  );
};

export default RoomReactionOverlayV3;
