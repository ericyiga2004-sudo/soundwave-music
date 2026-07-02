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
      await User.updateOne(
        { _id: userId },
        {
          $pull: {
            followedArtists: artistId,
            favoriteArtists: artistId,
          },
        }
      );

      await Artist.findByIdAndUpdate(artistId, {
        $inc: {
          followers: -1,
        },
      });

      following = false;
    } else {
      await User.updateOne(
        { _id: userId },
        {
          $addToSet: {
            followedArtists: artistId,
            favoriteArtists: artistId,
          },
        }
      );

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