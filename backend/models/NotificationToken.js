import mongoose from "mongoose";

const notificationTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
      index: true,
    },

    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    platform: {
      type: String,
      enum: ["android", "ios", "web", "desktop"],
      default: "android",
    },

    appId: {
      type: String,
      default: "com.eric.soundwave",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const NotificationToken =
  mongoose.models.NotificationToken ||
  mongoose.model("NotificationToken", notificationTokenSchema);

export default NotificationToken;