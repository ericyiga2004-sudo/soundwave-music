import express from "express";
import admin from "../config/firebaseAdmin.js";
import NotificationToken from "../models/NotificationToken.js";

const notificationRouter = express.Router();

notificationRouter.post("/register-token", async (req, res) => {
  try {
    const { token, platform = "android", appId = "com.eric.soundwave" } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Notification token is required.",
      });
    }

    const savedToken = await NotificationToken.findOneAndUpdate(
      { token },
      {
        token,
        platform,
        appId,
        isActive: true,
        lastSeenAt: new Date(),
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    res.json({
      success: true,
      message: "Notification token saved.",
      tokenId: savedToken._id,
    });
  } catch (error) {
    console.error("Register notification token error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to register notification token.",
    });
  }
});

notificationRouter.post("/send", async (req, res) => {
  try {
    const {
      title,
      body,
      url = "/",
      platform = "all",
      adminSecret,
    } = req.body;

    if (adminSecret !== process.env.ADMIN_NOTIFICATION_SECRET) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        message: "Title and body are required.",
      });
    }

    const query = {
      isActive: true,
    };

    if (platform !== "all") {
      query.platform = platform;
    }

    const savedTokens = await NotificationToken.find(query).select("token");

    if (!savedTokens.length) {
      return res.json({
        success: true,
        message: "No active notification tokens found.",
        sent: 0,
      });
    }

    const tokens = savedTokens.map((item) => item.token);

    const message = {
      notification: {
        title,
        body,
      },
      data: {
        url,
      },
      tokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    const failedTokens = [];

    response.responses.forEach((item, index) => {
      if (!item.success) {
        failedTokens.push(tokens[index]);
      }
    });

    if (failedTokens.length) {
      await NotificationToken.updateMany(
        { token: { $in: failedTokens } },
        { isActive: false }
      );
    }

    res.json({
      success: true,
      message: "Notification sent.",
      sent: response.successCount,
      failed: response.failureCount,
    });
  } catch (error) {
    console.error("Send notification error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to send notification.",
    });
  }
});

export default notificationRouter;