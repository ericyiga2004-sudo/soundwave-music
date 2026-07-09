import mongoose from "mongoose";

const MAX_PLAYLIST_SONGS = 50;

const playlistSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    songs: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Song",
        },
      ],
      default: [],
      validate: {
        validator: function (songs) {
          return songs.length <= MAX_PLAYLIST_SONGS;
        },
        message: `Playlist can only contain ${MAX_PLAYLIST_SONGS} songs or less`,
      },
    },

    imageUrl: {
      type: String,
      default: "",
    },

    sharesCount: {
      type: Number,
      default: 0,
    },

    plays: {
      type: Number,
      default: 0,
    },

    saves: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

playlistSchema.index({ user: 1, createdAt: -1 });

const Playlist =
  mongoose.models.Playlist || mongoose.model("Playlist", playlistSchema);

export default Playlist;