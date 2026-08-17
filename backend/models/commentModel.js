import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    song: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Song",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 600,
    },
    likedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
      },
    ],
    editedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

commentSchema.index({ song: 1, createdAt: -1 });
commentSchema.index({ song: 1, user: 1, createdAt: -1 });
commentSchema.index({ user: 1, createdAt: -1 });

export default mongoose.models.Comment || mongoose.model("Comment", commentSchema);
