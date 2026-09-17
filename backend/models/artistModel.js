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

    source: { type: String, default: "soundwave", index: true },
    externalSource: { type: String, default: undefined, index: true },
    externalId: { type: String, default: undefined, trim: true },
    isExternal: { type: Boolean, default: false, index: true },
    handle: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

artistSchema.index({ externalSource: 1, externalId: 1 }, { unique: true, partialFilterExpression: { externalSource: "audius", externalId: { $type: "string" } } });

export default mongoose.model("Artist", artistSchema);