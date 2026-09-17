import LiveRoom from "../models/liveRoomModel.js";
import User from "../models/userModel.js";
import { emitToUsers } from "../utils/realtimeHub.js";

const id = (value) => String(value?._id || value || "");
const memberOfRoom = (room, userId) =>
  id(room?.host) === id(userId) ||
  (room?.members || []).some((member) => id(member?.user) === id(userId));

const clamp = (value, min, max, fallback) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
};

const ALLOWED = new Set(["❤️", "🔥", "😂", "👏", "🎵", "🙌"]);

export const sendLiveRoomReactionV2 = async (req, res) => {
  try {
    const code = String(req.params.code || "").trim().toUpperCase();
    const emoji = String(req.body?.emoji || "").trim();

    if (!code || !ALLOWED.has(emoji)) {
      return res.status(400).json({ success: false, message: "Unsupported room reaction" });
    }

    const room = await LiveRoom.findOne({ code, status: "active" });
    if (!room || !memberOfRoom(room, req.userId)) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }

    const actor = await User.findById(req.userId).select("username name image").lean();
    const startedAtRaw = Number(req.body?.startedAt || Date.now());
    const startedAt = Number.isFinite(startedAtRaw) && Math.abs(Date.now() - startedAtRaw) < 30000
      ? startedAtRaw
      : Date.now();

    const packet = {
      code: room.code,
      reactionId: String(req.body?.reactionId || `${id(req.userId)}-${Date.now()}`).slice(0, 120),
      emoji,
      actorId: id(req.userId),
      actorName: actor?.username || actor?.name || "Listener",
      x: clamp(req.body?.x, 5, 95, 50),
      drift: clamp(req.body?.drift, -180, 180, 0),
      scale: clamp(req.body?.scale, 0.78, 1.55, 1),
      duration: clamp(req.body?.duration, 2200, 6000, 3600),
      startedAt,
      serverAt: Date.now(),
    };

    const memberIds = [room.host, ...(room.members || []).map((member) => member.user)];

    // Fresh V2 transport. It does not touch playback, voting, chat or room:update.
    emitToUsers(memberIds, "room:reaction:v2", packet);

    return res.status(202).json({ success: true, reaction: packet });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not send live room reaction" });
  }
};
