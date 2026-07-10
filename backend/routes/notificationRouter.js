import express from "express";

import {

  deleteNotification,
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "../controllers/notificationController.js";
import authUser from "../middleware/authUser.js";

const notificationRouter = express.Router();

notificationRouter.get("/", authUser, getNotifications);
notificationRouter.get("/unread-count", authUser, getUnreadNotificationCount);

notificationRouter.post(
  "/:notificationId/read",
  authUser,
  markNotificationRead
);

notificationRouter.post("/read-all", authUser, markAllNotificationsRead);

notificationRouter.delete(
  "/:notificationId",
  authUser,
  deleteNotification
);

export default notificationRouter;