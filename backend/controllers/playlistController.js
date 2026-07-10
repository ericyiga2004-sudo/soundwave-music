import Playlist from "../models/playlistModel.js";
import PlaylistShare from "../models/playlistShareModel.js";
import User from "../models/userModel.js";
import { createNotificationForUser } from "./notificationController.js";

const MAX_PLAYLIST_SONGS = 50;

const escapeRegex = (value = "") => {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const maskEmail = (email = "") => {
  if (!email || !email.includes("@")) return "";

  const [name, domain] = email.split("@");

  const visibleName =
    name.length <= 2 ? `${name[0] || ""}*` : `${name.slice(0, 2)}***`;

  return `${visibleName}@${domain}`;
};

const publicUser = (user) => {
  return {
    _id: user._id,
    username: user.username || user.name || "SoundWave User",
    name: user.name || user.username || "SoundWave User",
    maskedEmail: maskEmail(user.email || ""),
  };
};

const populatePlaylist = (query) => {
  return query.populate({
    path: "songs",
    populate: [
      {
        path: "artist",
      },
      {
        path: "album",
      },
    ],
  });
};

const populateShare = (query) => {
  return query
    .populate({
      path: "playlist",
      populate: [
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
      ],
    })
    .populate({
      path: "fromUser",
      model: User,
      select: "username name email",
    })
    .populate({
      path: "toUser",
      model: User,
      select: "username name email",
    });
};

const updatePlaylistSharesCount = async (playlistId) => {
  if (!playlistId) return;

  const count = await PlaylistShare.countDocuments({
    playlist: playlistId,
    status: "active",
  });

  await Playlist.updateOne(
    {
      _id: playlistId,
    },
    {
      $set: {
        sharesCount: count,
      },
    }
  );
};

export const createPlaylist = async (req, res) => {
  try {
    const userId = req.userId;
    const { name, description } = req.body;

    if (!name?.trim()) {
      return res.json({
        success: false,
        message: "Playlist name is required",
      });
    }

    const playlist = await Playlist.create({
      name: name.trim(),
      description: description?.trim() || "",
      user: userId,
      songs: [],
      imageUrl: "",
      sharesCount: 0,
      plays: 0,
      saves: 0,
    });

    return res.json({
      success: true,
      message: "Playlist created",
      playlist,
    });
  } catch (error) {
    console.log("Create playlist error:", error);

    return res.json({
      success: false,
      message: error.message,
    });
  }
};

export const getUserPlaylists = async (req, res) => {
  try {
    const playlists = await populatePlaylist(
      Playlist.find({
        user: req.userId,
      }).sort({ createdAt: -1 })
    );

    return res.json({
      success: true,
      playlists,
    });
  } catch (error) {
    console.log("Get user playlists error:", error);

    return res.json({
      success: false,
      message: error.message,
    });
  }
};

export const addSongToPlaylist = async (req, res) => {
  try {
    const userId = req.userId;
    const { playlistId, songId } = req.body;

    if (!playlistId || !songId) {
      return res.json({
        success: false,
        message: "Playlist and song are required",
      });
    }

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
      if (playlist.songs.length >= MAX_PLAYLIST_SONGS) {
        return res.json({
          success: false,
          message: `Playlist can only contain ${MAX_PLAYLIST_SONGS} songs or less`,
        });
      }

      playlist.songs.push(songId);
      await playlist.save();
    }

    const updatedPlaylist = await populatePlaylist(
      Playlist.findById(playlist._id)
    );

    return res.json({
      success: true,
      message: alreadyExists
        ? "Song already exists in playlist"
        : "Song added to playlist",
      playlist: updatedPlaylist,
    });
  } catch (error) {
    console.log("Add song to playlist error:", error);

    return res.json({
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

    const updatedPlaylist = await populatePlaylist(
      Playlist.findById(playlist._id)
    );

    return res.json({
      success: true,
      message: "Song removed from playlist",
      playlist: updatedPlaylist,
    });
  } catch (error) {
    console.log("Remove song from playlist error:", error);

    return res.json({
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

    await PlaylistShare.updateMany(
      {
        playlist: playlist._id,
        status: "active",
      },
      {
        $set: {
          status: "revoked",
        },
      }
    );

    return res.json({
      success: true,
      message: "Playlist deleted",
    });
  } catch (error) {
    console.log("Delete playlist error:", error);

    return res.json({
      success: false,
      message: error.message,
    });
  }
};

export const searchUsersForPlaylistShare = async (req, res) => {
  try {
    const userId = req.userId;
    const q = String(req.query.q || "").trim();

    if (q.length < 2) {
      return res.json({
        success: true,
        users: [],
      });
    }

    const regex = new RegExp(escapeRegex(q), "i");

    const users = await User.find({
      _id: {
        $ne: userId,
      },
      $or: [
        {
          username: regex,
        },
        {
          name: regex,
        },
        {
          email: regex,
        },
      ],
    })
      .select("username name email")
      .limit(10);

    return res.json({
      success: true,
      users: users.map(publicUser),
    });
  } catch (error) {
    console.log("Search users for playlist share error:", error);

    return res.json({
      success: false,
      message: error.message,
    });
  }
};

export const sharePlaylistToUser = async (req, res) => {
  try {
    const fromUser = req.userId;
    const { playlistId, receiverId, message } = req.body;

    if (!playlistId || !receiverId) {
      return res.json({
        success: false,
        message: "Playlist and receiver are required",
      });
    }

    if (fromUser.toString() === receiverId.toString()) {
      return res.json({
        success: false,
        message: "You cannot share a playlist with yourself",
      });
    }

    const playlist = await Playlist.findOne({
      _id: playlistId,
      user: fromUser,
    });

    if (!playlist) {
      return res.json({
        success: false,
        message: "Playlist not found",
      });
    }

    if (playlist.songs.length === 0) {
      return res.json({
        success: false,
        message: "Add songs before sharing this playlist",
      });
    }

    if (playlist.songs.length > MAX_PLAYLIST_SONGS) {
      return res.json({
        success: false,
        message: `Playlist can only contain ${MAX_PLAYLIST_SONGS} songs or less`,
      });
    }

    const receiver = await User.findById(receiverId).select(
      "username name email"
    );

    if (!receiver) {
      return res.json({
        success: false,
        message: "Receiver not found",
      });
    }

    const share = await PlaylistShare.findOneAndUpdate(
      {
        playlist: playlist._id,
        fromUser,
        toUser: receiverId,
      },
      {
        $set: {
          message: String(message || "").trim().slice(0, 300),
          status: "active",
          readAt: null,
        },
        $setOnInsert: {
          playlist: playlist._id,
          fromUser,
          toUser: receiverId,
        },
      },
      {
        new: true,
        upsert: true,
      }
    );

    await updatePlaylistSharesCount(playlist._id);

const sender = await User.findById(fromUser).select("username name email");

const senderName =
  sender?.username || sender?.name || sender?.email || "Someone";

await createNotificationForUser({
  user: receiverId,
  fromUser,
  type: "playlist_shared",
  title: "New playlist shared",
  message: `${senderName} shared "${playlist.name}" with you`,
  link: "/playlist",
  relatedPlaylist: playlist._id,
  relatedShare: share._id,
  dedupeKey: `playlist_shared:${playlist._id}:${fromUser}:${receiverId}`,
});

const populatedShare = await populateShare(
  PlaylistShare.findById(share._id)
);

    return res.json({
      success: true,
      message: `Playlist sent to ${
        receiver.username || receiver.name || receiver.email
      }`,
      share: populatedShare,
    });
  } catch (error) {
    console.log("Share playlist to user error:", error);

    return res.json({
      success: false,
      message: error.message,
    });
  }
};

export const getReceivedPlaylistShares = async (req, res) => {
  try {
    const shares = await populateShare(
      PlaylistShare.find({
        toUser: req.userId,
        status: "active",
      }).sort({ createdAt: -1 })
    );

    const cleanShares = shares.filter((share) => {
      return (
        share.playlist &&
        Array.isArray(share.playlist.songs) &&
        share.playlist.songs.length <= MAX_PLAYLIST_SONGS
      );
    });

    return res.json({
      success: true,
      shares: cleanShares,
    });
  } catch (error) {
    console.log("Get received playlist shares error:", error);

    return res.json({
      success: false,
      message: error.message,
    });
  }
};

export const getSentPlaylistShares = async (req, res) => {
  try {
    const shares = await populateShare(
      PlaylistShare.find({
        fromUser: req.userId,
        status: "active",
      }).sort({ createdAt: -1 })
    );

    return res.json({
      success: true,
      shares,
    });
  } catch (error) {
    console.log("Get sent playlist shares error:", error);

    return res.json({
      success: false,
      message: error.message,
    });
  }
};

export const markPlaylistShareRead = async (req, res) => {
  try {
    const { shareId } = req.params;

    const share = await PlaylistShare.findOneAndUpdate(
      {
        _id: shareId,
        toUser: req.userId,
        status: "active",
      },
      {
        $set: {
          readAt: new Date(),
        },
      },
      {
        new: true,
      }
    );

    if (!share) {
      return res.json({
        success: false,
        message: "Shared playlist not found",
      });
    }

    return res.json({
      success: true,
      message: "Marked as read",
      share,
    });
  } catch (error) {
    console.log("Mark playlist share read error:", error);

    return res.json({
      success: false,
      message: error.message,
    });
  }
};

export const removeReceivedPlaylistShare = async (req, res) => {
  try {
    const { shareId } = req.params;

    const share = await PlaylistShare.findOneAndUpdate(
      {
        _id: shareId,
        toUser: req.userId,
        status: "active",
      },
      {
        $set: {
          status: "removed",
        },
      },
      {
        new: true,
      }
    );

    if (!share) {
      return res.json({
        success: false,
        message: "Shared playlist not found",
      });
    }

    await updatePlaylistSharesCount(share.playlist);

    return res.json({
      success: true,
      message: "Shared playlist removed",
    });
  } catch (error) {
    console.log("Remove received playlist share error:", error);

    return res.json({
      success: false,
      message: error.message,
    });
  }
};

export const revokePlaylistShare = async (req, res) => {
  try {
    const { shareId } = req.params;

    const share = await PlaylistShare.findOneAndUpdate(
      {
        _id: shareId,
        fromUser: req.userId,
        status: "active",
      },
      {
        $set: {
          status: "revoked",
        },
      },
      {
        new: true,
      }
    );

    if (!share) {
      return res.json({
        success: false,
        message: "Share not found",
      });
    }

    await updatePlaylistSharesCount(share.playlist);

    return res.json({
      success: true,
      message: "Playlist share revoked",
    });
  } catch (error) {
    console.log("Revoke playlist share error:", error);

    return res.json({
      success: false,
      message: error.message,
    });
  }
};