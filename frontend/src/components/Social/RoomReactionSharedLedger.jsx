import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { MusicContext } from "../../context/ShopContext";
import { useRealtime } from "../../context/RealtimeContext";
import { apiClient, authHeaders } from "../../config/apiClient";
import { ChevronDown, Heart } from "lucide-react";
import "../../pages/CSS/RoomReactionsSharedLedger.css";

const EMOJIS = ["❤️", "🔥", "😂", "👏", "🎵", "🙌"];
const POLL_MS = 650;
const VISIBLE_MS = 4200;
const SEEN_MS = 30000;

const hashString = (value = "") => {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const motionFor = (reactionId = "") => {
  const hash = hashString(reactionId);
  return {
    left: 8 + (hash % 84),
    drift: ((hash >>> 8) % 190) - 95,
    rotate: ((hash >>> 19) % 38) - 19,
    scale: 0.94 + ((hash >>> 25) % 20) / 100,
  };
};

const normalizePacket = (packet = {}, fallbackCode = "") => {
  const code = String(packet?.code || fallbackCode || "").trim().toUpperCase();
  const emoji = String(packet?.emoji || "");
  const reactionId = String(packet?.reactionId || "");
  if (!code || !reactionId || !EMOJIS.includes(emoji)) return null;

  const createdAtMs = Date.parse(packet?.createdAt || packet?.at || "");
  return {
    ...packet,
    code,
    emoji,
    reactionId,
    createdAtMs: Number.isFinite(createdAtMs) ? createdAtMs : Date.now(),
  };
};

const RoomReactionSharedLedger = ({ roomCode = "", viewerId = "" }) => {
  const { token, getAuthToken } = useContext(MusicContext);
  const { socket } = useRealtime();
  const authToken = getAuthToken?.() || token || "";
  const headers = useMemo(() => authHeaders(authToken), [authToken]);
  const code = String(roomCode || "").trim().toUpperCase();

  const layerRef = useRef(null);
  const seenRef = useRef(new Map());
  const pollBusyRef = useRef(false);
  const sequenceRef = useRef(0);
  const [sendError, setSendError] = useState("");
  const [expanded, setExpanded] = useState(false);

  const alreadySeen = useCallback((reactionId) => {
    const now = Date.now();
    for (const [id, expires] of seenRef.current.entries()) {
      if (expires <= now) seenRef.current.delete(id);
    }
    if (seenRef.current.has(reactionId)) return true;
    seenRef.current.set(reactionId, now + SEEN_MS);
    return false;
  }, []);

  const draw = useCallback((rawPacket = {}, { forceNow = false } = {}) => {
    const packet = normalizePacket(rawPacket, code);
    if (!packet || packet.code !== code || alreadySeen(packet.reactionId)) return false;

    const layer = layerRef.current;
    if (!layer) {
      seenRef.current.delete(packet.reactionId);
      return false;
    }

    const elapsed = forceNow ? 0 : Math.max(0, Date.now() - packet.createdAtMs);
    if (elapsed >= VISIBLE_MS - 100) return false;

    const motion = motionFor(packet.reactionId);
    const bubble = document.createElement("span");
    bubble.className = "sw2317-shared-reaction-bubble";
    bubble.textContent = packet.emoji;
    bubble.style.left = `${motion.left}%`;
    bubble.setAttribute("data-reaction-id", packet.reactionId);
    layer.appendChild(bubble);

    const animation = bubble.animate(
      [
        { opacity: 0, transform: "translate3d(0, 16px, 0) scale(.78) rotate(0deg)", offset: 0 },
        { opacity: 1, transform: "translate3d(0, 0, 0) scale(1) rotate(0deg)", offset: 0.08 },
        { opacity: 1, offset: 0.72 },
        {
          opacity: 0,
          transform: `translate3d(${motion.drift}px, -84vh, 0) scale(${motion.scale}) rotate(${motion.rotate}deg)`,
          offset: 1,
        },
      ],
      {
        duration: VISIBLE_MS,
        easing: "cubic-bezier(.16,.78,.22,1)",
        fill: "forwards",
      }
    );

    if (!forceNow && elapsed > 0) {
      try { animation.currentTime = Math.min(elapsed, VISIBLE_MS - 120); } catch {}
    }

    animation.onfinish = () => bubble.remove();
    animation.oncancel = () => bubble.remove();
    return true;
  }, [alreadySeen, code]);

  // Instant lane. Helpful when healthy, but NOT required for correctness.
  useEffect(() => {
    if (!socket || !code) return undefined;
    const onReaction = (packet) => draw(packet);
    socket.on("room:reaction", onReaction);
    return () => socket.off("room:reaction", onReaction);
  }, [socket, code, draw]);

  // Correctness lane. Every room member reads the exact same MongoDB-backed
  // reaction ledger. No sender/receiver branching and no host special case.
  const reconcile = useCallback(async () => {
    if (!code || !authToken || pollBusyRef.current || document.visibilityState !== "visible") return;
    pollBusyRef.current = true;
    try {
      const { data } = await apiClient.get(`/api/social/rooms/${code}/reactions/recent`, {
        headers,
        params: { _: Date.now() },
      });
      (data?.reactions || []).forEach((packet) => draw(packet));
    } catch {
      // Do not interrupt the room UI. A later poll retries automatically.
    } finally {
      pollBusyRef.current = false;
    }
  }, [authToken, code, draw, headers]);

  useEffect(() => {
    if (!code || !authToken) return undefined;
    reconcile();
    const timer = window.setInterval(reconcile, POLL_MS);
    const wake = () => document.visibilityState === "visible" && reconcile();
    window.addEventListener("focus", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [authToken, code, reconcile]);

  useEffect(() => () => {
    layerRef.current?.replaceChildren?.();
    seenRef.current.clear();
  }, []);

  const react = useCallback(async (emoji) => {
    if (!code || !EMOJIS.includes(emoji)) return;

    sequenceRef.current += 1;
    const reactionId = `${viewerId || "member"}-${Date.now()}-${sequenceRef.current}-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 10)}`.replace(/\s+/g, "");

    const localPacket = {
      code,
      reactionId,
      emoji,
      actorId: viewerId || "",
      createdAt: new Date().toISOString(),
    };

    // GUARANTEE #1: the person who presses always sees their own reaction now.
    // This is direct DOM animation and does not wait for React state, SSE,
    // Render, polling or another user.
    draw(localPacket, { forceNow: true });
    setSendError("");

    if (!authToken) {
      setSendError("Reconnect to send reactions to the room.");
      return;
    }

    try {
      const { data } = await apiClient.post(
        `/api/social/rooms/${code}/reactions`,
        { emoji, reactionId },
        { headers }
      );
      if (data?.reaction) draw(data.reaction);
      // Pull the shared ledger immediately as a second confirmation path.
      reconcile();
    } catch (error) {
      setSendError(error?.response?.data?.message || "Reaction could not reach the room.");
    }
  }, [authToken, code, draw, headers, reconcile, viewerId]);

  if (!code) return null;

  return (
    <>
      <div ref={layerRef} className="sw2317-shared-reaction-layer" aria-hidden="true" />

      <div className={`sw2318-reaction-shell ${expanded ? "is-expanded" : ""}`} aria-label="Live room reactions">
        {expanded ? (
          <div className="sw2318-reaction-options" role="group" aria-label="Choose a live reaction">
            {EMOJIS.map((emoji) => (
              <button
                type="button"
                key={emoji}
                className="sw2318-reaction-option"
                onClick={() => react(emoji)}
                aria-label={`Send ${emoji} to everyone in the room`}
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : null}

        <button
          type="button"
          className={`sw2318-reaction-toggle ${expanded ? "is-expanded" : ""}`}
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse live reactions" : "Open live reactions"}
          title={expanded ? "Collapse reactions" : "Live reactions"}
        >
          {expanded ? <ChevronDown size={20} strokeWidth={2.3} /> : <Heart size={21} strokeWidth={2.2} />}
        </button>
      </div>

      {sendError ? <div className="sw2317-shared-reaction-error" role="status">{sendError}</div> : null}
    </>
  );
};

export default RoomReactionSharedLedger;
