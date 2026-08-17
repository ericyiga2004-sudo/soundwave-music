import User from "../models/userModel.js";
import Song from "../models/uploadSongModel.js";
import { applySongPreferenceSignal } from "../utils/preferencesHelper.js";

export const toggleLikeSong = async (req, res) => {
  try {
    const userId = req.userId;
    const { songId } = req.params;

    if (!songId) {
      return res.status(400).json({
        success: false,
        message: "Song ID is required",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const song = await Song.findById(songId).select(
      "_id likes genre mood artist album country songLanguage releaseYear"
    );

    if (!song) {
      return res.status(404).json({
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
      user.likedSongs = user.likedSongs.filter(
        (id) => id.toString() !== songId
      );

      applySongPreferenceSignal(user, song, -4);
      await user.save();

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

      if (updatedSong && updatedSong.likes < 0) {
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
      user.likedSongs.addToSet(song._id);

      applySongPreferenceSignal(user, song, 7);

      await user.save();

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

    return res.json({
      success: true,
      liked,
      likes: updatedSong?.likes || 0,
      message: liked ? "Song liked" : "Song unliked",
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
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
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      likedSongs: user.likedSongs || [],
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const checkSongLiked = async (req, res) => {
  try {
    const userId = req.userId;
    const { songId } = req.params;

    const user = await User.findById(userId).select("likedSongs");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const liked = user.likedSongs.some(
      (likedSongId) => likedSongId.toString() === songId
    );

    return res.json({
      success: true,
      liked,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};