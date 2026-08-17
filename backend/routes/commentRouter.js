import express from "express";
import authUser from "../middleware/authUser.js";
import optionalAuthUser from "../middleware/optionalAuthUser.js";
import {
  createComment,
  deleteComment,
  getSongComments,
  toggleCommentLike,
  updateComment,
} from "../controllers/commentController.js";

const commentRouter = express.Router();

commentRouter.get("/song/:songId", optionalAuthUser, getSongComments);
commentRouter.post("/song/:songId", authUser, createComment);
commentRouter.patch("/:commentId", authUser, updateComment);
commentRouter.delete("/:commentId", authUser, deleteComment);
commentRouter.post("/:commentId/like", authUser, toggleCommentLike);

export default commentRouter;
