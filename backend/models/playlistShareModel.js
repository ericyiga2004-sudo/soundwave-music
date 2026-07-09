import mongoose from "mongoose";

const playlistShareSchema = new mongoose.Schema(
  {
    playlist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Playlist",
      required: true,
    },

    fromUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    toUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    message: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },

    status: {
      type: String,
      enum: ["active", "removed", "revoked"],
      default: "active",
    },

    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

playlistShareSchema.index(
  {
    playlist: 1,
    fromUser: 1,
    toUser: 1,
  },
  {
    unique: true,
  }
);

playlistShareSchema.index({
  toUser: 1,
  status: 1,
  createdAt: -1,
});

playlistShareSchema.index({
  fromUser: 1,
  status: 1,
  createdAt: -1,
});

const PlaylistShare =
  mongoose.models.PlaylistShare ||
  mongoose.model("PlaylistShare", playlistShareSchema);

export default PlaylistShare;