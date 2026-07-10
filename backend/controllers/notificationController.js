import Notification from "../models/notificationModel.js";
import User from "../models/userModel.js";

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
    };
  }

  return data;
};

const populateNotification = (query) => {
  return query
    .populate({
      path: "fromUser",
      model: User,
      select: "username name email",
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
      select: "title image imageUrl coverImage",
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
  };

  if (dedupeKey) {
    return Notification.findOneAndUpdate(
      {
        user,
        dedupeKey,
      },
      {
        $set: payload,
      },
      {
        new: true,
        upsert: true,
      }
    );
  }

  return Notification.create(payload);
};

export const getNotifications = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;

    const notifications = await populateNotification(
      Notification.find({
        user: req.userId,
        status: "active",
      })
        .sort({ createdAt: -1 })
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