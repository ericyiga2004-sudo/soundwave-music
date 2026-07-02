/* import User from "../models/userModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// =====================================
// GENERATE TOKEN
// =====================================

const createToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET,
    {
      expiresIn: "30d",
    }
  );
};

// =====================================
// REGISTER
// =====================================

export const registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.json({
        success: false,
        message: "All fields required",
      });
    }

    const exists = await User.findOne({ email });

    if (exists) {
      return res.json({
        success: false,
        message: "Email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(
      password,
      10
    );

    const user = await User.create({
      username,
      email,
      password: hashedPassword,
    });

    const token = createToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: error.message,
    });
  }
};

// =====================================
// LOGIN
// =====================================

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({
      email,
    });

    if (!user) {
      return res.json({
        success: false,
        message: "User not found",
      });
    }

    const match = await bcrypt.compare(
      password,
      user.password
    );

    if (!match) {
      return res.json({
        success: false,
        message: "Wrong password",
      });
    }

    const token = createToken(user._id);

    res.json({
      success: true,
      token,

      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        image: user.image,
      },
    });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: error.message,
    });
  }
};

// =====================================
// GET PROFILE
// =====================================

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(
      req.userId
    )
      .populate("likedSongs")
      .populate("history.songId");

    res.json({
      success: true,
      user,
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
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// =====================================
// GENERATE TOKEN
// =====================================

const createToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET,
    {
      expiresIn: "30d",
    }
  );
};

// =====================================
// REGISTER
// =====================================

export const registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.json({
        success: false,
        message: "All fields required",
      });
    }

    const exists = await User.findOne({ email });

    if (exists) {
      return res.json({
        success: false,
        message: "Email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      email,
      password: hashedPassword,
    });

    const token = createToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: error.message,
    });
  }
};

// =====================================
// LOGIN
// =====================================

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({
      email,
    });

    if (!user) {
      return res.json({
        success: false,
        message: "User not found",
      });
    }

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.json({
        success: false,
        message: "Wrong password",
      });
    }

    const token = createToken(user._id);

    res.json({
      success: true,
      token,

      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        image: user.image,
      },
    });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: error.message,
    });
  }
};

// =====================================
// GET PROFILE
// =====================================

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate("likedSongs")
      .populate("history.song");

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: error.message,
    });
  }
};

// =====================================
// PERSONALIZED RECOMMENDATIONS
// =====================================

export const getRecommendations = async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.json({
        success: false,
        message: "User not found",
      });
    }

    const recommendations = await Song.find({
      $or: [
        {
          genre: {
            $in: user.favoriteGenres,
          },
        },
        {
          mood: {
            $in: user.favoriteMoods,
          },
        },
        {
          artist: {
            $in: user.favoriteArtists,
          },
        },
      ],

      _id: {
        $nin: user.likedSongs,
      },

      status: "published",
    })
      .populate("artist album")
      .sort({
        plays: -1,
      })
      .limit(20);

    res.json({
      success: true,
      songs: recommendations,
    });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: error.message,
    });
  }
};




// =====================================
// BECAUSE YOU LIKED
// =====================================

export const getBecauseYouLiked = async (req, res) => {
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

    if (!user.likedSongs || user.likedSongs.length === 0) {
      return res.json({
        success: true,
        title: "Because You Liked",
        basedOn: null,
        songs: [],
      });
    }

    const likedSong = user.likedSongs[0];

    const similarSongs = await Song.find({
      _id: {
        $nin: user.likedSongs.map((song) => song._id),
      },

      status: "published",

      $or: [
        {
          genre: likedSong.genre,
        },
        {
          mood: likedSong.mood,
        },
        {
          artist: likedSong.artist?._id || likedSong.artist,
        },
      ],
    })
      .populate("artist album")
      .sort({
        plays: -1,
        createdAt: -1,
      })
      .limit(20);

    res.json({
      success: true,
      title: `Because You Liked ${likedSong.title}`,
      basedOn: likedSong,
      songs: similarSongs,
    });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: error.message,
    });
  }
};