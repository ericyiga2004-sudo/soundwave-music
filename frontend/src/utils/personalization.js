import { API_BASE_URL } from "../config/api";
import { getLowData, getPersonalizationEnabled } from "./uiPreferences";

const MAX_BATCH = 12;
const BASE_FLUSH_MS = 18000;
let queue = [];
let timer = null;
let lastRefreshDispatch = 0;
const cooldowns = new Map();

const getToken = () => {
  if (typeof window === "undefined") return "";
  const token = String(localStorage.getItem("token") || "").trim();
  return ["", "false", "null", "undefined", "none"].includes(token.toLowerCase()) ? "" : token;
};

const flushDelay = () => (getLowData() ? 45000 : BASE_FLUSH_MS);

export const flushTasteEvents = async ({ keepalive = false } = {}) => {
  if (!getPersonalizationEnabled()) { queue = []; return; }
  if (!queue.length) return;
  const token = getToken();
  if (!token) { queue = []; return; }

  const events = queue.splice(0, 30);
  try {
    const response = await fetch(`${API_BASE_URL}/api/personalization/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token },
      body: JSON.stringify({ events }),
      keepalive,
    });
    if (!response.ok && response.status !== 401) {
      queue.unshift(...events.slice(-MAX_BATCH));
    } else if (response.ok) {
      // Refresh recommendation sections sparingly. Re-fetching every card after
      // every listening signal would waste mobile data and battery.
      const now = Date.now();
      if (!getLowData() && now - lastRefreshDispatch > 120000) {
        lastRefreshDispatch = now;
        window.dispatchEvent(new Event("soundwave-personalization-updated"));
      }
    }
  } catch {
    // Personalization should never interrupt playback. Keep only a tiny retry set.
    queue.unshift(...events.slice(-Math.min(4, events.length)));
  }
};

const scheduleFlush = () => {
  if (timer || typeof window === "undefined") return;
  timer = window.setTimeout(() => {
    timer = null;
    flushTasteEvents();
  }, flushDelay());
};

export const trackTasteEvent = (type, payload = {}, options = {}) => {
  if (typeof window === "undefined" || !getToken() || !getPersonalizationEnabled()) return;
  const id = payload.songId || payload.artistId || payload.albumId || "global";
  const cooldownKey = `${type}:${id}`;
  const cooldownMs = Number(options.cooldownMs ?? 12000);
  const last = Number(cooldowns.get(cooldownKey) || 0);
  const now = Date.now();
  if (cooldownMs > 0 && now - last < cooldownMs) return;
  cooldowns.set(cooldownKey, now);

  queue.push({ type, ...payload });
  if (queue.length >= MAX_BATCH) flushTasteEvents();
  else scheduleFlush();
};

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => flushTasteEvents({ keepalive: true }));
  window.addEventListener("online", () => { if (queue.length) flushTasteEvents(); });
}
