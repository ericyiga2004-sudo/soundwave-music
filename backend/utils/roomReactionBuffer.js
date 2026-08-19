const rooms = new Map();
const TTL_MS = 12000;
const MAX_PER_ROOM = 180;
let sequenceCounter = 0;

const cleanCode = (value) => String(value || "").trim().toUpperCase();
const nowMs = () => Date.now();

const prune = (code, at = nowMs()) => {
  const key = cleanCode(code);
  const state = rooms.get(key);
  if (!state) return [];

  state.items = state.items
    .filter((item) => at - Number(item.serverAtMs || 0) <= TTL_MS)
    .slice(-MAX_PER_ROOM);

  if (!state.items.length && at - state.lastTouchedAt > TTL_MS * 2) {
    rooms.delete(key);
    return [];
  }

  state.lastTouchedAt = at;
  return state.items;
};

export const publishRoomReaction = ({ code, reactionId, emoji, actorId = "", actorName = "" }) => {
  const key = cleanCode(code);
  if (!key) return null;

  const at = nowMs();
  sequenceCounter = (sequenceCounter + 1) % 1000;
  const serverSeq = at * 1000 + sequenceCounter;

  const packet = {
    code: key,
    reactionId: String(reactionId || `${actorId || "room"}-${serverSeq}`),
    emoji: String(emoji || ""),
    actorId: String(actorId || ""),
    actorName: String(actorName || "Listener"),
    serverSeq,
    serverAtMs: at,
    at: new Date(at).toISOString(),
  };

  const state = rooms.get(key) || { items: [], lastTouchedAt: at };
  state.items.push(packet);
  state.lastTouchedAt = at;
  rooms.set(key, state);
  prune(key, at);
  return packet;
};

export const getRecentRoomReactions = (code) => {
  const key = cleanCode(code);
  if (!key) return [];
  return [...prune(key, nowMs())];
};

export const __resetRoomReactionBufferForTests = () => {
  rooms.clear();
  sequenceCounter = 0;
};
