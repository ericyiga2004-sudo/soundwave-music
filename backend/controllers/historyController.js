import User from "../models/userModel.js";

export const addToHistory = async (
  req,
  res
) => {
  try {
    const userId = req.userId;

    const { songId } = req.body;

    const user = await User.findById(
      userId
    );

    if (!user) {
      return res.json({
        success: false,
        message: "User not found",
      });
    }

    user.history = user.history.filter(
      (item) =>
        item.song.toString() !== songId
    );

    user.history.unshift({
      song: songId,
      playedAt: new Date(),
    });

    user.history =
      user.history.slice(0, 50);

    await user.save();

    res.json({
      success: true,
      message:
        "Added to history",
    });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: error.message,
    });
  }
};

export const getHistory = async (
  req,
  res
) => {
  try {
    const user = await User.findById(
      req.userId
    )
      .populate({
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