import { applySongPreferenceSignal } from "../utils/preferencesHelper.js";
import User from "../models/userModel.js";
import Song from "../models/uploadSongModel.js";
import { createNotificationForUser } from "./notificationController.js";
import { getAudiusTrack } from "../services/audiusService.js";

const randomHoursFromNow = (minHours, maxHours) => {
  const min = Math.max(1, Number(minHours || 1));
  const max = Math.max(min, Number(maxHours || min));
  return new Date(Date.now() + (min + Math.random() * (max - min)) * 60 * 60 * 1000);
};

const safeText = (value, max = 240) => String(value || "").trim().slice(0, max);
const safeNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const safeExternalSong = (song = {}, externalId = "") => ({
  _id: `audius_${safeText(externalId || song.externalId, 80).replace(/^audius_/, "")}`,
  id: `audius_${safeText(externalId || song.externalId, 80).replace(/^audius_/, "")}`,
  source: "audius",
  externalSource: "audius",
  externalId: safeText(externalId || song.externalId, 80).replace(/^audius_/, ""),
  isExternal: true,
  isStreamable: song.isStreamable !== false,
  title: safeText(song.title, 180) || "Untitled",
  imageUrl: safeText(song.imageUrl, 1200),
  audioUrl: `/api/audius/stream/${encodeURIComponent(safeText(externalId || song.externalId, 80).replace(/^audius_/, ""))}`,
  genre: safeText(song.genre, 80) || "Unknown",
  mood: safeText(song.mood, 80) || "Unknown",
  duration: safeNumber(song.duration),
  plays: safeNumber(song.plays),
  likes: safeNumber(song.likes),
  releaseDate: song.releaseDate || null,
  releaseYear: safeNumber(song.releaseYear) || undefined,
  artist: song.artist ? {
    _id: safeText(song.artist._id, 120), externalId: safeText(song.artist.externalId, 80),
    name: safeText(song.artist.name, 160) || "Audius Artist", handle: safeText(song.artist.handle, 120),
    imageUrl: safeText(song.artist.imageUrl || song.artist.image, 1200), image: safeText(song.artist.image || song.artist.imageUrl, 1200),
    verified: Boolean(song.artist.verified), source: "audius", externalSource: "audius", isExternal: true,
  } : null,
  album: song.album ? {
    _id: safeText(song.album._id, 160), externalId: safeText(song.album.externalId, 100),
    title: safeText(song.album.title || song.album.name, 180), name: safeText(song.album.name || song.album.title, 180),
    imageUrl: safeText(song.album.imageUrl || song.album.coverImage, 1200), coverImage: safeText(song.album.coverImage || song.album.imageUrl, 1200),
    source: "audius", externalSource: "audius", isExternal: true, isAlbum: true,
  } : null,
});

const maybeSendReplayNotification = async (user) => {
  if (!user?._id) return;
  const now = new Date();
  const nextAt = user.notificationCadence?.replayNextAt ? new Date(user.notificationCadence.replayNextAt) : null;
  if (!nextAt || Number.isNaN(nextAt.getTime())) {
    await User.updateOne({ _id: user._id, "notificationCadence.replayNextAt": null }, { $set: { "notificationCadence.replayNextAt": randomHoursFromNow(42, 84) } });
    return;
  }
  if (nextAt.getTime() > now.getTime()) return;
  const ranked = [...(user.preferences?.songs || [])].filter((item) => item?.song && Number(item?.score || 0) > 0).sort((a,b)=>Number(b?.score||0)-Number(a?.score||0)).slice(0,5);
  const nextWindow = randomHoursFromNow(42, 84);
  if (!ranked.length || Math.random() >= 0.48) {
    await User.updateOne({ _id: user._id, "notificationCadence.replayNextAt": { $lte: now } }, { $set: { "notificationCadence.replayNextAt": nextWindow } });
    return;
  }
  const lastSongId = String(user.notificationCadence?.replayLastSong || "");
  const pool = ranked.filter((item) => String(item.song) !== lastSongId);
  const choices = pool.length ? pool : ranked;
  const pick = choices[Math.floor(Math.random() * Math.min(3, choices.length))];
  const song = pick?.song ? await Song.findById(pick.song).select("title").lean() : null;
  if (!song) return;
  const claimed = await User.updateOne({ _id: user._id, "notificationCadence.replayNextAt": { $lte: now } }, { $set: { "notificationCadence.replayNextAt": nextWindow, "notificationCadence.replayLastAt": now, "notificationCadence.replayLastSong": song._id } });
  if (!claimed.modifiedCount) return;
  await createNotificationForUser({ user: user._id, type: "replay_for_you", title: "A SoundWave replay for you", message: `${song.title} has been one of your most-played songs lately. Tap to play it again.`, link: `/song/${song._id}`, relatedSong: song._id });
};

export const addToHistory = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const source = String(req.body?.source || "soundwave").toLowerCase();
    if (source === "audius") {
      const externalId = String(req.body?.externalId || req.body?.song?.externalId || req.body?.songId || "").replace(/^audius_/, "").trim();
      if (!externalId) return res.status(400).json({ success: false, message: "Audius track ID is required" });
      let snapshot = null;
      try { snapshot = await getAudiusTrack(externalId); } catch { snapshot = safeExternalSong(req.body?.song || {}, externalId); }
      snapshot = safeExternalSong(snapshot || req.body?.song || {}, externalId);
      user.history = user.history.filter((item) => !(item.source === "audius" && item.externalId === externalId));
      user.history.unshift({ song: null, source: "audius", externalId, externalSong: snapshot, playedAt: new Date() });
      user.history = user.history.slice(0, 50);
      await user.save();
      return res.json({ success: true, message: "Added Audius track to history" });
    }

    const songId = req.body?.songId;
    if (!songId) return res.status(400).json({ success: false, message: "Song ID is required" });
    const song = await Song.findById(songId).select("genre mood artist album country songLanguage releaseYear");
    if (!song) return res.status(404).json({ success: false, message: "Song not found" });
    user.history = user.history.filter((item) => String(item.song || "") !== songId);
    user.history.unshift({ song: songId, source: "soundwave", playedAt: new Date() });
    user.history = user.history.slice(0, 50);
    applySongPreferenceSignal(user, song, 0.25);
    await user.save();
    await maybeSendReplayNotification(user).catch((error) => console.warn("Replay notification skipped:", error?.message || error));
    return res.json({ success: true, message: "Added to history" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getHistory = async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate({ path: "history.song", populate: [{ path: "artist" }, { path: "album" }] });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    const history = (user.history || []).map((entry) => {
      const item = entry.toObject ? entry.toObject() : entry;
      if (item.source === "audius" && item.externalSong) return { ...item, song: item.externalSong };
      return item;
    }).filter((item) => item?.song);
    return res.json({ success: true, history });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
