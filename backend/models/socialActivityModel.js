import mongoose from "mongoose";

const socialActivitySchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, index: true },
    type: {
      type: String,
      enum: [
        "follow",
        "daily_pick",
        "song_moment",
        "circle_song",
        "circle_created",
        "room_created",
        "playlist_share",
      ],
      required: true,
      index: true,
    },
    song: { type: mongoose.Schema.Types.ObjectId, ref: "Song", default: null, index: true },
    targetUser: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
    circle: { type: mongoose.Schema.Types.ObjectId, ref: "Circle", default: null },
    room: { type: mongoose.Schema.Types.ObjectId, ref: "LiveRoom", default: null },
    note: { type: String, default: "", trim: true, maxlength: 240 },
    momentAt: { type: Number, default: null, min: 0 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

socialActivitySchema.index({ actor: 1, createdAt: -1 });
socialActivitySchema.index({ song: 1, createdAt: -1 });
socialActivitySchema.index({ circle: 1, createdAt: -1 });
socialActivitySchema.index({ type: 1, createdAt: -1 });

export default mongoose.models.SocialActivity || mongoose.model("SocialActivity", socialActivitySchema);
