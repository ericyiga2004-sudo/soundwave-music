import express from "express";
import authUser from "../middleware/authUser.js";

import {
  createPlaylist,
  getUserPlaylists,
  addSongToPlaylist,
  removeSongFromPlaylist,
  deletePlaylist,
} from "../controllers/playlistController.js";

const playlistRouter = express.Router();

playlistRouter.post(
  "/create",
  authUser,
  createPlaylist
);

playlistRouter.get(
  "/get",
  authUser,
  getUserPlaylists
);

playlistRouter.post(
  "/add-song",
  authUser,
  addSongToPlaylist
);

playlistRouter.post(
  "/remove-song",
  authUser,
  removeSongFromPlaylist
);

playlistRouter.post(
  "/delete",
  authUser,
  deletePlaylist
);

export default playlistRouter;