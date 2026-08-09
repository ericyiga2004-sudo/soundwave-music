import express from "express";
import "dotenv/config.js";
import cors from "cors";
import path from "path";
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

const port  = process.env.PORT || 4000;
 
const app  = express();

app.use(cors());
app.use(express.json());


connectDB()



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
app.get("/", (req,res)=> {
    res.send("MUSIC API WORKING!!")
});

app.listen(port, ()=> {
    console.log("Server is running on port " + port);
})