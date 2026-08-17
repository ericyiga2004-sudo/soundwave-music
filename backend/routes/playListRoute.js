import express from "express";
import authUser from "../middleware/authUser.js";

import {
  createPlaylist,
  getUserPlaylists,
  addSongToPlaylist,
  removeSongFromPlaylist,
  deletePlaylist,
  searchUsersForPlaylistShare,
  sharePlaylistToUser,
  getReceivedPlaylistShares,
  getSentPlaylistShares,
  markPlaylistShareRead,
  removeReceivedPlaylistShare,
  revokePlaylistShare,
  getPlaylistById,
  updatePlaylist,
  recordPlaylistPlay,
} from "../controllers/playlistController.js";

const playlistRouter = express.Router();

playlistRouter.post("/create", authUser, createPlaylist);

playlistRouter.get("/get", authUser, getUserPlaylists);

playlistRouter.post("/add-song", authUser, addSongToPlaylist);

playlistRouter.post("/remove-song", authUser, removeSongFromPlaylist);

playlistRouter.post("/delete", authUser, deletePlaylist);

playlistRouter.get("/share/users/search", authUser, searchUsersForPlaylistShare);

playlistRouter.post("/share/send", authUser, sharePlaylistToUser);

playlistRouter.get("/share/received", authUser, getReceivedPlaylistShares);

playlistRouter.get("/share/sent", authUser, getSentPlaylistShares);

playlistRouter.post("/share/:shareId/read", authUser, markPlaylistShareRead);

playlistRouter.post(
  "/share/:shareId/remove",
  authUser,
  removeReceivedPlaylistShare
);

playlistRouter.post("/share/:shareId/revoke", authUser, revokePlaylistShare);

playlistRouter.get("/:playlistId", authUser, getPlaylistById);
playlistRouter.patch("/:playlistId", authUser, updatePlaylist);
playlistRouter.post("/:playlistId/play", authUser, recordPlaylistPlay);

export default playlistRouter;