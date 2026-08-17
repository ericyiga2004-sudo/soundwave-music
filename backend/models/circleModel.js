import mongoose from "mongoose";

const circleMemberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    role: { type: String, enum: ["owner", "member"], default: "member" },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const circleSongSchema = new mongoose.Schema(
  {
    song: { type: mongoose.Schema.Types.ObjectId, ref: "Song", required: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    note: { type: String, default: "", trim: true, maxlength: 220 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const circleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, default: "", trim: true, maxlength: 220 },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, index: true },
    members: { type: [circleMemberSchema], default: [] },
    songs: { type: [circleSongSchema], default: [] },
    inviteCode: { type: String, required: true, unique: true, index: true },
    isPrivate: { type: Boolean, default: true },
  },
  { timestamps: true }
);

circleSchema.index({ "members.user": 1, updatedAt: -1 });

export default mongoose.models.Circle || mongoose.model("Circle", circleSchema);
