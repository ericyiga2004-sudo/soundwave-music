import mongoose from "mongoose";
import Comment from "../models/commentModel.js";
import Song from "../models/uploadSongModel.js";
import User from "../models/userModel.js";
import { createNotificationForUser } from "./notificationController.js";

const serializeComment = (comment, viewerId = "", repliesCount = 0) => {
  const data = typeof comment?.toObject === "function" ? comment.toObject() : comment;
  if (!data) return null;
  const likedBy = Array.isArray(data.likedBy) ? data.likedBy : [];
  const viewer = String(viewerId || "");
  return {
    _id: data._id,
    song: data.song,
    body: data.body,
    parentComment: data.parentComment || null,
    momentAt: Number.isFinite(Number(data.momentAt)) ? Number(data.momentAt) : null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    editedAt: data.editedAt,
    likes: likedBy.length,
    liked: viewer ? likedBy.some((id) => String(id) === viewer) : false,
    canEdit: viewer ? String(data.user?._id || data.user) === viewer : false,
    repliesCount,
    user: data.user
      ? {
          _id: data.user._id,
          username: data.user.username || data.user.name || "SoundWave listener",
          name: data.user.name || data.user.username || "SoundWave listener",
          image: data.user.image || "",
        }
      : null,
  };
};

const populateComment = (query) => query.populate("user", "username name image");

const notifyMentions = async ({ body, fromUser, songId, commentId }) => {
  const names = [...new Set((String(body).match(/@[a-zA-Z0-9_.-]{2,30}/g) || []).map((name) => name.slice(1).toLowerCase()))];
  if (!names.length) return;
  const users = await User.find({ username: { $in: names.map((name) => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")) } }).select("_id username").limit(8);
  await Promise.allSettled(users.filter((u) => String(u._id) !== String(fromUser)).map((u) => createNotificationForUser({
    user: u._id,
    fromUser,
    type: "comment_mention",
    title: "You were mentioned in a music conversation",
    message: String(body).slice(0, 120),
    link: `/song/${songId}#comment-${commentId}`,
    relatedSong: songId,
  })));
};

export const getSongComments = async (req, res) => {
  try {
    const { songId } = req.params;
    if (!mongoose.isValidObjectId(songId)) return res.status(400).json({ success: false, message: "Invalid song id" });
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(30, Math.max(1, Number(req.query.limit || 15)));
    const skip = (page - 1) * limit;
    const sortMode = req.query.sort === "top" ? { createdAt: -1 } : { createdAt: -1 };
    const query = { song: songId, parentComment: null };
    const [comments, total] = await Promise.all([
      populateComment(Comment.find(query).sort(sortMode).skip(skip).limit(limit)),
      Comment.countDocuments(query),
    ]);
    const ids = comments.map((c) => c._id);
    const counts = ids.length ? await Comment.aggregate([
      { $match: { parentComment: { $in: ids } } },
      { $group: { _id: "$parentComment", count: { $sum: 1 } } },
    ]) : [];
    const countMap = new Map(counts.map((row) => [String(row._id), row.count]));
    const output = comments.map((comment) => serializeComment(comment, req.userId, countMap.get(String(comment._id)) || 0));
    if (req.query.sort === "top") output.sort((a, b) => b.likes - a.likes || new Date(b.createdAt) - new Date(a.createdAt));
    return res.json({ success: true, comments: output, total, page, limit, hasMore: skip + comments.length < total });
  } catch (error) {
    console.error("Get comments error:", error);
    return res.status(500).json({ success: false, message: "Could not load comments" });
  }
};

export const getCommentReplies = async (req, res) => {
  try {
    const replies = await populateComment(Comment.find({ parentComment: req.params.commentId }).sort({ createdAt: 1 }).limit(40));
    return res.json({ success: true, replies: replies.map((comment) => serializeComment(comment, req.userId, 0)) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not load replies" });
  }
};

export const createComment = async (req, res) => {
  try {
    const { songId } = req.params;
    const body = String(req.body?.body || "").trim();
    const parentComment = req.body?.parentComment || null;
    const rawMoment = req.body?.momentAt;
    const momentAt = rawMoment === null || rawMoment === undefined || rawMoment === "" ? null : Math.max(0, Number(rawMoment || 0));
    if (!mongoose.isValidObjectId(songId)) return res.status(400).json({ success: false, message: "Invalid song id" });
    if (!body) return res.status(400).json({ success: false, message: "Write a comment first" });
    if (body.length > 600) return res.status(400).json({ success: false, message: "Comments can be up to 600 characters" });
    if (!(await Song.exists({ _id: songId }))) return res.status(404).json({ success: false, message: "Song not found" });

    let parent = null;
    if (parentComment) {
      if (!mongoose.isValidObjectId(parentComment)) return res.status(400).json({ success: false, message: "Invalid reply target" });
      parent = await Comment.findOne({ _id: parentComment, song: songId });
      if (!parent) return res.status(404).json({ success: false, message: "Comment not found" });
    }

    const recentlyCommented = await Comment.exists({ user: req.userId, createdAt: { $gte: new Date(Date.now() - 2500) } });
    if (recentlyCommented) return res.status(429).json({ success: false, message: "Please wait a moment before posting another comment" });

    const comment = await Comment.create({ song: songId, user: req.userId, body, parentComment: parent?._id || null, momentAt: Number.isFinite(momentAt) ? momentAt : null });
    const populated = await populateComment(Comment.findById(comment._id));

    if (parent && String(parent.user) !== String(req.userId)) {
      const actor = await User.findById(req.userId).select("username name").lean();
      const actorName = actor?.username || actor?.name || "Someone";
      await createNotificationForUser({
        user: parent.user,
        fromUser: req.userId,
        type: "comment_reply",
        title: `${actorName} replied to your comment`,
        message: body.slice(0, 120),
        link: `/song/${songId}#comment-${parent._id}`,
        relatedSong: songId,
        dedupeKey: `comment-reply:${comment._id}:${parent.user}`,
      }).catch(() => null);
    }
    notifyMentions({ body, fromUser: req.userId, songId, commentId: comment._id }).catch(() => null);

    return res.status(201).json({ success: true, comment: serializeComment(populated, req.userId, 0) });
  } catch (error) {
    console.error("Create comment error:", error);
    return res.status(500).json({ success: false, message: "Could not post comment" });
  }
};

export const updateComment = async (req, res) => {
  try {
    const body = String(req.body?.body || "").trim();
    if (!body) return res.status(400).json({ success: false, message: "Comment cannot be empty" });
    if (body.length > 600) return res.status(400).json({ success: false, message: "Comments can be up to 600 characters" });
    const comment = await Comment.findOneAndUpdate({ _id: req.params.commentId, user: req.userId }, { $set: { body, editedAt: new Date() } }, { new: true, runValidators: true });
    if (!comment) return res.status(404).json({ success: false, message: "Comment not found" });
    const populated = await populateComment(Comment.findById(comment._id));
    notifyMentions({ body, fromUser: req.userId, songId: comment.song, commentId: comment._id }).catch(() => null);
    return res.json({ success: true, comment: serializeComment(populated, req.userId) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not update comment" });
  }
};

export const deleteComment = async (req, res) => {
  try {
    const deleted = await Comment.findOneAndDelete({ _id: req.params.commentId, user: req.userId });
    if (!deleted) return res.status(404).json({ success: false, message: "Comment not found" });
    await Comment.deleteMany({ parentComment: deleted._id });
    return res.json({ success: true, message: "Comment deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not delete comment" });
  }
};

export const toggleCommentLike = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ success: false, message: "Comment not found" });
    const viewer = String(req.userId);
    const index = comment.likedBy.findIndex((id) => String(id) === viewer);
    let liked = false;
    if (index >= 0) comment.likedBy.splice(index, 1); else { comment.likedBy.push(req.userId); liked = true; }
    await comment.save();

    if (liked && String(comment.user) !== viewer) {
      const actor = await User.findById(req.userId).select("username name").lean();
      const actorName = actor?.username || actor?.name || "Someone";
      await createNotificationForUser({
        user: comment.user,
        fromUser: req.userId,
        type: "comment_like",
        title: `${actorName} liked your comment`,
        message: String(comment.body || "").slice(0, 110),
        link: `/song/${comment.song}#comment-${comment._id}`,
        relatedSong: comment.song,
        dedupeKey: `comment-like:${comment._id}:${req.userId}`,
      }).catch(() => null);
    }

    return res.json({ success: true, liked, likes: comment.likedBy.length });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not update comment like" });
  }
};
