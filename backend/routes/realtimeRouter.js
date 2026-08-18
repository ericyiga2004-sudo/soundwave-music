import express from "express";
import authUser from "../middleware/authUser.js";
import { registerRealtimeClient } from "../utils/realtimeHub.js";

const router = express.Router();

router.get("/stream", authUser, (req, res) => {
  res.status(200);
  res.set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();

  const unregister = registerRealtimeClient(req.userId, res);
  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch {
      clearInterval(heartbeat);
      unregister();
    }
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unregister();
  });
});

export default router;
