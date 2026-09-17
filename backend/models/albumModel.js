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

    source: { type: String, default: "soundwave", index: true },
    externalSource: { type: String, default: undefined, index: true },
    externalId: { type: String, default: undefined, trim: true },
    isExternal: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
  }
);

albumSchema.index({ title: "text" });
albumSchema.index({ externalSource: 1, externalId: 1 }, { unique: true, partialFilterExpression: { externalSource: "audius", externalId: { $type: "string" } } });

export default mongoose.model("Album", albumSchema);