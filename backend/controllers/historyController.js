import { increasePreference } from "../utils/preferencesHelper.js";
import User from "../models/userModel.js";
import Song from "../models/uploadSongModel.js";

export const addToHistory = async (req, res) => {
  try {
    const userId = req.userId;
    const { songId } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.json({
        success: false,
        message: "User not found",
      });
    }

    const song = await Song.findById(songId).select(
      "genre mood artist country songLanguage releaseYear"
    );

    if (!song) {
      return res.json({
        success: false,
        message: "Song not found",
      });
    }

    // Remove duplicate
    user.history = user.history.filter(
      (item) => item.song.toString() !== songId
    );

    // Add latest play
    user.history.unshift({
      song: songId,
      playedAt: new Date(),
    });

    // Keep latest 50
    user.history = user.history.slice(0, 50);

    // ---------- Learn preferences ----------
    increasePreference(
      user.preferences.countries,
      "name",
      song.country,
      1
    );

    increasePreference(
      user.preferences.genres,
      "name",
      song.genre,
      1
    );

    increasePreference(
      user.preferences.moods,
      "name",
      song.mood,
      1
    );

    increasePreference(
      user.preferences.languages,
      "name",
      song.songLanguage,
      1
    );

    increasePreference(
      user.preferences.years,
      "year",
      song.releaseYear,
      1
    );

    increasePreference(
      user.preferences.artists,
      "artist",
      song.artist,
      1
    );

    await user.save();

    res.json({
      success: true,
      message: "Added to history",
    });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: error.message,
    });
  }
};

export const getHistory = async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate({
      path: "history.song",
      populate: [
        {
          path: "artist",
        },
        {
          path: "album",
        },
      ],
    });

    res.json({
      success: true,
      history: user.history,
    });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: error.message,
    });
  }
};   