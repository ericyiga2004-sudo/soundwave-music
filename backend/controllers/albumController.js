import Album from "../models/albumModel.js";
import Artist from "../models/artistModel.js";

// ======================================
// Reusable Populate
// ======================================
const albumPopulate = [
  {
    path: "artist",
  },
  {
    path: "songs",
    populate: [
      {
        path: "artist",
      },
      {
        path: "album",
      },
    ],
  },
];

// ======================================
// Create Album
// ======================================
export const createAlbum = async (req, res) => {
  try {
    const { title, artist, description, releaseDate } = req.body;

    const coverImage = req.file?.path;

    if (!title?.trim() || !artist) {
      return res.status(400).json({
        success: false,
        message: "Title and artist are required",
      });
    }

    if (!coverImage) {
      return res.status(400).json({
        success: false,
        message: "Album cover is required",
      });
    }

    const artistExists = await Artist.findById(artist);

    if (!artistExists) {
      return res.status(404).json({
        success: false,
        message: "Artist not found",
      });
    }

    const existingAlbum = await Album.findOne({
      title: title.trim(),
      artist,
    });

    if (existingAlbum) {
      return res.status(409).json({
        success: false,
        message: "Album already exists for this artist",
      });
    }

    const album = await Album.create({
      title: title.trim(),
      artist,
      coverImage,
      description: description || "",
      releaseDate,
    });

    const fullAlbum = await Album.findById(album._id).populate(albumPopulate);

    return res.status(201).json({
      success: true,
      message: "Album created successfully",
      album: fullAlbum,
    });
  } catch (error) {
    console.error("Create Album Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create album",
    });
  }
};

// ======================================
// Get All Albums
// ======================================
export const getAlbums = async (req, res) => {
  try {
    const { page = 1, limit, search = "", artist = "", sort = "newest" } = req.query;
    const query = {};

    if (String(search).trim()) {
      query.title = { $regex: String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    }
    if (String(artist).trim()) query.artist = artist;

    const sortOptions = {
      newest: { releaseDate: -1, createdAt: -1 },
      popular: { totalPlays: -1, createdAt: -1 },
      name: { title: 1 },
    };
    const sortOption = sortOptions[sort] || sortOptions.newest;

    if (limit) {
      const pageNumber = Math.max(1, Number(page));
      const limitNumber = Math.max(1, Math.min(100, Number(limit)));
      const skip = (pageNumber - 1) * limitNumber;
      const [albums, total] = await Promise.all([
        Album.find(query).populate(albumPopulate).sort(sortOption).skip(skip).limit(limitNumber),
        Album.countDocuments(query),
      ]);
      return res.status(200).json({
        success: true, count: albums.length, total, page: pageNumber,
        pages: Math.ceil(total / limitNumber), albums,
      });
    }

    const albums = await Album.find(query).populate(albumPopulate).sort(sortOption);
    return res.status(200).json({ success: true, count: albums.length, total: albums.length, albums });
  } catch (error) {
    console.error("Get Albums Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch albums" });
  }
};

// ======================================
// Get Album By ID
// ======================================
export const getAlbumById = async (req, res) => {
  try {
    const album = await Album.findById(req.params.id).populate(albumPopulate);

    if (!album) {
      return res.status(404).json({
        success: false,
        message: "Album not found",
      });
    }

    return res.status(200).json({
      success: true,
      album,
    });
  } catch (error) {
    console.error("Get Album Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch album",
    });
  }
};

// ======================================
// Update Album
// ======================================
export const updateAlbum = async (req, res) => {
  try {
    const updates = {
      ...req.body,
    };

    if (updates.title) {
      updates.title = updates.title.trim();
    }

    if (req.file) {
      updates.coverImage = req.file.path;
    }

    if (updates.artist) {
      const artistExists = await Artist.findById(updates.artist);

      if (!artistExists) {
        return res.status(404).json({
          success: false,
          message: "Artist not found",
        });
      }
    }

    const album = await Album.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).populate(albumPopulate);

    if (!album) {
      return res.status(404).json({
        success: false,
        message: "Album not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Album updated successfully",
      album,
    });
  } catch (error) {
    console.error("Update Album Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update album",
    });
  }
};

// ======================================
// Delete Album
// ======================================
export const deleteAlbum = async (req, res) => {
  try {
    const album = await Album.findById(req.params.id);

    if (!album) {
      return res.status(404).json({
        success: false,
        message: "Album not found",
      });
    }

    await Album.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Album deleted successfully",
    });
  } catch (error) {
    console.error("Delete Album Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete album",
    });
  }
};