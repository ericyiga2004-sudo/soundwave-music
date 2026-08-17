import express from "express";

import {

  deleteNotification,
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  registerNotificationToken,
  unregisterNotificationToken,
} from "../controllers/notificationController.js";
import authUser from "../middleware/authUser.js";
import optionalAuthUser from "../middleware/optionalAuthUser.js";

const notificationRouter = express.Router();

notificationRouter.post("/register-token", optionalAuthUser, registerNotificationToken);
notificationRouter.post("/unregister-token", optionalAuthUser, unregisterNotificationToken);

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