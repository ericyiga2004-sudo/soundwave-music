import mongoose from "mongoose";

const monthlyStatsSchema = new mongoose.Schema(
  {
    month: {
      type: String,
      required: true,
      // Example: "2026-06"
    },

    plays: {
      type: Number,
      default: 0,
      min: 0,
    },

    likes: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const syncedWordSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
    },

    start: {
      type: Number,
      required: true,
      min: 0,
    },

    end: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const syncedLyricLineSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
    },

    start: {
      type: Number,
      required: true,
      min: 0,
    },

    end: {
      type: Number,
      default: null,
      min: 0,
    },

    words: {
      type: [syncedWordSchema],
      default: [],
    },
  },
  { _id: false }
);

const songSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    artist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artist",
      required: true,
      index: true,
    },

    featuredArtists: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Artist",
      },
    ],

    album: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Album",
      required: true,
      index: true,
    },

    audioUrl: {
      type: String,
      required: true,
    },

    imageUrl: {
      type: String,
      required: true,
    },

    genre: {
      type: String,
      default: "Unknown",
      trim: true,
      index: true,
    },

    tags: {
      type: [String],
      default: [],
      index: true,
    },

    mood: {
      type: String,
      default: "Unknown",
      trim: true,
      index: true,
    },

    // Safe replacement for old "language" field.
    // Admin still sees/selects Language, but MongoDB stores it as songLanguage.
    songLanguage: {
      type: String,
      default: "Unknown",
      trim: true,
      index: true,
    },

    country: {
      type: String,
      default: "Unknown",
      trim: true,
      index: true,
    },

    releaseDate: {
      type: Date,
    },

    releaseYear: {
      type: Number,
      index: true,
    },

    duration: {
      type: Number,
      default: 0,
      min: 0,
    },

    lyrics: {
      type: String,
      default: "",
    },

    lrcLyrics: {
      type: String,
      default: "",
    },

    syncedLyrics: {
      type: [syncedLyricLineSchema],
      default: [],
    },

    plays: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },

    likes: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },

    monthlyStats: {
      type: [monthlyStatsSchema],
      default: [],
    },

    featured: {
      type: Boolean,
      default: false,
      index: true,
    },
    
    isTopTen: {
      type: Boolean,
      default: false,
      index: true,
    },
    
    topTenRank: {
      type: Number,
      min: 1,
      max: 10,
      default: null,
      index: true,
    },
    
    explicit: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: ["published", "draft"],
      default: "published",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Automatically set releaseYear from releaseDate before saving
songSchema.pre("save", function () {
  if (!this.releaseYear && this.releaseDate) {
    const parsedDate = new Date(this.releaseDate);

    if (!Number.isNaN(parsedDate.getTime())) {
      this.releaseYear = parsedDate.getFullYear();
    }
  }
});

// Text search index
// We use songLanguage instead of language to avoid MongoDB text-index language errors.
songSchema.index(
  {
    title: "text",
    genre: "text",
    tags: "text",
    mood: "text",
    songLanguage: "text",
    country: "text",
  },
  {
    default_language: "none",
    name: "song_text_search_index",
  }
);

// Sorting/filtering indexes
songSchema.index({ createdAt: -1 });
songSchema.index({ releaseYear: -1 });
songSchema.index({ releaseDate: -1 });
songSchema.index({ country: 1, plays: -1 });
songSchema.index({ country: 1, likes: -1 });
songSchema.index({ genre: 1, plays: -1 });
songSchema.index({ mood: 1, plays: -1 });
songSchema.index({ songLanguage: 1, plays: -1 });
songSchema.index({ featuredArtists: 1 });
songSchema.index({ "monthlyStats.month": 1 });

// Status-aware indexes
songSchema.index({ status: 1, createdAt: -1 });
songSchema.index({ status: 1, country: 1, plays: -1 });
songSchema.index({ status: 1, songLanguage: 1, plays: -1 });
songSchema.index({ status: 1, releaseYear: -1 });
songSchema.index({ status: 1, country: 1, isTopTen: 1, topTenRank: 1 });

export default mongoose.models.Song || mongoose.model("Song", songSchema);