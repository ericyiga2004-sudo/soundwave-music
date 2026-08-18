import Notification from "../models/notificationModel.js";
import User from "../models/userModel.js";
import NotificationToken from "../models/NotificationToken.js";
import { emitToUser } from "../utils/realtimeHub.js";

const maskEmail = (email = "") => {
  if (!email || !email.includes("@")) return "";

  const [name, domain] = email.split("@");

  const visibleName =
    name.length <= 2 ? `${name[0] || ""}*` : `${name.slice(0, 2)}***`;

  return `${visibleName}@${domain}`;
};

const cleanNotification = (notification) => {
  if (!notification) return null;

  const data =
    typeof notification.toObject === "function"
      ? notification.toObject()
      : notification;

  if (data.fromUser) {
    data.fromUser = {
      _id: data.fromUser._id,
      username: data.fromUser.username || data.fromUser.name || "SoundWave User",
      name: data.fromUser.name || data.fromUser.username || "SoundWave User",
      maskedEmail: maskEmail(data.fromUser.email || ""),
      image: data.fromUser.image || "",
    };
  }

  return data;
};

const populateNotification = (query) => {
  return query
    .populate({
      path: "fromUser",
      model: User,
      select: "username name email image",
    })
    .populate({
      path: "relatedPlaylist",
      select: "name description imageUrl",
    })
    .populate({
      path: "relatedShare",
      select: "message readAt status",
    })
    .populate({
      path: "relatedSong",
      select: "title audioUrl image imageUrl coverImage genre mood songLanguage releaseYear duration artist album featuredArtists",
      populate: [
        { path: "artist", select: "name image" },
        { path: "album", select: "title image imageUrl coverImage" },
        { path: "featuredArtists", select: "name image" },
      ],
    });
};

export const createNotificationForUser = async ({
  user,
  fromUser = null,
  type,
  title,
  message = "",
  link = "",
  relatedPlaylist = null,
  relatedShare = null,
  relatedSong = null,
  dedupeKey = "",
}) => {
  if (!user || !type || !title) return null;

  const now = new Date();

  const payload = {
    user,
    fromUser,
    type,
    title,
    message,
    link,
    relatedPlaylist,
    relatedShare,
    relatedSong,
    dedupeKey,
    status: "active",
    isRead: false,
    readAt: null,
    eventAt: now,
  };

  let saved;
  if (dedupeKey) {
    saved = await Notification.findOneAndUpdate(
      { user, dedupeKey },
      { $set: payload },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  } else {
    saved = await Notification.create(payload);
  }

  // Send a lightweight wake-up packet immediately after persistence. The
  // recipient can reconcile from /api/notifications even if enriching the
  // full notification payload fails for any reason.
  emitToUser(user, "notification:poke", {
    notificationId: String(saved._id),
    type,
    eventAt: now.toISOString(),
  });

  try {
    const populated = await populateNotification(Notification.findById(saved._id));
    const clean = cleanNotification(populated);
    const unreadCount = await Notification.countDocuments({
      user,
      status: "active",
      isRead: false,
    });
    if (!clean) return saved;
    clean.unreadCount = unreadCount;
    emitToUser(user, "notification:new", clean);
    emitToUser(user, "social:refresh", {
      reason: type,
      at: new Date().toISOString(),
    });
  } catch (error) {
    console.warn("Realtime notification emit skipped:", error?.message || error);
  }

  return saved;
};

export const getNotifications = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;

    const notifications = await populateNotification(
      Notification.find({
        user: req.userId,
        status: "active",
      })
        .sort({ eventAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
    );

    const unreadCount = await Notification.countDocuments({
      user: req.userId,
      status: "active",
      isRead: false,
    });

    return res.json({
      success: true,
      notifications: notifications.map(cleanNotification),
      unreadCount,
      page,
      limit,
      hasMore: notifications.length === limit,
    });
  } catch (error) {
    console.log("Get notifications error:", error);

    return res.json({
      success: false,
      message: error.message,
    });
  }
};

export const getUnreadNotificationCount = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    const unreadCount = await Notification.countDocuments({
      user: req.userId,
      status: "active",
      isRead: false,
    });

    return res.json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    console.log("Get unread notifications error:", error);

    return res.json({
      success: false,
      message: error.message,
    });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findOneAndUpdate(
      {
        _id: notificationId,
        user: req.userId,
        status: "active",
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      },
      {
        new: true,
      }
    );

    if (!notification) {
      return res.json({
        success: false,
        message: "Notification not found",
      });
    }

    emitToUser(req.userId, "notification:update", { reason: "read", notificationId: String(notification._id), at: new Date().toISOString() });
    return res.json({
      success: true,
      message: "Notification marked as read",
      notification,
    });
  } catch (error) {
    console.log("Mark notification read error:", error);

    return res.json({
      success: false,
      message: error.message,
    });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      {
        user: req.userId,
        status: "active",
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      }
    );

    emitToUser(req.userId, "notification:update", { reason: "read_all", at: new Date().toISOString() });
    return res.json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    console.log("Mark all notifications read error:", error);

    return res.json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findOneAndUpdate(
      {
        _id: notificationId,
        user: req.userId,
        status: "active",
      },
      {
        $set: {
          status: "deleted",
          isRead: true,
          readAt: new Date(),
        },
      },
      {
        new: true,
      }
    );

    if (!notification) {
      return res.json({
        success: false,
        message: "Notification not found",
      });
    }

    emitToUser(req.userId, "notification:update", { reason: "deleted", notificationId: String(notification._id), at: new Date().toISOString() });
    return res.json({
      success: true,
      message: "Notification removed",
    });
  } catch (error) {
    console.log("Delete notification error:", error);

    return res.json({
      success: false,
      message: error.message,
    });
  }
};

export const registerNotificationToken = async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();
    const platform = ["android", "ios", "web", "desktop"].includes(req.body?.platform)
      ? req.body.platform
      : "android";
    const appId = String(req.body?.appId || "com.eric.soundwave").trim();

    if (!token) {
      return res.status(400).json({ success: false, message: "Notification token is required" });
    }

    const saved = await NotificationToken.findOneAndUpdate(
      { token },
      {
        $set: {
          token,
          platform,
          appId,
          user: req.userId || null,
          isActive: true,
          lastSeenAt: new Date(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.json({ success: true, tokenId: saved._id });
  } catch (error) {
    console.error("Register notification token error:", error);
    return res.status(500).json({ success: false, message: "Could not register notification token" });
  }
};

export const unregisterNotificationToken = async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();
    if (!token) return res.status(400).json({ success: false, message: "Notification token is required" });

    await NotificationToken.findOneAndUpdate(
      { token },
      { $set: { isActive: false, lastSeenAt: new Date() } }
    );

    return res.json({ success: true });
  } catch (error) {
    console.error("Unregister notification token error:", error);
    return res.status(500).json({ success: false, message: "Could not unregister notification token" });
  }
};
