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
        "song_shared",
        "new_song_for_you",
        "artist_new_song",
        "liked_playlist",
        "system_update",
        "user_followed",
        "song_moment",
        "song_moment_like",
        "comment_reply",
        "comment_like",
        "comment_mention",
        "circle_invite",
        "circle_activity",
        "daily_pick",
        "room_invite",
        "live_started",
        "live_chat",
        "replay_for_you",
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

    // The moment this notification most recently became relevant to the user.
    // Unlike createdAt, this moves forward when a deduped notification is
    // reused, so a genuinely new event never gets stranded at the bottom.
    eventAt: {
      type: Date,
      default: Date.now,
      index: true,
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
  eventAt: -1,
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