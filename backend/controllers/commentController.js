import mongoose from "mongoose";
import Comment from "../models/commentModel.js";
import Song from "../models/uploadSongModel.js";

const serializeComment = (comment, viewerId = "") => {
  const data = typeof comment?.toObject === "function" ? comment.toObject() : comment;
  if (!data) return null;

  const likedBy = Array.isArray(data.likedBy) ? data.likedBy : [];
  const viewer = String(viewerId || "");

  return {
    _id: data._id,
    song: data.song,
    body: data.body,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    editedAt: data.editedAt,
    likes: likedBy.length,
    liked: viewer ? likedBy.some((id) => String(id) === viewer) : false,
    canEdit: viewer ? String(data.user?._id || data.user) === viewer : false,
    user: data.user
      ? {
          _id: data.user._id,
          username: data.user.username || data.user.name || "SoundWave listener",
          name: data.user.name || data.user.username || "SoundWave listener",
        }
      : null,
  };
};

const populateComment = (query) => query.populate("user", "username name");

export const getSongComments = async (req, res) => {
  try {
    const { songId } = req.params;
    if (!mongoose.isValidObjectId(songId)) {
      return res.status(400).json({ success: false, message: "Invalid song id" });
    }

    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(30, Math.max(1, Number(req.query.limit || 15)));
    const skip = (page - 1) * limit;

    const [comments, total] = await Promise.all([
      populateComment(
        Comment.find({ song: songId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
      ),
      Comment.countDocuments({ song: songId }),
    ]);

    return res.json({
      success: true,
      comments: comments.map((comment) => serializeComment(comment, req.userId)),
      total,
      page,
      limit,
      hasMore: skip + comments.length < total,
    });
  } catch (error) {
    console.error("Get comments error:", error);
    return res.status(500).json({ success: false, message: "Could not load comments" });
  }
};

export const createComment = async (req, res) => {
  try {
    const { songId } = req.params;
    const body = String(req.body?.body || "").trim();

    if (!mongoose.isValidObjectId(songId)) {
      return res.status(400).json({ success: false, message: "Invalid song id" });
    }
    if (!body) {
      return res.status(400).json({ success: false, message: "Write a comment first" });
    }
    if (body.length > 600) {
      return res.status(400).json({ success: false, message: "Comments can be up to 600 characters" });
    }

    const songExists = await Song.exists({ _id: songId });
    if (!songExists) {
      return res.status(404).json({ success: false, message: "Song not found" });
    }

    // Lightweight anti-spam guard without keeping an in-memory timer map.
    // The database check works across multiple server instances and uses almost no RAM.
    const recentlyCommented = await Comment.exists({
      user: req.userId,
      createdAt: { $gte: new Date(Date.now() - 3000) },
    });
    if (recentlyCommented) {
      return res.status(429).json({
        success: false,
        message: "Please wait a moment before posting another comment",
      });
    }

    const comment = await Comment.create({ song: songId, user: req.userId, body });
    const populated = await populateComment(Comment.findById(comment._id));

    return res.status(201).json({
      success: true,
      comment: serializeComment(populated, req.userId),
    });
  } catch (error) {
    console.error("Create comment error:", error);
    return res.status(500).json({ success: false, message: "Could not post comment" });
  }
};

export const updateComment = async (req, res) => {
  try {
    const body = String(req.body?.body || "").trim();
    if (!body) return res.status(400).json({ success: false, message: "Comment cannot be empty" });
    if (body.length > 600) {
      return res.status(400).json({ success: false, message: "Comments can be up to 600 characters" });
    }

    const comment = await Comment.findOneAndUpdate(
      { _id: req.params.commentId, user: req.userId },
      { $set: { body, editedAt: new Date() } },
      { new: true, runValidators: true }
    );

    if (!comment) {
      return res.status(404).json({ success: false, message: "Comment not found" });
    }

    const populated = await populateComment(Comment.findById(comment._id));
    return res.json({ success: true, comment: serializeComment(populated, req.userId) });
  } catch (error) {
    console.error("Update comment error:", error);
    return res.status(500).json({ success: false, message: "Could not update comment" });
  }
};

export const deleteComment = async (req, res) => {
  try {
    const deleted = await Comment.findOneAndDelete({
      _id: req.params.commentId,
      user: req.userId,
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Comment not found" });
    }

    return res.json({ success: true, message: "Comment deleted" });
  } catch (error) {
    console.error("Delete comment error:", error);
    return res.status(500).json({ success: false, message: "Could not delete comment" });
  }
};

export const toggleCommentLike = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: "Comment not found" });
    }

    const viewer = String(req.userId);
    const index = comment.likedBy.findIndex((id) => String(id) === viewer);
    let liked = false;

    if (index >= 0) {
      comment.likedBy.splice(index, 1);
    } else {
      comment.likedBy.push(req.userId);
      liked = true;
    }

    await comment.save();
    return res.json({ success: true, liked, likes: comment.likedBy.length });
  } catch (error) {
    console.error("Like comment error:", error);
    return res.status(500).json({ success: false, message: "Could not update comment like" });
  }
};
