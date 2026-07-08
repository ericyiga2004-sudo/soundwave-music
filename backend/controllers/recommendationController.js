import User from "../models/userModel.js";
import Song from "../models/uploadSongModel.js";

export const getHomeRecommendations = async (
  req,
  res
) => {
  try {
    const user = await User.findById(
      req.userId
    );

    if (!user) {
      return res.json({
        success: false,
        message: "User not found",
      });
    }

    const countries =
      user.preferences?.countries || [];

    const genres =
      user.preferences?.genres || [];

    const moods =
      user.preferences?.moods || [];

    const languages =
      user.preferences?.languages || [];

    const years =
      user.preferences?.years || [];

    const artists =
      user.preferences?.artists || [];

    const topCountries = countries
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((item) => item.name);

    const topGenres = genres
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((item) => item.name);

    const topMoods = moods
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((item) => item.name);

    const topLanguages = languages
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((item) => item.name);

    const topYears = years
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((item) => item.year);

    const topArtists = artists
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((item) => item.artist);

    const songs = await Song.find({
      status: "published",
      $or: [
        {
          country: {
            $in: topCountries,
          },
        },
        {
          genre: {
            $in: topGenres,
          },
        },
        {
          mood: {
            $in: topMoods,
          },
        },
        {
          songLanguage: {
            $in: topLanguages,
          },
        },
        {
          releaseYear: {
            $in: topYears,
          },
        },
        {
          artist: {
            $in: topArtists,
          },
        },
      ],
    })
      .populate("artist")
      .populate("album")
      .sort({
        plays: -1,
        likes: -1,
      })
      .limit(50);

    res.json({
      success: true,
      songs,
    });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: error.message,
    });
  }
};