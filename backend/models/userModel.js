/* import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    password: {
      type: String,
      required: true,
    },

    likedSongs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Song",
      },
    ],

    history: [
      {
        song: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Song",
        },

        playedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const User =
  mongoose.models.user ||
  mongoose.model("user", userSchema);

export default User; */


import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    password: {
      type: String,
      required: true,
    },

    // Songs the user has liked
    likedSongs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Song",
      },
    ],

    // Learned favorite genres
    favoriteGenres: {
      type: [String],
      default: [],
    },

    // Learned favorite moods
    favoriteMoods: {
      type: [String],
      default: [],
    },

    // Learned favorite artists
    favoriteArtists: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Artist",
      },
    ],

    // Listening history
    history: [
      {
        song: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Song",
        },

        playedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const User =
  mongoose.models.user ||
  mongoose.model("user", userSchema);

export default User;