import LiveRoom from "../models/liveRoomModel.js";
import User from "../models/userModel.js";
import { emitToUsers } from "../utils/realtimeHub.js";

const id = (value) => String(value?._id || value || "");
const memberOfRoom = (room, userId) =>
  id(room?.host) === id(userId) || (room?.members || []).some((member) => id(member?.user) === id(userId));

const ALLOWED = new Set(["❤️", "🔥", "😂", "👏", "🎵", "🙌"]);
const MAX_LEDGER = 120;
const RECENT_MS = 12000;

const packetFrom = (roomCode, item = {}, actorName = "Listener") => ({
  code: String(roomCode || "").toUpperCase(),
  reactionId: String(item.reactionId || ""),
  emoji: String(item.emoji || ""),
  actorId: id(item.actor),
  actorName,
  createdAt: new Date(item.createdAt || Date.now()).toISOString(),
  at: new Date(item.createdAt || Date.now()).toISOString(),
});

export const sendReliableRoomReaction = async (req, res) => {
  try {
    const code = String(req.params.code || "").trim().toUpperCase();
    const emoji = String(req.body?.emoji || "").trim();
    const reactionId = String(
      req.body?.reactionId || `${id(req.userId)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    ).trim().slice(0, 120);

    if (!ALLOWED.has(emoji)) {
      return res.status(400).json({ success: false, message: "Unsupported reaction" });
    }

    const room = await LiveRoom.findOne({ code, status: "active" }).select("code host members liveReactions");
    if (!room || !memberOfRoom(room, req.userId)) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }

    const actor = await User.findById(req.userId).select("username name").lean();
    const now = new Date();

    const existing = (room.liveReactions || []).find((item) => String(item.reactionId) === reactionId);
    if (existing) {
      return res.status(202).json({
        success: true,
        reaction: packetFrom(room.code, existing, actor?.username || actor?.name || "Listener"),
      });
    }

    const entry = { reactionId, emoji, actor: req.userId, createdAt: now };

    // MongoDB is the shared room truth. SSE is only a speed optimization.
    // $push + $slice avoids host/listener race conditions when several people
    // react rapidly at the same time.
    await LiveRoom.updateOne(
      { _id: room._id, "liveReactions.reactionId": { $ne: reactionId } },
      {
        $push: { liveReactions: { $each: [entry], $slice: -MAX_LEDGER } },
        $set: { lastActiveAt: now },
      }
    );

    const packet = packetFrom(room.code, entry, actor?.username || actor?.name || "Listener");
    const memberIds = [room.host, ...(room.members || []).map((member) => member.user)];
    emitToUsers(memberIds, "room:reaction", packet);

    return res.status(202).json({ success: true, reaction: packet });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not send room reaction" });
  }
};

export const listReliableRoomReactions = async (req, res) => {
  try {
    const code = String(req.params.code || "").trim().toUpperCase();
    const room = await LiveRoom.findOne({ code, status: "active" })
      .select("code host members liveReactions")
      .lean();

    if (!room || !memberOfRoom(room, req.userId)) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }

    const cutoff = Date.now() - RECENT_MS;
    const reactions = (room.liveReactions || [])
      .filter((item) => new Date(item.createdAt || 0).getTime() >= cutoff)
      .map((item) => packetFrom(room.code, item))
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    return res.json({
      success: true,
      serverTime: new Date().toISOString(),
      reactions,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not read room reactions" });
  }
};
