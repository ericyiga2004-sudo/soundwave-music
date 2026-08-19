import LiveRoom from "../models/liveRoomModel.js";
import User from "../models/userModel.js";
import { emitToUsers } from "../utils/realtimeHub.js";
import { getRecentRoomReactions, publishRoomReaction } from "../utils/roomReactionBuffer.js";

const id = (value) => String(value?._id || value || "");
const memberOfRoom = (room, userId) =>
  id(room?.host) === id(userId) || (room?.members || []).some((member) => id(member?.user) === id(userId));

const ALLOWED = new Set(["❤️", "🔥", "😂", "👏", "🎵", "🙌"]);

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

    const room = await LiveRoom.findOne({ code, status: "active" }).select("code host members");
    if (!room || !memberOfRoom(room, req.userId)) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }

    const actor = await User.findById(req.userId).select("username name").lean();
    const packet = publishRoomReaction({
      code: room.code,
      reactionId,
      emoji,
      actorId: id(req.userId),
      actorName: actor?.username || actor?.name || "Listener",
    });

    const memberIds = [room.host, ...(room.members || []).map((member) => member.user)];

    // SSE is the instant lane. The short-lived room buffer exposed below is the
    // replay/fallback lane, so a temporarily stale SSE connection cannot lose a reaction.
    emitToUsers(memberIds, "room:reaction", packet);

    return res.status(202).json({ success: true, reaction: packet });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not send room reaction" });
  }
};

export const listReliableRoomReactions = async (req, res) => {
  try {
    const code = String(req.params.code || "").trim().toUpperCase();
    const room = await LiveRoom.findOne({ code, status: "active" }).select("code host members");
    if (!room || !memberOfRoom(room, req.userId)) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }

    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    return res.json({
      success: true,
      serverTime: new Date().toISOString(),
      reactions: getRecentRoomReactions(room.code),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not read room reactions" });
  }
};
