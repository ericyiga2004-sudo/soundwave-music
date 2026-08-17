import mongoose from "mongoose";
import Song from "../models/uploadSongModel.js";
import Artist from "../models/artistModel.js";
import Album from "../models/albumModel.js";

const populateSong = (query) => {
  return query
    .populate("artist")
    .populate("featuredArtists")
    .populate("album");
};

const normalizeArray = (value, lowercase = false) => {
  if (!value) return [];

  const items = Array.isArray(value)
    ? value
    : String(value)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

  return lowercase
    ? items.map((item) => String(item).trim().toLowerCase()).filter(Boolean)
    : items.map((item) => String(item).trim()).filter(Boolean);
};

const escapeRegex = (value) => {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const safeParseJSON = (value, fallback = null) => {
  if (!value) return fallback;

  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizeSyncedLyrics = (value) => {
  const parsed = safeParseJSON(value, []);

  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((line) => {
      const text = String(line?.text || "").trim();
      const start = Number(line?.start);

      const end =
        line?.end === null || line?.end === undefined || line?.end === ""
          ? null
          : Number(line.end);

      if (!text || !Number.isFinite(start) || start < 0) {
        return null;
      }

      const words = Array.isArray(line?.words)
        ? line.words
            .map((word) => {
              const wordText = String(word?.text || "").trim();
              const wordStart = Number(word?.start);
              const wordEnd = Number(word?.end);

              if (
                !wordText ||
                !Number.isFinite(wordStart) ||
                !Number.isFinite(wordEnd) ||
                wordStart < 0 ||
                wordEnd < wordStart
              ) {
                return null;
              }

              return {
                text: wordText,
                start: wordStart,
                end: wordEnd,
              };
            })
            .filter(Boolean)
        : [];

      return {
        text,
        start,
        end: Number.isFinite(end) && end >= start ? end : null,
        words,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);
};

const extendSearchWithRelatedMatches = async (query, searchValue) => {
  const value = String(searchValue || "").trim();
  if (!value) return query;

  const safe = escapeRegex(value);
  const [artists, albums] = await Promise.all([
    Artist.find({ name: { $regex: safe, $options: "i" } }).select("_id").limit(40),
    Album.find({ title: { $regex: safe, $options: "i" } }).select("_id").limit(40),
  ]);

  const artistIds = artists.map((item) => item._id);
  const albumIds = albums.map((item) => item._id);
  const additions = [];

  if (artistIds.length) {
    additions.push({ artist: { $in: artistIds } });
    additions.push({ featuredArtists: { $in: artistIds } });
  }
  if (albumIds.length) additions.push({ album: { $in: albumIds } });

  if (additions.length) query.$or = [...(query.$or || []), ...additions];
  return query;
};

const getCurrentMonthKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
};

const getSortOption = (sort = "newest") => {
  if (sort === "oldest") {
    return {
      releaseYear: 1,
      createdAt: 1,
    };
  }

  if (sort === "popular") {
    return {
      plays: -1,
      likes: -1,
    };
  }

  if (sort === "liked") {
    return {
      likes: -1,
      plays: -1,
    };
  }

  if (sort === "az") {
    return {
      title: 1,
    };
  }

  if (sort === "za") {
    return {
      title: -1,
    };
  }

  if (sort === "year-desc") {
    return {
      releaseYear: -1,
      createdAt: -1,
    };
  }

  if (sort === "year-asc") {
    return {
      releaseYear: 1,
      createdAt: 1,
    };
  }

  return {
    createdAt: -1,
  };
};

const buildSongFilterQuery = (filters = {}) => {
  const {
    search,
    q,
    genre,
    tag,
    mood,
    language,
    country,
    year,
    fromYear,
    toYear,
    artist,
    album,
    featured,
    explicit,
    status,
  } = filters;

  const query = {};

  if (status) {
    query.status = status;
  } else {
    query.status = "published";
  }

  const searchValue = search || q;

  if (searchValue) {
    const safeSearch = escapeRegex(searchValue);

    query.$or = [
      {
        title: {
          $regex: safeSearch,
          $options: "i",
        },
      },
      {
        genre: {
          $regex: safeSearch,
          $options: "i",
        },
      },
      {
        tags: {
          $in: [new RegExp(safeSearch, "i")],
        },
      },
      {
        mood: {
          $regex: safeSearch,
          $options: "i",
        },
      },
      {
        songLanguage: {
          $regex: safeSearch,
          $options: "i",
        },
      },
      {
        country: {
          $regex: safeSearch,
          $options: "i",
        },
      },
    ];
  }

  if (genre) {
    query.genre = new RegExp(`^${escapeRegex(genre)}$`, "i");
  }

  if (tag) {
    query.tags = {
      $in: [new RegExp(`^${escapeRegex(tag)}$`, "i")],
    };
  }

  if (mood) {
    query.mood = new RegExp(`^${escapeRegex(mood)}$`, "i");
  }

  if (language) {
    query.songLanguage = new RegExp(`^${escapeRegex(language)}$`, "i");
  }

  if (country) {
    query.country = new RegExp(`^${escapeRegex(country)}$`, "i");
  }

  if (year) {
    query.releaseYear = Number(year);
  }

  if (fromYear || toYear) {
    query.releaseYear = {};

    if (fromYear) {
      query.releaseYear.$gte = Number(fromYear);
    }

    if (toYear) {
      query.releaseYear.$lte = Number(toYear);
    }
  }

  if (artist && mongoose.Types.ObjectId.isValid(artist)) {
    query.$and = query.$and || [];

    query.$and.push({
      $or: [
        {
          artist,
        },
        {
          featuredArtists: artist,
        },
      ],
    });
  }

  if (album && mongoose.Types.ObjectId.isValid(album)) {
    query.album = album;
  }

  if (featured !== undefined) {
    query.featured = featured === "true" || featured === true;
  }

  if (explicit !== undefined) {
    query.explicit = explicit === "true" || explicit === true;
  }

  return query;
};

// =========================
// Upload Song
// =========================
export const uploadSong = async (req, res) => {
  try {
    const {
      title,
      artist,
      album,
      genre,
      tags,
      mood,
      songLanguage,
      language,
      country,
      releaseDate,
      releaseYear,
      duration,
      lyrics,
      lrcLyrics,
      syncedLyrics,
      featured,
      explicit,
      status,
      featuredArtists,
    } = req.body;

    const audioFile = req.files?.audio?.[0];
    const imageFile = req.files?.image?.[0];

    if (!title?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Title required",
      });
    }

    if (!artist) {
      return res.status(400).json({
        success: false,
        message: "Artist required",
      });
    }

    if (!album) {
      return res.status(400).json({
        success: false,
        message: "Album required",
      });
    }

    if (!audioFile) {
      return res.status(400).json({
        success: false,
        message: "Audio required",
      });
    }

    if (!imageFile) {
      return res.status(400).json({
        success: false,
        message: "Image required",
      });
    }

    const artistExists = await Artist.findById(artist);
    const albumExists = await Album.findById(album);

    if (!artistExists) {
      return res.status(404).json({
        success: false,
        message: "Artist not found",
      });
    }

    if (!albumExists) {
      return res.status(404).json({
        success: false,
        message: "Album not found",
      });
    }

    if (albumExists.artist.toString() !== artist.toString()) {
      return res.status(400).json({
        success: false,
        message: "This album does not belong to the selected artist",
      });
    }

    const parsedFeaturedArtists = normalizeArray(featuredArtists).filter((id) =>
      mongoose.Types.ObjectId.isValid(id)
    );

    if (parsedFeaturedArtists.length > 0) {
      const foundFeaturedArtists = await Artist.find({
        _id: {
          $in: parsedFeaturedArtists,
        },
      }).select("_id");

      if (foundFeaturedArtists.length !== parsedFeaturedArtists.length) {
        return res.status(404).json({
          success: false,
          message: "One or more featured artists were not found",
        });
      }
    }

    const existingSong = await Song.findOne({
      title: title.trim(),
      album,
    });

    if (existingSong) {
      return res.status(409).json({
        success: false,
        message: "Song already exists in this album",
      });
    }

    const parsedTags = normalizeArray(tags, true);
    const parsedSyncedLyrics = normalizeSyncedLyrics(syncedLyrics);

    const parsedReleaseDate = releaseDate ? new Date(releaseDate) : null;

    const finalReleaseYear =
      Number(releaseYear) ||
      (parsedReleaseDate && !Number.isNaN(parsedReleaseDate.getTime())
        ? parsedReleaseDate.getFullYear()
        : undefined);

    const finalCountry =
      country?.trim() ||
      artistExists.country ||
      albumExists.country ||
      "Unknown";

    // The admin sends `songLanguage`; keep `language` as a legacy alias for
    // older clients while storing only the schema-safe `songLanguage` field.
    const finalSongLanguage =
      songLanguage?.trim() || language?.trim() || "Unknown";

    const song = await Song.create({
      title: title.trim(),
      artist,
      featuredArtists: parsedFeaturedArtists,
      album,
      genre: genre || "Unknown",
      tags: parsedTags,
      mood: mood || "Unknown",
      songLanguage: finalSongLanguage,
      country: finalCountry,
      releaseDate:
        parsedReleaseDate && !Number.isNaN(parsedReleaseDate.getTime())
          ? parsedReleaseDate
          : undefined,
      releaseYear: finalReleaseYear,
      duration: Number(duration) || 0,

      lyrics: lyrics || "",
      lrcLyrics: lrcLyrics || "",
      syncedLyrics: parsedSyncedLyrics,

      featured: featured === "true" || featured === true,
      explicit: explicit === "true" || explicit === true,
      status: status || "published",
      audioUrl: audioFile.path,
      imageUrl: imageFile.path,
    });

    await Album.findByIdAndUpdate(album, {
      $addToSet: {
        songs: song._id,
      },
    });

    const fullSong = await populateSong(Song.findById(song._id));

    return res.status(201).json({
      success: true,
      message: "Song uploaded successfully",
      song: fullSong,
    });
  } catch (error) {
    console.error("Upload Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Upload failed",
    });
  }
};

// =========================
// GET ALL SONGS
// Supports query filters too
// Example: /api/songs?country=Uganda&genre=Afrobeats&sort=popular
// =========================
export const getSongs = async (req, res) => {
  try {
    const { page = 1, limit, sort = "newest" } = req.query;

    const hasFilters = Object.keys(req.query).some((key) =>
      [
        "search",
        "q",
        "genre",
        "tag",
        "mood",
        "language",
        "country",
        "year",
        "fromYear",
        "toYear",
        "artist",
        "album",
        "featured",
        "explicit",
        "status",
      ].includes(key)
    );

    let query = hasFilters ? buildSongFilterQuery(req.query) : { status: "published" };
    query = await extendSearchWithRelatedMatches(query, req.query.search || req.query.q);

    let songQuery = populateSong(Song.find(query)).sort(getSortOption(sort));

    if (limit) {
      const pageNumber = Math.max(1, Number(page));
      const limitNumber = Math.max(1, Math.min(100, Number(limit)));
      const skip = (pageNumber - 1) * limitNumber;

      songQuery = songQuery.skip(skip).limit(limitNumber);

      const [songs, total] = await Promise.all([
        songQuery,
        Song.countDocuments(query),
      ]);

      return res.json({
        success: true,
        total,
        page: pageNumber,
        pages: Math.ceil(total / limitNumber),
        songs,
      });
    }

    const songs = await songQuery;

    return res.json({
      success: true,
      songs,
    });
  } catch (error) {
    console.error("Get Songs Error:", error);

    return res.status(500).json({
      success: false,
      message: "Fetch failed",
    });
  }
};

// =========================
// FILTER SONGS
// =========================
export const filterSongs = async (req, res) => {
  try {
    const { page = 1, limit = 30, sort = "newest" } = req.query;

    let query = buildSongFilterQuery(req.query);
    query = await extendSearchWithRelatedMatches(query, req.query.search || req.query.q);

    const pageNumber = Math.max(1, Number(page));
    const limitNumber = Math.max(1, Math.min(100, Number(limit)));
    const skip = (pageNumber - 1) * limitNumber;

    const [songs, total] = await Promise.all([
      populateSong(Song.find(query))
        .sort(getSortOption(sort))
        .skip(skip)
        .limit(limitNumber),
      Song.countDocuments(query),
    ]);

    return res.json({
      success: true,
      total,
      page: pageNumber,
      pages: Math.ceil(total / limitNumber),
      songs,
    });
  } catch (error) {
    console.error("Filter Songs Error:", error);

    return res.status(500).json({
      success: false,
      message: "Filter failed",
    });
  }
};

// =========================
// GET FILTER OPTIONS
// =========================
export const getFilterOptions = async (req, res) => {
  try {
    const [genres, countries, moods, languages, years, tags] =
      await Promise.all([
        Song.distinct("genre"),
        Song.distinct("country"),
        Song.distinct("mood"),
        Song.distinct("songLanguage"),
        Song.distinct("releaseYear"),
        Song.distinct("tags"),
      ]);

    return res.json({
      success: true,
      filters: {
        genres: genres.filter(Boolean).sort(),
        countries: countries.filter(Boolean).sort(),
        moods: moods.filter(Boolean).sort(),
        languages: languages.filter(Boolean).sort(),
        years: years.filter(Boolean).sort((a, b) => b - a),
        tags: tags.filter(Boolean).sort(),
      },
    });
  } catch (error) {
    console.error("Filter Options Error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not fetch filter options",
    });
  }
};

// =========================
// GET SINGLE SONG
// =========================
export const getSongById = async (req, res) => {
  try {
    const song = await populateSong(Song.findOne({ _id: req.params.id, status: "published" }));

    if (!song) {
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }

    return res.json({
      success: true,
      song,
    });
  } catch (error) {
    console.error("Get Song Error:", error);

    return res.status(500).json({
      success: false,
      message: "Error",
    });
  }
};

// =========================
// SEARCH SONGS
// =========================
export const searchSongs = async (req, res) => {
  try {
    const { q = "" } = req.query;
    const safeQuery = escapeRegex(q);

    const songs = await populateSong(
      Song.find({
        $or: [
          {
            title: {
              $regex: safeQuery,
              $options: "i",
            },
          },
          {
            genre: {
              $regex: safeQuery,
              $options: "i",
            },
          },
          {
            tags: {
              $in: [new RegExp(safeQuery, "i")],
            },
          },
          {
            mood: {
              $regex: safeQuery,
              $options: "i",
            },
          },
          {
            songLanguage: {
              $regex: safeQuery,
              $options: "i",
            },
          },
          {
            country: {
              $regex: safeQuery,
              $options: "i",
            },
          },
        ],
      })
    ).sort({
      plays: -1,
      createdAt: -1,
    });

    return res.json({
      success: true,
      songs,
    });
  } catch (error) {
    console.error("Search Songs Error:", error);

    return res.status(500).json({
      success: false,
      message: "Search failed",
    });
  }
};

export const updateTopTenSong = async (req, res) => {
  try {
    const { id } = req.params;
    const { isTopTen, topTenRank } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid song ID",
      });
    }

    const shouldBeTopTen = isTopTen === true || isTopTen === "true";
    const rank = Number(topTenRank);

    if (shouldBeTopTen && (!rank || rank < 1 || rank > 10)) {
      return res.status(400).json({
        success: false,
        message: "Top Ten rank must be between 1 and 10",
      });
    }

    const song = await Song.findById(id);

    if (!song) {
      return res.status(404).json({
        success: false,
        message: "Song not found",
      });
    }

    if (shouldBeTopTen) {
      await Song.updateMany(
        {
          _id: {
            $ne: id,
          },
          country: song.country,
          topTenRank: rank,
        },
        {
          $set: {
            isTopTen: false,
            topTenRank: null,
          },
        }
      );

      song.isTopTen = true;
      song.topTenRank = rank;
    } else {
      song.isTopTen = false;
      song.topTenRank = null;
    }

    await song.save();

    const updatedSong = await populateSong(Song.findById(song._id));

    return res.json({
      success: true,
      message: shouldBeTopTen
        ? `Song added to ${song.country} Top Ten at position ${rank}`
        : "Song removed from Top Ten",
      song: updatedSong,
    });
  } catch (error) {
    console.error("Update Top Ten Song Error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not update Top Ten song",
    });
  }
};

export const getTopTenSongs = async (req, res) => {
  try {
    const { country } = req.query;

    const query = {
      status: "published",
      isTopTen: true,
      topTenRank: {
        $gte: 1,
        $lte: 10,
      },
    };

    if (country) {
      query.country = new RegExp(`^${escapeRegex(country)}$`, "i");
    }

    const songs = await populateSong(Song.find(query)).sort({
      topTenRank: 1,
    });

    return res.json({
      success: true,
      country: country || "All",
      songs,
    });
  } catch (error) {
    console.error("Get Top Ten Songs Error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not fetch Top Ten songs",
    });
  }
};

// =========================
// INCREMENT PLAYS
// Also updates monthly recap stats
// =========================
export const incrementPlays = async (req, res) => {
  try {
    const month = getCurrentMonthKey();

    const song = await Song.findById(req.params.id);

    if (!song) {
      return res.status(404).json({
        success: false,
        message: "Song not found",
      });
    }

    song.plays = Number(song.plays || 0) + 1;

    const monthIndex = song.monthlyStats?.findIndex(
      (stat) => stat.month === month
    );

    if (monthIndex >= 0) {
      song.monthlyStats[monthIndex].plays =
        Number(song.monthlyStats[monthIndex].plays || 0) + 1;
    } else {
      song.monthlyStats.push({
        month,
        plays: 1,
        likes: 0,
      });
    }

    await song.save();

    await Album.findByIdAndUpdate(song.album, {
      $inc: {
        totalPlays: 1,
      },
    });

    return res.json({
      success: true,
      plays: song.plays,
      month,
    });
  } catch (error) {
    console.error("Increment Plays Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to increment plays",
    });
  }
};

// =========================
// DELETE SONG
// =========================
export const deleteSong = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);

    if (!song) {
      return res.status(404).json({
        success: false,
        message: "Song not found",
      });
    }

    await Album.findByIdAndUpdate(song.album, {
      $pull: {
        songs: song._id,
      },
    });

    await Song.findByIdAndDelete(req.params.id);

    return res.json({
      success: true,
      message: "Deleted",
    });
  } catch (error) {
    console.error("Delete Song Error:", error);

    return res.status(500).json({
      success: false,
      message: "Delete failed",
    });
  }
};

// =========================
// TRENDING SONGS
// =========================
export const getTrendingSongs = async (req, res) => {
  try {
    const { limit = 10, country, genre } = req.query;

    const query = {
      status: "published",
    };

    if (country) {
      query.country = new RegExp(`^${escapeRegex(country)}$`, "i");
    }

    if (genre) {
      query.genre = new RegExp(`^${escapeRegex(genre)}$`, "i");
    }

    const songs = await populateSong(Song.find(query))
      .sort({
        plays: -1,
        likes: -1,
      })
      .limit(Math.min(Number(limit), 100));

    return res.json({
      success: true,
      songs,
    });
  } catch (error) {
    console.error("Trending Songs Error:", error);

    return res.status(500).json({
      success: false,
    });
  }
};

// =========================
// NEW RELEASES
// =========================
export const getNewReleases = async (req, res) => {
  try {
    const { limit = 10, country, genre } = req.query;

    // Support both current published songs and legacy catalog rows created
    // before the status field existed. This keeps New Releases populated after
    // deployments/migrations without exposing explicit drafts.
    const query = {
      $or: [
        { status: "published" },
        { status: { $exists: false } },
        { status: null },
      ],
    };

    if (country) {
      query.country = new RegExp(`^${escapeRegex(country)}$`, "i");
    }

    if (genre) {
      query.genre = new RegExp(`^${escapeRegex(genre)}$`, "i");
    }

    const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 100));

    const songs = await populateSong(Song.find(query))
      .sort({
        releaseDate: -1,
        releaseYear: -1,
        createdAt: -1,
        _id: -1,
      })
      .limit(safeLimit);

    return res.json({
      success: true,
      songs,
    });
  } catch (error) {
    console.error("New Releases Error:", error);

    return res.status(500).json({
      success: false,
    });
  }
};

// =========================
// TOP SONGS BY COUNTRY
// =========================
export const getTopSongsByCountry = async (req, res) => {
  try {
    const { country } = req.params;
    const { limit = 100, sort = "plays" } = req.query;

    const sortOption =
      sort === "likes"
        ? {
            likes: -1,
            plays: -1,
          }
        : {
            plays: -1,
            likes: -1,
          };

    const songs = await populateSong(
      Song.find({
        status: "published",
        country: new RegExp(`^${escapeRegex(country)}$`, "i"),
      })
    )
      .sort(sortOption)
      .limit(Math.min(Number(limit), 100));

    return res.json({
      success: true,
      country,
      songs,
    });
  } catch (error) {
    console.error("Top Songs By Country Error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not fetch top songs by country",
    });
  }
};

// =========================
// SONGS BY YEAR
// =========================
export const getSongsByYear = async (req, res) => {
  try {
    const { year } = req.params;
    const { sort = "popular", limit = 100 } = req.query;

    const songs = await populateSong(
      Song.find({
        status: "published",
        releaseYear: Number(year),
      })
    )
      .sort(getSortOption(sort))
      .limit(Math.min(Number(limit), 100));

    return res.json({
      success: true,
      year: Number(year),
      songs,
    });
  } catch (error) {
    console.error("Songs By Year Error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not fetch songs by year",
    });
  }
};

// =========================
// OLD SONGS
// =========================
export const getOldSongs = async (req, res) => {
  try {
    const { before = 2010, limit = 50, country, genre } = req.query;

    const query = {
      status: "published",
      releaseYear: {
        $lte: Number(before),
      },
    };

    if (country) {
      query.country = new RegExp(`^${escapeRegex(country)}$`, "i");
    }

    if (genre) {
      query.genre = new RegExp(`^${escapeRegex(genre)}$`, "i");
    }

    const songs = await populateSong(Song.find(query))
      .sort({
        releaseYear: -1,
        plays: -1,
      })
      .limit(Math.min(Number(limit), 100));

    return res.json({
      success: true,
      before: Number(before),
      songs,
    });
  } catch (error) {
    console.error("Old Songs Error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not fetch old songs",
    });
  }
};

// =========================
// MONTHLY RECAP
// Example: /api/songs/monthly-recap?month=2026-06&country=Uganda
// =========================
export const getMonthlyRecap = async (req, res) => {
  try {
    const month = req.query.month || getCurrentMonthKey();
    const { country, limit = 50 } = req.query;

    const matchQuery = {
      status: "published",
      "monthlyStats.month": month,
    };

    if (country) {
      matchQuery.country = new RegExp(`^${escapeRegex(country)}$`, "i");
    }

    const songs = await Song.aggregate([
      {
        $match: matchQuery,
      },
      {
        $addFields: {
          monthlyStat: {
            $first: {
              $filter: {
                input: "$monthlyStats",
                as: "stat",
                cond: {
                  $eq: ["$$stat.month", month],
                },
              },
            },
          },
        },
      },
      {
        $sort: {
          "monthlyStat.plays": -1,
          "monthlyStat.likes": -1,
          plays: -1,
        },
      },
      {
        $limit: Math.min(Number(limit), 100),
      },
      {
        $lookup: {
          from: "artists",
          localField: "artist",
          foreignField: "_id",
          as: "artist",
        },
      },
      {
        $unwind: {
          path: "$artist",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "artists",
          localField: "featuredArtists",
          foreignField: "_id",
          as: "featuredArtists",
        },
      },
      {
        $lookup: {
          from: "albums",
          localField: "album",
          foreignField: "_id",
          as: "album",
        },
      },
      {
        $unwind: {
          path: "$album",
          preserveNullAndEmptyArrays: true,
        },
      },
    ]);

    return res.json({
      success: true,
      month,
      country: country || "All",
      songs,
    });
  } catch (error) {
    console.error("Monthly Recap Error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not fetch monthly recap",
    });
  }
};

// =========================
// SONGS FEATURING ARTIST
// =========================
export const getSongsFeaturingArtist = async (req, res) => {
  try {
    const { artistId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(artistId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid artist ID",
      });
    }

    const songs = await populateSong(
      Song.find({
        status: "published",
        featuredArtists: artistId,
      })
    ).sort({
      createdAt: -1,
    });

    return res.json({
      success: true,
      artistId,
      songs,
    });
  } catch (error) {
    console.error("Songs Featuring Artist Error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not fetch songs featuring artist",
    });
  }
};

// =========================
// POPULAR ARTISTS
// =========================
export const getPopularArtists = async (req, res) => {
  try {
    const artists = await Artist.find()
      .sort({
        followers: -1,
      })
      .limit(10);

    return res.json({
      success: true,
      artists,
    });
  } catch (error) {
    console.error("Popular Artists Error:", error);

    return res.status(500).json({
      success: false,
    });
  }
};

// =========================
// MOST LIKED SONGS
// =========================
export const getMostLikedSongs = async (req, res) => {
  try {
    const { limit = 10, country, genre } = req.query;

    const query = {
      status: "published",
    };

    if (country) {
      query.country = new RegExp(`^${escapeRegex(country)}$`, "i");
    }

    if (genre) {
      query.genre = new RegExp(`^${escapeRegex(genre)}$`, "i");
    }

    const songs = await populateSong(Song.find(query))
      .sort({
        likes: -1,
        plays: -1,
      })
      .limit(Math.min(Number(limit), 100));

    return res.json({
      success: true,
      songs,
    });
  } catch (error) {
    console.error("Most Liked Songs Error:", error);

    return res.status(500).json({
      success: false,
    });
  }
};

// =========================
// ARTISTS BY COUNTRY
// =========================
export const getArtistsByCountry = async (req, res) => {
  try {
    const { country } = req.params;

    const artists = await Artist.find({
      country: new RegExp(escapeRegex(country), "i"),
    });

    return res.json({
      success: true,
      artists,
    });
  } catch (error) {
    console.error("Artists By Country Error:", error);

    return res.status(500).json({
      success: false,
    });
  }
};