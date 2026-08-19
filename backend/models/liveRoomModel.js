import mongoose from "mongoose";

const roomMemberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const roomLiveReactionSchema = new mongoose.Schema(
  {
    reactionId: { type: String, required: true },
    emoji: { type: String, required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const roomQueueSchema = new mongoose.Schema(
  {
    song: { type: mongoose.Schema.Types.ObjectId, ref: "Song", required: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    votes: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
    played: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const roomReactionSchema = new mongoose.Schema(
  {
    emoji: { type: String, required: true, trim: true, maxlength: 8 },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
  },
  { _id: false }
);

const roomChatSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    body: { type: String, required: true, trim: true, maxlength: 280 },
    reactions: { type: [roomReactionSchema], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const liveRoomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 70 },
    host: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, index: true },
    code: { type: String, required: true, unique: true, index: true },
    members: { type: [roomMemberSchema], default: [] },
    invitedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
    queue: { type: [roomQueueSchema], default: [] },
    liveReactions: { type: [roomLiveReactionSchema], default: [] },
    chat: { type: [roomChatSchema], default: [] },
    currentSong: { type: mongoose.Schema.Types.ObjectId, ref: "Song", default: null },
    currentStartedAt: { type: Date, default: null },
    playbackState: { type: String, enum: ["playing", "paused"], default: "paused" },
    playbackPosition: { type: Number, default: 0, min: 0 },
    playbackStartedAt: { type: Date, default: null },
    playbackVersion: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["active", "ended"], default: "active", index: true },
    lastActiveAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

liveRoomSchema.index({ "members.user": 1, status: 1, updatedAt: -1 });
liveRoomSchema.index({ invitedUsers: 1, status: 1, updatedAt: -1 });

export default mongoose.models.LiveRoom || mongoose.model("LiveRoom", liveRoomSchema);
