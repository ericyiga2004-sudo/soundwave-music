import mongoose from "mongoose";

const replySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    body: { type: String, required: true, trim: true, maxlength: 300 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const songMomentSchema = new mongoose.Schema(
  {
    song: { type: mongoose.Schema.Types.ObjectId, ref: "Song", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, index: true },
    momentAt: { type: Number, required: true, min: 0, index: true },
    body: { type: String, default: "", trim: true, maxlength: 320 },
    emoji: { type: String, default: "🎵", trim: true, maxlength: 12 },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
    replies: { type: [replySchema], default: [] },
  },
  { timestamps: true }
);

songMomentSchema.index({ song: 1, momentAt: 1, createdAt: -1 });

export default mongoose.models.SongMoment || mongoose.model("SongMoment", songMomentSchema);
