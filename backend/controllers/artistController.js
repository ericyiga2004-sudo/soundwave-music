/* import Artist from "../models/artistModel.js";

// ======================================
// Create Artist
// ======================================
export const createArtist = async (req, res) => {
  try {
    const { name, bio, country, followers, verified } = req.body;

    const image = req.file?.path;

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Artist name is required",
      });
    }

    if (!image) {
      return res.status(400).json({
        success: false,
        message: "Artist image is required",
      });
    }

    const existingArtist = await Artist.findOne({
      name: name.trim(),
    });

    if (existingArtist) {
      return res.status(409).json({
        success: false,
        message: "Artist already exists",
      });
    }

    

const artist = await Artist.create({
  name: name.trim(),
  image,
  bio: bio || "",
  country,
  followers: followers || 0,
  verified: verified === "true" || verified === true,
});

    return res.status(201).json({
      success: true,
      message: "Artist created successfully",
      artist,
    });
  } catch (error) {
    console.error("Create Artist Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create artist",
    });
  }
};

// ======================================
// Get All Artists
// ======================================
export const getArtists = async (req, res) => {
  try {
    const artists = await Artist.find().sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: artists.length,
      artists,
    });
  } catch (error) {
    console.error("Get Artists Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch artists",
    });
  }
};

// ======================================
// Get Artist By ID
// ======================================
export const getArtistById = async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id);

    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Artist not found",
      });
    }

    return res.status(200).json({
      success: true,
      artist,
    });
  } catch (error) {
    console.error("Get Artist Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch artist",
    });
  }
};

// ======================================
// Update Artist
// ======================================
export const updateArtist = async (req, res) => {
  try {
    const updates = { ...req.body };

    if (req.file) {
      updates.image = req.file.path;
    }

    const artist = await Artist.findByIdAndUpdate(
      req.params.id,
      updates,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Artist not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Artist updated successfully",
      artist,
    });
  } catch (error) {
    console.error("Update Artist Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update artist",
    });
  }
};

// ======================================
// Delete Artist
// ======================================
export const deleteArtist = async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id);

    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Artist not found",
      });
    }

    await Artist.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Artist deleted successfully",
    });
  } catch (error) {
    console.error("Delete Artist Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete artist",
    });
  }
}; */



import Artist from "../models/artistModel.js";
import User from "../models/userModel.js";
import { applyArtistPreferenceSignal } from "../utils/preferencesHelper.js";

// ======================================
// Create Artist
// ======================================
export const createArtist = async (req, res) => {
  try {
    const { name, bio, country, followers, verified } = req.body;

    const image = req.file?.path;

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Artist name is required",
      });
    }

    if (!image) {
      return res.status(400).json({
        success: false,
        message: "Artist image is required",
      });
    }

    const existingArtist = await Artist.findOne({
      name: name.trim(),
    });

    if (existingArtist) {
      return res.status(409).json({
        success: false,
        message: "Artist already exists",
      });
    }

    const artist = await Artist.create({
      name: name.trim(),
      image,
      bio: bio || "",
      country,
      followers: Number(followers) || 0,
      verified: verified === "true" || verified === true,
    });

    return res.status(201).json({
      success: true,
      message: "Artist created successfully",
      artist,
    });
  } catch (error) {
    console.error("Create Artist Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create artist",
    });
  }
};

// ======================================
// Get All Artists
// ======================================
export const getArtists = async (req, res) => {
  try {
    const { page = 1, limit, search = "", country = "", sort = "followers" } = req.query;
    const query = {};

    if (String(search).trim()) {
      query.name = { $regex: String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    }

    if (String(country).trim()) {
      query.country = { $regex: `^${String(country).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" };
    }

    const sortOptions = {
      followers: { followers: -1, name: 1 },
      newest: { createdAt: -1 },
      name: { name: 1 },
    };
    const sortOption = sortOptions[sort] || sortOptions.followers;

    if (limit) {
      const pageNumber = Math.max(1, Number(page));
      const limitNumber = Math.max(1, Math.min(100, Number(limit)));
      const skip = (pageNumber - 1) * limitNumber;
      const [artists, total] = await Promise.all([
        Artist.find(query).sort(sortOption).skip(skip).limit(limitNumber),
        Artist.countDocuments(query),
      ]);

      return res.status(200).json({
        success: true,
        count: artists.length,
        total,
        page: pageNumber,
        pages: Math.ceil(total / limitNumber),
        artists,
      });
    }

    const artists = await Artist.find(query).sort(sortOption);
    return res.status(200).json({ success: true, count: artists.length, total: artists.length, artists });
  } catch (error) {
    console.error("Get Artists Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch artists" });
  }
};

// ======================================
// Get Artist By ID
// ======================================
export const getArtistById = async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id);

    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Artist not found",
      });
    }

    return res.status(200).json({
      success: true,
      artist,
    });
  } catch (error) {
    console.error("Get Artist Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch artist",
    });
  }
};

// ======================================
// Update Artist
// ======================================
export const updateArtist = async (req, res) => {
  try {
    const updates = { ...req.body };

    if (req.file) {
      updates.image = req.file.path;
    }

    if (updates.followers !== undefined) {
      updates.followers = Number(updates.followers) || 0;
    }

    if (updates.verified !== undefined) {
      updates.verified = updates.verified === "true" || updates.verified === true;
    }

    const artist = await Artist.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Artist not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Artist updated successfully",
      artist,
    });
  } catch (error) {
    console.error("Update Artist Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update artist",
    });
  }
};

// ======================================
// Delete Artist
// ======================================
export const deleteArtist = async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id);

    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Artist not found",
      });
    }

    await Artist.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Artist deleted successfully",
    });
  } catch (error) {
    console.error("Delete Artist Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete artist",
    });
  }
};

// ======================================
// Toggle Follow Artist
// ======================================
export const toggleFollowArtist = async (req, res) => {
  try {
    const userId = req.userId;
    const { artistId } = req.params;

    const artist = await Artist.findById(artistId);

    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Artist not found",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const alreadyFollowing = user.followedArtists.some(
      (id) => id.toString() === artistId
    );

    let following;

    if (alreadyFollowing) {
      user.followedArtists = user.followedArtists.filter(
        (id) => id.toString() !== artistId
      );

      applyArtistPreferenceSignal(user, artist, -6);
      await user.save();

      await Artist.findByIdAndUpdate(artistId, {
        $inc: {
          followers: -1,
        },
      });

      following = false;
    } else {
      user.followedArtists.addToSet(artist._id);

      // Follow is one of the strongest explicit taste signals.
      applyArtistPreferenceSignal(user, artist, 12);

      await user.save();

      await Artist.findByIdAndUpdate(artistId, {
        $inc: {
          followers: 1,
        },
      });

      following = true;
    }

    const updatedArtist = await Artist.findById(artistId);

    if (updatedArtist.followers < 0) {
      updatedArtist.followers = 0;
      await updatedArtist.save();
    }

    return res.status(200).json({
      success: true,
      following,
      followers: updatedArtist.followers,
      message: following ? "Artist followed" : "Artist unfollowed",
    });
  } catch (error) {
    console.error("Toggle Follow Artist Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update follow status",
    });
  }
};

// ======================================
// Check Artist Followed
// ======================================
export const checkArtistFollowed = async (req, res) => {
  try {
    const userId = req.userId;
    const { artistId } = req.params;

    const user = await User.findById(userId).select("followedArtists");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const following = user.followedArtists.some(
      (id) => id.toString() === artistId
    );

    return res.status(200).json({
      success: true,
      following,
    });
  } catch (error) {
    console.error("Check Artist Followed Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to check follow status",
    });
  }
};

// ======================================
// Get Followed Artists
// ======================================
export const getFollowedArtists = async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate("followedArtists");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      artists: user.followedArtists || [],
    });
  } catch (error) {
    console.error("Get Followed Artists Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch followed artists",
    });
  }
};