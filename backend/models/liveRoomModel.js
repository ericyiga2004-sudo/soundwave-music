import mongoose from "mongoose";

const roomMemberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    joinedAt: { type: Date, default: Date.now },
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

const liveRoomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 70 },
    host: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, index: true },
    code: { type: String, required: true, unique: true, index: true },
    members: { type: [roomMemberSchema], default: [] },
    queue: { type: [roomQueueSchema], default: [] },
    currentSong: { type: mongoose.Schema.Types.ObjectId, ref: "Song", default: null },
    currentStartedAt: { type: Date, default: null },
    status: { type: String, enum: ["active", "ended"], default: "active", index: true },
    lastActiveAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

liveRoomSchema.index({ "members.user": 1, status: 1, updatedAt: -1 });

export default mongoose.models.LiveRoom || mongoose.model("LiveRoom", liveRoomSchema);
