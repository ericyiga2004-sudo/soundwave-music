import express from "express";
import authUser from "../middleware/authUser.js";
import optionalAuthUser from "../middleware/optionalAuthUser.js";
import {
  addCircleSong,
  addLiveRoomSong,
  advanceLiveRoom,
  buildFriendMix,
  createCircle,
  createLiveRoom,
  createSongMoment,
  getCircle,
  getDailyPicks,
  getDiscoveryTrail,
  getLiveRoom,
  getPublicProfile,
  getSocialHome,
  getSongMoments,
  getTasteMatch,
  joinCircle,
  joinLiveRoom,
  leaveCircle,
  listCircles,
  replySongMoment,
  toggleSongMomentReplyLike,
  postLiveRoomChat,
  playLiveRoomQueueEntry,
  reactLiveRoomChat,
  sendLiveRoomReaction,
  searchUsers,
  shareSongDirect,
  setDailyPick,
  toggleFollowUser,
  toggleSongMomentLike,
  updateLiveRoomPlayback,
  updateSocialProfile,
  voteLiveRoomSong,
} from "../controllers/socialController.js";

const router = express.Router();

router.get("/home", authUser, getSocialHome);
router.get("/users/search", authUser, searchUsers);
router.get("/users/:userId", optionalAuthUser, getPublicProfile);
router.patch("/profile", authUser, updateSocialProfile);
router.post("/users/:userId/follow", authUser, toggleFollowUser);
router.get("/users/:userId/match", authUser, getTasteMatch);

router.get("/daily", authUser, getDailyPicks);
router.post("/daily", authUser, setDailyPick);
router.post("/friend-mix", authUser, buildFriendMix);
router.post(["/share-song", "/share", "/songs/share"], authUser, shareSongDirect);

router.get("/circles", authUser, listCircles);
router.post("/circles", authUser, createCircle);
router.post("/circles/join", authUser, joinCircle);
router.get("/circles/:circleId", authUser, getCircle);
router.post("/circles/:circleId/leave", authUser, leaveCircle);
router.post("/circles/:circleId/songs", authUser, addCircleSong);

router.get("/moments/song/:songId", optionalAuthUser, getSongMoments);
router.post("/moments/song/:songId", authUser, createSongMoment);
router.post("/moments/:momentId/like", authUser, toggleSongMomentLike);
router.post("/moments/:momentId/replies", authUser, replySongMoment);
router.post("/moments/:momentId/replies/:replyId/like", authUser, toggleSongMomentReplyLike);
router.get("/trail/:songId", authUser, getDiscoveryTrail);

router.post("/rooms", authUser, createLiveRoom);
router.post("/rooms/join", authUser, joinLiveRoom);
router.get("/rooms/:code", authUser, getLiveRoom);
router.post("/rooms/:code/queue", authUser, addLiveRoomSong);
router.post("/rooms/:code/queue/:entryId/vote", authUser, voteLiveRoomSong);
router.post("/rooms/:code/queue/:entryId/play", authUser, playLiveRoomQueueEntry);
router.post("/rooms/:code/advance", authUser, advanceLiveRoom);
router.post("/rooms/:code/playback", authUser, updateLiveRoomPlayback);
router.post("/rooms/:code/chat", authUser, postLiveRoomChat);
router.post("/rooms/:code/chat/:messageId/react", authUser, reactLiveRoomChat);
router.post("/rooms/:code/reactions", authUser, sendLiveRoomReaction);

export default router;
