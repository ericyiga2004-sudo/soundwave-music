const ACTIVE_ROOM_SESSION_KEY = "soundwave:active-live-room-session";
const ACTIVE_ROOM_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

const canUseSessionStorage = () =>
  typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";

const normalizeCode = (value = "") => String(value || "").trim().toUpperCase();

export const readActiveLiveRoomSession = () => {
  if (!canUseSessionStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(ACTIVE_ROOM_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const code = normalizeCode(parsed?.code);
    const savedAt = Number(parsed?.savedAt || 0);
    if (!code || !savedAt || Date.now() - savedAt > ACTIVE_ROOM_SESSION_MAX_AGE_MS) {
      window.sessionStorage.removeItem(ACTIVE_ROOM_SESSION_KEY);
      return null;
    }
    return { ...parsed, code };
  } catch {
    return null;
  }
};

export const writeActiveLiveRoomSession = (next = {}) => {
  if (!canUseSessionStorage()) return null;
  try {
    const previous = readActiveLiveRoomSession() || {};
    const code = normalizeCode(next?.code || previous?.code);
    if (!code) return null;
    const merged = {
      ...previous,
      ...next,
      code,
      currentSongId: String(next?.currentSongId ?? previous?.currentSongId ?? next?.currentSong?._id ?? previous?.currentSong?._id ?? ""),
      listenerPaused: Boolean(next?.listenerPaused ?? previous?.listenerPaused ?? false),
      savedAt: Date.now(),
    };
    window.sessionStorage.setItem(ACTIVE_ROOM_SESSION_KEY, JSON.stringify(merged));
    return merged;
  } catch {
    return null;
  }
};

export const clearActiveLiveRoomSession = (expectedCode = "") => {
  if (!canUseSessionStorage()) return;
  try {
    if (expectedCode) {
      const current = readActiveLiveRoomSession();
      if (current?.code && current.code !== normalizeCode(expectedCode)) return;
    }
    window.sessionStorage.removeItem(ACTIVE_ROOM_SESSION_KEY);
  } catch {
    // Session storage restrictions must never break playback.
  }
};

export { ACTIVE_ROOM_SESSION_KEY };
