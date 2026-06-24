import Playlist from "../models/playlistModel.js";

export const createPlaylist = async (req, res) => {
  try {
    const userId = req.userId;
    const { name, description } = req.body;

    if (!name) {
      return res.json({
        success: false,
        message: "Playlist name is required",
      });
    }

    const playlist = await Playlist.create({
      name,
      description,
      user: userId,
      songs: [],
    });

    res.json({
      success: true,
      message: "Playlist created",
      playlist,
    });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: error.message,
    });
  }
};

export const getUserPlaylists = async (req, res) => {
  try {
    const playlists = await Playlist.find({
      user: req.userId,
    })
      .populate({
        path: "songs",
        populate: [
          {
            path: "artist",
          },
          {
            path: "album",
          },
        ],
      })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      playlists,
    });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: error.message,
    });
  }
};

export const addSongToPlaylist = async (req, res) => {
  try {
    const userId = req.userId;
    const { playlistId, songId } = req.body;

    const playlist = await Playlist.findOne({
      _id: playlistId,
      user: userId,
    });

    if (!playlist) {
      return res.json({
        success: false,
        message: "Playlist not found",
      });
    }

    const alreadyExists = playlist.songs.some(
      (song) => song.toString() === songId
    );

    if (!alreadyExists) {
      playlist.songs.push(songId);
      await playlist.save();
    }

    res.json({
      success: true,
      message: "Song added to playlist",
    });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: error.message,
    });
  }
};

export const removeSongFromPlaylist = async (req, res) => {
  try {
    const userId = req.userId;
    const { playlistId, songId } = req.body;

    const playlist = await Playlist.findOne({
      _id: playlistId,
      user: userId,
    });

    if (!playlist) {
      return res.json({
        success: false,
        message: "Playlist not found",
      });
    }

    playlist.songs = playlist.songs.filter(
      (song) => song.toString() !== songId
    );

    await playlist.save();

    res.json({
      success: true,
      message: "Song removed from playlist",
    });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: error.message,
    });
  }
};

export const deletePlaylist = async (req, res) => {
  try {
    const userId = req.userId;
    const { playlistId } = req.body;

    const playlist = await Playlist.findOneAndDelete({
      _id: playlistId,
      user: userId,
    });

    if (!playlist) {
      return res.json({
        success: false,
        message: "Playlist not found",
      });
    }

    res.json({
      success: true,
      message: "Playlist deleted",
    });
  } catch (error) {
    console.log(error);

    res.json({
      success: false,
      message: error.message,
    });
  }
};