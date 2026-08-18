import { applySongPreferenceSignal } from "../utils/preferencesHelper.js";
import User from "../models/userModel.js";
import Song from "../models/uploadSongModel.js";
import { createNotificationForUser } from "./notificationController.js";

const randomHoursFromNow = (minHours, maxHours) => {
  const min = Math.max(1, Number(minHours || 1));
  const max = Math.max(min, Number(maxHours || min));
  const hours = min + Math.random() * (max - min);
  return new Date(Date.now() + hours * 60 * 60 * 1000);
};

const maybeSendReplayNotification = async (user) => {
  if (!user?._id) return;
  const now = new Date();
  const nextAt = user.notificationCadence?.replayNextAt
    ? new Date(user.notificationCadence.replayNextAt)
    : null;

  // First encounter only schedules a future opportunity. Nothing is sent
  // immediately, so this feature can never become a per-play interruption.
  if (!nextAt || Number.isNaN(nextAt.getTime())) {
    await User.updateOne(
      { _id: user._id, "notificationCadence.replayNextAt": null },
      { $set: { "notificationCadence.replayNextAt": randomHoursFromNow(42, 84) } }
    );
    return;
  }

  if (nextAt.getTime() > now.getTime()) return;

  const ranked = [...(user.preferences?.songs || [])]
    .filter((item) => item?.song && Number(item?.score || 0) > 0)
    .sort((a, b) => Number(b?.score || 0) - Number(a?.score || 0))
    .slice(0, 5);

  // If listening history is still too young, simply schedule another distant
  // check rather than manufacturing a recommendation.
  if (!ranked.length) {
    await User.updateOne(
      { _id: user._id, "notificationCadence.replayNextAt": { $lte: now } },
      { $set: { "notificationCadence.replayNextAt": randomHoursFromNow(42, 84) } }
    );
    return;
  }

  // Many eligible windows intentionally produce nothing. This keeps the replay
  // nudge rare and irregular instead of turning it into a daily notification.
  const shouldSend = Math.random() < 0.48;
  const nextWindow = randomHoursFromNow(42, 84);
  if (!shouldSend) {
    await User.updateOne(
      { _id: user._id, "notificationCadence.replayNextAt": { $lte: now } },
      { $set: { "notificationCadence.replayNextAt": nextWindow } }
    );
    return;
  }

  // Prefer a genuinely strong preference while allowing slight variation among
  // the top few tracks. Avoid immediately repeating the last replay suggestion.
  const lastSongId = String(user.notificationCadence?.replayLastSong || "");
  const pool = ranked.filter((item) => String(item.song) !== lastSongId);
  const choices = pool.length ? pool : ranked;
  const pick = choices[Math.floor(Math.random() * Math.min(3, choices.length))];
  const song = pick?.song ? await Song.findById(pick.song).select("title").lean() : null;
  if (!song) {
    await User.updateOne(
      { _id: user._id, "notificationCadence.replayNextAt": { $lte: now } },
      { $set: { "notificationCadence.replayNextAt": nextWindow } }
    );
    return;
  }

  // Atomically claim this eligible window before creating the notification. If
  // two playback events race, only one of them is allowed to send.
  const claimed = await User.updateOne(
    { _id: user._id, "notificationCadence.replayNextAt": { $lte: now } },
    {
      $set: {
        "notificationCadence.replayNextAt": nextWindow,
        "notificationCadence.replayLastAt": now,
        "notificationCadence.replayLastSong": song._id,
      },
    }
  );
  if (!claimed.modifiedCount) return;

  await createNotificationForUser({
    user: user._id,
    type: "replay_for_you",
    title: "A SoundWave replay for you",
    message: `${song.title} has been one of your most-played songs lately. Tap to play it again.`,
    link: `/song/${song._id}`,
    relatedSong: song._id,
  });
};

export const addToHistory = async (req, res) => {
  try {
    const userId = req.userId;
    const { songId } = req.body;

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
      "genre mood artist album country songLanguage releaseYear"
    );

    if (!song) {
      return res.status(404).json({
        success: false,
        message: "Song not found",
      });
    }

    user.history = user.history.filter(
      (item) => item.song.toString() !== songId
    );

    user.history.unshift({
      song: songId,
      playedAt: new Date(),
    });

    user.history = user.history.slice(0, 50);

    // Starting a track is intentionally a weak signal. Stronger personalization
    // comes from actual listen duration, completion, repeats, likes and saves.
    applySongPreferenceSignal(user, song, 0.25);

    await user.save();
    await maybeSendReplayNotification(user).catch((error) => {
      console.warn("Replay notification skipped:", error?.message || error);
    });

    return res.json({
      success: true,
      message: "Added to history",
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
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

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      history: user.history,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};