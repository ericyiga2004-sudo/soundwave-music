import express from "express";
import "dotenv/config.js";
import cors from "cors";
import connectDB from "./config/mongoDB.js";
import songRoutes from "./routes/uploadSongRouter.js";
import artistRoutes from "./routes/artistRouter.js";
import albumRoutes from "./routes/albumRouter.js";
import userRouter from "./routes/userRouter.js";
import historyRouter from "./routes/historyRouter.js";
import playlistRouter from "./routes/playListRoute.js";
import likeRouter from "./routes/likeRouter.js";
import recommendationRouter from "./routes/recommendationRoute.js";
import notificationRouter from "./routes/notificationRouter.js";
import orbitIntegrationRouter from "./routes/orbitIntegrationRouter.js";
import commentRouter from "./routes/commentRouter.js";
import personalizationRouter from "./routes/personalizationRouter.js";
import socialRouter from "./routes/socialRouter.js";

const port  = process.env.PORT || 4000;
 
const app  = express();

app.use(cors());
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

// Public catalog reads can be reused briefly by browsers/CDNs. This reduces
// repeated mobile data without making personalized routes stale.
app.use((req, res, next) => {
  if (req.method === "GET" && ["/api/songs", "/api/artists", "/api/albums"].some((prefix) => req.path.startsWith(prefix))) {
    res.set("Cache-Control", "public, max-age=20, stale-while-revalidate=60");
  }
  next();
});


app.use("/api/songs", songRoutes)
app.use("/api/artists", artistRoutes);
app.use("/api/albums", albumRoutes);
app.use(
  "/api/user",
  userRouter
);
app.use("/api/notifications", notificationRouter);


app.use(
  "/api/history",
  historyRouter
)

app.use(
  "/api/recommend",
  recommendationRouter
);

app.use("/api/likes", likeRouter);
app.use("/api/playlist", playlistRouter);
app.use("/api/integrations/orbit", orbitIntegrationRouter);
app.use("/api/comments", commentRouter);
app.use("/api/personalization", personalizationRouter);
app.use("/api/social", socialRouter);
app.get("/api/health", (_req, res) => {
  res.json({ success: true, service: "soundwave-api", status: "ok" });
});

app.get("/", (_req,res)=> {
    res.send("MUSIC API WORKING!!")
});

app.use("/api", (_req, res) => {
  res.status(404).json({ success: false, message: "API route not found" });
});

const startServer = async () => {
  await connectDB();
  app.listen(port, () => {
    console.log("Server is running on port " + port);
  });
};

startServer().catch((error) => {
  console.error("SoundWave API failed to start:", error?.message || error);
  process.exitCode = 1;
});