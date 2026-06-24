import mongoose from "mongoose";

const albumSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    artist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artist",
      required: true,
    },

    coverImage: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      default: "",
    },

    releaseDate: {
      type: Date,
      default: Date.now,
    },

    totalPlays: {
      type: Number,
      default: 0,
    },

    songs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Song",
      },
    ],
  },
  {
    timestamps: true,
  }
);

albumSchema.index({ title: "text" });

export default mongoose.model("Album", albumSchema);