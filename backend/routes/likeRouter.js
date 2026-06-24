import express from "express";
import authUser from "../middleware/authUser.js";

import {
  toggleLikeSong,
  getLikedSongs,
  checkSongLiked,
} from "../controllers/likeController.js";

const likeRouter = express.Router();

likeRouter.post("/toggle/:songId", authUser, toggleLikeSong);

likeRouter.get("/songs", authUser, getLikedSongs);

likeRouter.get("/check/:songId", authUser, checkSongLiked);

export default likeRouter;