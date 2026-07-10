import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },

    fromUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },

    type: {
      type: String,
      enum: [
        "playlist_shared",
        "new_song_for_you",
        "artist_new_song",
        "liked_playlist",
        "system_update",
      ],
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      default: "",
      trim: true,
    },

    link: {
      type: String,
      default: "",
      trim: true,
    },

    relatedPlaylist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Playlist",
      default: null,
    },

    relatedShare: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PlaylistShare",
      default: null,
    },

    relatedSong: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Song",
      default: null,
    },

    dedupeKey: {
      type: String,
      default: "",
      index: true,
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    readAt: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["active", "deleted"],
      default: "active",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({
  user: 1,
  status: 1,
  isRead: 1,
  createdAt: -1,
});

notificationSchema.index(
  {
    user: 1,
    dedupeKey: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      dedupeKey: {
        $type: "string",
        $gt: "",
      },
    },
  }
);

const Notification =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);

export default Notification;