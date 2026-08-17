import mongoose from "mongoose";

const dailyPickSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, index: true },
    song: { type: mongoose.Schema.Types.ObjectId, ref: "Song", required: true },
    dayKey: { type: String, required: true, index: true },
    note: { type: String, default: "", trim: true, maxlength: 180 },
  },
  { timestamps: true }
);

dailyPickSchema.index({ user: 1, dayKey: 1 }, { unique: true });
dailyPickSchema.index({ dayKey: 1, createdAt: -1 });

export default mongoose.models.DailyPick || mongoose.model("DailyPick", dailyPickSchema);
