/* import User from "../models/userModel.js";
import Song from "../models/uploadSongModel.js";

export const toggleLikeSong = async (req, res) => {
  try {
    const userId = req.userId;
    const { songId } = req.params;

    if (!songId) {
      return res.json({
        success: false,
        message: "Song ID is required",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.json({
        success: false,
        message: "User not found",
      });
    }

    const song = await Song.findById(songId).select("_id likes");

    if (!song) {
      return res.json({
        success: false,
        message: "Song not found",
      });
    }

    const alreadyLiked = user.likedSongs.some(
      (likedSongId) => likedSongId.toString() === songId
    );

    let liked;
    let updatedSong;

    if (alreadyLiked) {
      await User.updateOne(
        { _id: userId },
        { $pull: { likedSongs: songId } }
      );

      updatedSong = await Song.findByIdAndUpdate(
        songId,
        { $inc: { likes: -1 } },
        { new: true }
      ).select("likes");

      if (updatedSong.likes < 0) {
        updatedSong = await Song.findByIdAndUpdate(
          songId,
          { $set: { likes: 0 } },
          { new: true }
        ).select("likes");
      }

      liked = false;
    } else {
      await User.updateOne(
        { _id: userId },
        { $addToSet: { likedSongs: songId } }
      );

      updatedSong = await Song.findByIdAndUpdate(
        songId,
        { $inc: { likes: 1 } },
        { new: true }
      ).select("likes");

      liked = true;
    }

    res.json({
      success: true,
      liked,
      likes: updatedSong.likes,
      message: liked ? "Song liked" : "Song unliked",
    });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: error.message,
    });
  }
};

export const getLikedSongs = async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate({
      path: "likedSongs",
      populate: [
        {
          path: "artist",
        },
        {
          path: "album",
        },
      ],
    });

    if (!user) {
      return res.json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      likedSongs: user.likedSongs || [],
    });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: error.message,
    });
  }
};

export const checkSongLiked = async (req, res) => {
  try {
    const userId = req.userId;
    const { songId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.json({
        success: false,
        message: "User not found",
      });
    }

    const liked = user.likedSongs.some(
      (likedSongId) => likedSongId.toString() === songId
    );

    res.json({
      success: true,
      liked,
    });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: error.message,
    });
  }
}; */

import User from "../models/userModel.js";
import Song from "../models/uploadSongModel.js";

export const toggleLikeSong = async (req, res) => {
  try {
    const userId = req.userId;
    const { songId } = req.params;

    if (!songId) {
      return res.json({
        success: false,
        message: "Song ID is required",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.json({
        success: false,
        message: "User not found",
      });
    }

    // We need genre, mood and artist for recommendations
    const song = await Song.findById(songId).select(
      "_id likes genre mood artist"
    );

    if (!song) {
      return res.json({
        success: false,
        message: "Song not found",
      });
    }

    const alreadyLiked = user.likedSongs.some(
      (likedSongId) => likedSongId.toString() === songId
    );

    let liked;
    let updatedSong;

    if (alreadyLiked) {
      // Remove like only
      // (We intentionally DO NOT remove preferences because
      // users may still like that genre overall.)
      await User.updateOne(
        { _id: userId },
        {
          $pull: {
            likedSongs: songId,
          },
        }
      );

      updatedSong = await Song.findByIdAndUpdate(
        songId,
        {
          $inc: {
            likes: -1,
          },
        },
        {
          new: true,
        }
      ).select("likes");

      if (updatedSong.likes < 0) {
        updatedSong = await Song.findByIdAndUpdate(
          songId,
          {
            $set: {
              likes: 0,
            },
          },
          {
            new: true,
          }
        ).select("likes");
      }

      liked = false;
    } else {
      // Add like
      await User.updateOne(
        { _id: userId },
        {
          $addToSet: {
            likedSongs: songId,

            // Learn user preferences automatically
            favoriteGenres: song.genre,
            favoriteMoods: song.mood,
            favoriteArtists: song.artist,
          },
        }
      );

      updatedSong = await Song.findByIdAndUpdate(
        songId,
        {
          $inc: {
            likes: 1,
          },
        },
        {
          new: true,
        }
      ).select("likes");

      liked = true;
    }

    res.json({
      success: true,
      liked,
      likes: updatedSong.likes,
      message: liked ? "Song liked" : "Song unliked",
    });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: error.message,
    });
  }
};

export const getLikedSongs = async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate({
      path: "likedSongs",
      populate: [
        {
          path: "artist",
        },
        {
          path: "album",
        },
      ],
    });

    if (!user) {
      return res.json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      likedSongs: user.likedSongs || [],
    });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: error.message,
    });
  }
};

export const checkSongLiked = async (req, res) => {
  try {
    const userId = req.userId;
    const { songId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.json({
        success: false,
        message: "User not found",
      });
    }

    const liked = user.likedSongs.some(
      (likedSongId) => likedSongId.toString() === songId
    );

    res.json({
      success: true,
      liked,
    });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: error.message,
    });
  }
};