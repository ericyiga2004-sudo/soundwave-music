import mongoose from "mongoose";

const artistSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    image: {
      type: String,
      required: true,
    },

    bio: {
      type: String,
      default: "",
    },

    country: {
      type: String,
      default: "Unknown",
      trim: true,
    },

    verified: {
      type: Boolean,
      default: false,
    },

    followers: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Artist", artistSchema);