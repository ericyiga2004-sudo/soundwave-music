import mongoose from "mongoose";

const scoredNameSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    score: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const scoredYearSchema = new mongoose.Schema(
  {
    year: Number,
    score: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const scoredArtistSchema = new mongoose.Schema(
  {
    artist: { type: mongoose.Schema.Types.ObjectId, ref: "Artist" },
    score: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const scoredAlbumSchema = new mongoose.Schema(
  {
    album: { type: mongoose.Schema.Types.ObjectId, ref: "Album" },
    score: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const scoredSongSchema = new mongoose.Schema(
  {
    song: { type: mongoose.Schema.Types.ObjectId, ref: "Song" },
    score: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },

    // Kept for compatibility with older SoundWave accounts/controllers.
    name: { type: String, default: "" },
    image: { type: String, default: "" },
    favoriteGenres: { type: [String], default: [] },
    favoriteMoods: { type: [String], default: [] },
    favoriteArtists: [{ type: mongoose.Schema.Types.ObjectId, ref: "Artist" }],

    bio: { type: String, default: "", trim: true, maxlength: 180 },
    followingUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
    socialSettings: {
      publicProfile: { type: Boolean, default: true },
      listeningActivity: { type: Boolean, default: false },
      allowTasteMatch: { type: Boolean, default: true },
    },

    likedSongs: [{ type: mongoose.Schema.Types.ObjectId, ref: "Song" }],
    followedArtists: [{ type: mongoose.Schema.Types.ObjectId, ref: "Artist" }],

    // Compact preference vectors. We intentionally store aggregates rather than
    // a large raw event log, keeping MongoDB documents, RAM and mobile data small.
    preferences: {
      countries: { type: [scoredNameSchema], default: [] },
      genres: { type: [scoredNameSchema], default: [] },
      moods: { type: [scoredNameSchema], default: [] },
      languages: { type: [scoredNameSchema], default: [] },
      years: { type: [scoredYearSchema], default: [] },
      artists: { type: [scoredArtistSchema], default: [] },
      albums: { type: [scoredAlbumSchema], default: [] },
      songs: { type: [scoredSongSchema], default: [] },
      algorithmVersion: { type: Number, default: 2 },
      lastPersonalizedAt: { type: Date, default: null },
    },

    location: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      accuracy: { type: Number, default: null },
      updatedAt: { type: Date, default: null },
    },

    history: [
      {
        song: { type: mongoose.Schema.Types.ObjectId, ref: "Song" },
        playedAt: { type: Date, default: Date.now },
      },
    ],

    // Lightweight cadence state for occasional "play this again" reminders.
    // This is deliberately sparse and event-driven; no background cron is
    // required and existing accounts need no migration.
    notificationCadence: {
      replayNextAt: { type: Date, default: null },
      replayLastAt: { type: Date, default: null },
      replayLastSong: { type: mongoose.Schema.Types.ObjectId, ref: "Song", default: null },
    },
  },
  { timestamps: true }
);

userSchema.index({ followedArtists: 1 });
userSchema.index({ likedSongs: 1 });
userSchema.index({ followingUsers: 1 });
userSchema.index({ followers: 1 });

const User = mongoose.models.user || mongoose.model("user", userSchema);
export default User;
