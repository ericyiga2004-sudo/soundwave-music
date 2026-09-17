const clients = new Map();

const keyFor = (userId) => String(userId || "");

const safeWrite = (res, packet) => {
  try {
    res.write(`data: ${JSON.stringify(packet)}\n\n`);
    return true;
  } catch {
    return false;
  }
};

export const emitToUser = (userId, event, payload = {}) => {
  const key = keyFor(userId);
  const set = clients.get(key);
  if (!set?.size || !event) return;

  const packet = { event, payload };
  [...set].forEach((res) => {
    if (!safeWrite(res, packet)) set.delete(res);
  });
  if (!set.size) clients.delete(key);
};

export const emitToUsers = (userIds = [], event, payload = {}) => {
  [...new Set((userIds || []).map(keyFor).filter(Boolean))]
    .forEach((userId) => emitToUser(userId, event, payload));
};

// Only broadcast lightweight realtime packets. Protected payloads still come
// from authenticated routes; presence only contains a user id + online state.
export const emitAll = (event, payload = {}) => {
  if (!event) return;
  [...clients.keys()].forEach((userId) => emitToUser(userId, event, payload));
};

export const isUserOnline = (userId) => Boolean(clients.get(keyFor(userId))?.size);
export const getOnlineUserIds = () => [...clients.entries()].filter(([, set]) => set?.size).map(([userId]) => userId);

export const registerRealtimeClient = (userId, res) => {
  const key = keyFor(userId);
  if (!key) return () => {};

  const wasOnline = isUserOnline(key);
  if (!clients.has(key)) clients.set(key, new Set());
  clients.get(key).add(res);

  safeWrite(res, {
    event: "realtime:ready",
    payload: { at: new Date().toISOString(), online: true },
  });

  if (!wasOnline) {
    queueMicrotask(() => emitAll("presence:update", {
      userId: key,
      online: true,
      at: new Date().toISOString(),
    }));
  }

  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    const set = clients.get(key);
    if (!set) return;
    set.delete(res);
    if (!set.size) {
      clients.delete(key);
      queueMicrotask(() => emitAll("presence:update", {
        userId: key,
        online: false,
        at: new Date().toISOString(),
      }));
    }
  };
};

export const emitSocialRefresh = (userIds = [], reason = "social") => {
  emitToUsers(userIds, "social:refresh", {
    reason,
    at: new Date().toISOString(),
  });
};

export const getRealtimeClientCount = () =>
  [...clients.values()].reduce((total, set) => total + set.size, 0);
