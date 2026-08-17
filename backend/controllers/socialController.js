import crypto from "crypto";
import mongoose from "mongoose";
import User from "../models/userModel.js";
import Song from "../models/uploadSongModel.js";
import Circle from "../models/circleModel.js";
import SongMoment from "../models/songMomentModel.js";
import DailyPick from "../models/dailyPickModel.js";
import LiveRoom from "../models/liveRoomModel.js";
import SocialActivity from "../models/socialActivityModel.js";
import { createNotificationForUser } from "./notificationController.js";
import { getUserRecommendationProfile, rankSongsForUser } from "../utils/recommendationHelper.js";

const id = (value) => String(value?._id || value || "");
const validId = (value) => mongoose.isValidObjectId(value);
const todayKey = () => new Date().toISOString().slice(0, 10);
const randomCode = (length = 7) => crypto.randomBytes(8).toString("base64url").replace(/[-_]/g, "").slice(0, length).toUpperCase();

const publicUser = (user, viewerId = "") => {
  if (!user) return null;
  const raw = typeof user.toObject === "function" ? user.toObject() : user;
  return {
    _id: raw._id,
    username: raw.username || raw.name || "SoundWave listener",
    name: raw.name || raw.username || "SoundWave listener",
    image: raw.image || "",
    bio: raw.bio || "",
    followersCount: Array.isArray(raw.followers) ? raw.followers.length : 0,
    followingCount: Array.isArray(raw.followingUsers) ? raw.followingUsers.length : 0,
    isFollowing: viewerId ? (raw.followers || []).some((item) => id(item) === id(viewerId)) : false,
    socialSettings: raw.socialSettings || {},
  };
};

const sanitizeMoment = (moment, viewerId = "") => {
  const raw = typeof moment?.toObject === "function" ? moment.toObject() : moment;
  if (!raw) return null;
  return {
    ...raw,
    likes: (raw.likedBy || []).length,
    liked: viewerId ? (raw.likedBy || []).some((item) => id(item) === id(viewerId)) : false,
    likedBy: undefined,
  };
};

const preferenceVector = (user) => {
  const profile = getUserRecommendationProfile(user);
  const map = new Map();
  const add = (prefix, list, key) => {
    (list || []).slice(0, 12).forEach((item) => {
      const value = id(item?.[key]) || String(item?.[key] ?? "").trim().toLowerCase();
      if (!value) return;
      map.set(`${prefix}:${value}`, Math.max(0, Number(item.effectiveScore ?? item.score ?? 0)));
    });
  };
  add("genre", profile.genres, "name");
  add("mood", profile.moods, "name");
  add("language", profile.languages, "name");
  add("artist", profile.artists, "artist");
  add("album", profile.albums, "album");
  add("song", profile.songs, "song");
  return { map, profile };
};

const cosineMatch = (a, b) => {
  let dot = 0;
  let aa = 0;
  let bb = 0;
  const keys = new Set([...a.keys(), ...b.keys()]);
  keys.forEach((key) => {
    const x = Number(a.get(key) || 0);
    const y = Number(b.get(key) || 0);
    dot += x * y;
    aa += x * x;
    bb += y * y;
  });
  if (!aa || !bb) return 0;
  return Math.max(0, Math.min(100, Math.round((dot / Math.sqrt(aa * bb)) * 100)));
};

const memberOfCircle = (circle, userId) =>
  id(circle?.owner) === id(userId) || (circle?.members || []).some((member) => id(member.user) === id(userId));

const memberOfRoom = (room, userId) =>
  id(room?.host) === id(userId) || (room?.members || []).some((member) => id(member.user) === id(userId));

export const getSocialHome = async (req, res) => {
  try {
    const me = await User.findById(req.userId).select("username name image bio followingUsers followers preferences socialSettings");
    if (!me) return res.status(404).json({ success: false, message: "User not found" });

    const followingIds = (me.followingUsers || []).map(id).filter(Boolean);
    const [circles, picks, feed, suggestions, following, rooms] = await Promise.all([
      Circle.find({ $or: [{ owner: me._id }, { "members.user": me._id }] })
        .sort({ updatedAt: -1 }).limit(8).select("name description owner members inviteCode updatedAt"),
      DailyPick.find({ user: { $in: [me._id, ...followingIds] }, dayKey: todayKey() })
        .sort({ createdAt: -1 }).limit(20)
        .populate("user", "username name image")
        .populate({ path: "song", populate: [{ path: "artist" }, { path: "album" }] }),
      SocialActivity.find({ actor: { $in: [me._id, ...followingIds] } })
        .sort({ createdAt: -1 }).limit(24)
        .populate("actor", "username name image")
        .populate({ path: "song", populate: [{ path: "artist" }, { path: "album" }] })
        .populate("targetUser", "username name image")
        .populate("circle", "name")
        .populate("room", "name code"),
      User.find({ _id: { $nin: [me._id, ...followingIds] } })
        .select("username name image bio followers followingUsers preferences socialSettings")
        .sort({ createdAt: -1 }).limit(18),
      User.find({ _id: { $in: followingIds } })
        .select("username name image bio followers followingUsers preferences socialSettings")
        .limit(40),
      LiveRoom.find({ status: "active", $or: [{ host: me._id }, { "members.user": me._id }] })
        .sort({ lastActiveAt: -1 }).limit(6).select("name code host members currentSong lastActiveAt"),
    ]);

    const mine = preferenceVector(me).map;
    const rankedSuggestions = suggestions
      .filter((user) => user.socialSettings?.publicProfile !== false)
      .map((user) => ({ ...publicUser(user, me._id), tasteMatch: cosineMatch(mine, preferenceVector(user).map) }))
      .sort((a, b) => b.tasteMatch - a.tasteMatch)
      .slice(0, 8);

    return res.json({
      success: true,
      me: publicUser(me, me._id),
      circles,
      dailyPicks: picks,
      feed,
      people: rankedSuggestions,
      following: following.map((user) => ({ ...publicUser(user, me._id), tasteMatch: cosineMatch(mine, preferenceVector(user).map) })).sort((a, b) => b.tasteMatch - a.tasteMatch),
      rooms,
    });
  } catch (error) {
    console.error("Social home error:", error);
    return res.status(500).json({ success: false, message: "Could not load social home" });
  }
};

export const searchUsers = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) return res.json({ success: true, users: [] });
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const users = await User.find({
      _id: { $ne: req.userId },
      $or: [{ username: { $regex: escaped, $options: "i" } }, { name: { $regex: escaped, $options: "i" } }],
    })
      .select("username name image bio followers followingUsers socialSettings preferences")
      .limit(12);
    const me = await User.findById(req.userId).select("preferences");
    const mine = preferenceVector(me).map;
    return res.json({ success: true, users: users.filter((u) => u.socialSettings?.publicProfile !== false).map((u) => ({ ...publicUser(u, req.userId), tasteMatch: cosineMatch(mine, preferenceVector(u).map) })) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not search listeners" });
  }
};

export const getPublicProfile = async (req, res) => {
  try {
    if (!validId(req.params.userId)) return res.status(400).json({ success: false, message: "Invalid user" });
    const user = await User.findById(req.params.userId)
      .select("username name image bio followers followingUsers likedSongs followedArtists history preferences socialSettings")
      .populate("followedArtists", "name image")
      .populate({ path: "history.song", populate: [{ path: "artist" }, { path: "album" }] });
    if (!user || (user.socialSettings?.publicProfile === false && id(user._id) !== id(req.userId))) {
      return res.status(404).json({ success: false, message: "Profile not available" });
    }
    const profile = getUserRecommendationProfile(user);
    const listening = user.socialSettings?.listeningActivity || id(user._id) === id(req.userId)
      ? (user.history || []).slice(0, 8).map((item) => item.song).filter(Boolean)
      : [];
    return res.json({
      success: true,
      user: publicUser(user, req.userId),
      topGenres: profile.topGenres.slice(0, 5),
      topLanguages: profile.topLanguages.slice(0, 4),
      topArtists: (user.followedArtists || []).slice(0, 8),
      recentlyPlayed: listening,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not load profile" });
  }
};

export const updateSocialProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (typeof req.body.bio === "string") user.bio = req.body.bio.trim().slice(0, 180);
    user.socialSettings = user.socialSettings || {};
    ["publicProfile", "listeningActivity", "allowTasteMatch"].forEach((key) => {
      if (typeof req.body[key] === "boolean") user.socialSettings[key] = req.body[key];
    });
    await user.save();
    return res.json({ success: true, user: publicUser(user, req.userId) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not update social profile" });
  }
};

export const toggleFollowUser = async (req, res) => {
  try {
    const targetId = req.params.userId;
    if (!validId(targetId) || id(targetId) === id(req.userId)) return res.status(400).json({ success: false, message: "Invalid listener" });
    const [me, target] = await Promise.all([User.findById(req.userId), User.findById(targetId)]);
    if (!me || !target) return res.status(404).json({ success: false, message: "Listener not found" });
    const index = (me.followingUsers || []).findIndex((item) => id(item) === id(targetId));
    let following = false;
    if (index >= 0) {
      me.followingUsers.splice(index, 1);
      target.followers = (target.followers || []).filter((item) => id(item) !== id(me._id));
    } else {
      me.followingUsers.push(target._id);
      if (!(target.followers || []).some((item) => id(item) === id(me._id))) target.followers.push(me._id);
      following = true;
    }
    await Promise.all([me.save(), target.save()]);
    if (following) {
      await Promise.allSettled([
        SocialActivity.create({ actor: me._id, type: "follow", targetUser: target._id }),
        createNotificationForUser({ user: target._id, fromUser: me._id, type: "user_followed", title: `${me.username || me.name || "Someone"} followed you`, message: "Your music network just grew.", link: `/u/${me._id}`, dedupeKey: `follow:${me._id}:${target._id}` }),
      ]);
    }
    return res.json({ success: true, following, followersCount: target.followers.length });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not update follow" });
  }
};

export const getTasteMatch = async (req, res) => {
  try {
    const [me, other] = await Promise.all([
      User.findById(req.userId).select("preferences socialSettings username name"),
      User.findById(req.params.userId).select("preferences socialSettings username name"),
    ]);
    if (!me || !other) return res.status(404).json({ success: false, message: "Listener not found" });
    if (other.socialSettings?.allowTasteMatch === false) return res.status(403).json({ success: false, message: "Taste Match is private" });
    const mine = preferenceVector(me);
    const theirs = preferenceVector(other);
    const score = cosineMatch(mine.map, theirs.map);
    const overlap = {
      genres: mine.profile.topGenres.filter((x) => theirs.profile.topGenres.includes(x)).slice(0, 5),
      languages: mine.profile.topLanguages.filter((x) => theirs.profile.topLanguages.includes(x)).slice(0, 4),
    };
    return res.json({ success: true, score, overlap, user: { _id: other._id, username: other.username || other.name } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not calculate Taste Match" });
  }
};

export const setDailyPick = async (req, res) => {
  try {
    const songId = req.body.songId;
    if (!validId(songId) || !(await Song.exists({ _id: songId }))) return res.status(404).json({ success: false, message: "Song not found" });
    const note = String(req.body.note || "").trim().slice(0, 180);
    const dayKey = todayKey();
    const pick = await DailyPick.findOneAndUpdate(
      { user: req.userId, dayKey },
      { $set: { song: songId, note, user: req.userId, dayKey } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).populate("user", "username name image").populate({ path: "song", populate: [{ path: "artist" }, { path: "album" }] });
    await SocialActivity.create({ actor: req.userId, type: "daily_pick", song: songId, note }).catch(() => null);
    const me = await User.findById(req.userId).select("followers username name");
    const followers = (me?.followers || []).slice(0, 40);
    await Promise.allSettled(followers.map((follower) => createNotificationForUser({ user: follower, fromUser: req.userId, type: "daily_pick", title: `${me.username || me.name || "A friend"} picked a song today`, message: note || "Tap to listen.", link: `/song/${songId}`, relatedSong: songId, dedupeKey: `daily:${dayKey}:${req.userId}:${follower}` })));
    return res.json({ success: true, pick });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not save today's song" });
  }
};

export const getDailyPicks = async (req, res) => {
  try {
    const me = await User.findById(req.userId).select("followingUsers");
    const users = [req.userId, ...(me?.followingUsers || [])];
    const picks = await DailyPick.find({ user: { $in: users }, dayKey: todayKey() }).sort({ createdAt: -1 }).limit(40)
      .populate("user", "username name image")
      .populate({ path: "song", populate: [{ path: "artist" }, { path: "album" }] });
    return res.json({ success: true, picks });
  } catch (error) { return res.status(500).json({ success: false, message: "Could not load daily picks" }); }
};

export const createCircle = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim().slice(0, 60);
    if (name.length < 2) return res.status(400).json({ success: false, message: "Circle name is too short" });
    let inviteCode = randomCode();
    while (await Circle.exists({ inviteCode })) inviteCode = randomCode();
    const circle = await Circle.create({ name, description: String(req.body.description || "").trim().slice(0, 220), owner: req.userId, inviteCode, members: [{ user: req.userId, role: "owner" }] });
    await SocialActivity.create({ actor: req.userId, type: "circle_created", circle: circle._id }).catch(() => null);
    return res.status(201).json({ success: true, circle });
  } catch (error) { return res.status(500).json({ success: false, message: "Could not create Circle" }); }
};

export const listCircles = async (req, res) => {
  try {
    const circles = await Circle.find({ $or: [{ owner: req.userId }, { "members.user": req.userId }] }).sort({ updatedAt: -1 }).limit(30).populate("owner", "username name image").populate("members.user", "username name image");
    return res.json({ success: true, circles });
  } catch (error) { return res.status(500).json({ success: false, message: "Could not load Circles" }); }
};

export const getCircle = async (req, res) => {
  try {
    const circle = await Circle.findById(req.params.circleId).populate("owner", "username name image").populate("members.user", "username name image").populate({ path: "songs.song", populate: [{ path: "artist" }, { path: "album" }] }).populate("songs.addedBy", "username name image");
    if (!circle || !memberOfCircle(circle, req.userId)) return res.status(404).json({ success: false, message: "Circle not found" });
    return res.json({ success: true, circle });
  } catch (error) { return res.status(500).json({ success: false, message: "Could not load Circle" }); }
};

export const joinCircle = async (req, res) => {
  try {
    const code = String(req.body.code || "").trim().toUpperCase();
    const circle = await Circle.findOne({ inviteCode: code });
    if (!circle) return res.status(404).json({ success: false, message: "Invite code not found" });
    if (!memberOfCircle(circle, req.userId)) circle.members.push({ user: req.userId, role: "member" });
    await circle.save();
    return res.json({ success: true, circleId: circle._id });
  } catch (error) { return res.status(500).json({ success: false, message: "Could not join Circle" }); }
};

export const leaveCircle = async (req, res) => {
  try {
    const circle = await Circle.findById(req.params.circleId);
    if (!circle) return res.status(404).json({ success: false, message: "Circle not found" });
    if (id(circle.owner) === id(req.userId)) return res.status(400).json({ success: false, message: "Circle owner cannot leave. Delete the Circle later or transfer ownership." });
    circle.members = circle.members.filter((member) => id(member.user) !== id(req.userId));
    await circle.save();
    return res.json({ success: true });
  } catch (error) { return res.status(500).json({ success: false, message: "Could not leave Circle" }); }
};

export const addCircleSong = async (req, res) => {
  try {
    const circle = await Circle.findById(req.params.circleId);
    if (!circle || !memberOfCircle(circle, req.userId)) return res.status(404).json({ success: false, message: "Circle not found" });
    const songId = req.body.songId;
    if (!validId(songId) || !(await Song.exists({ _id: songId }))) return res.status(404).json({ success: false, message: "Song not found" });
    circle.songs.unshift({ song: songId, addedBy: req.userId, note: String(req.body.note || "").trim().slice(0, 220) });
    circle.songs = circle.songs.slice(0, 120);
    await circle.save();
    await SocialActivity.create({ actor: req.userId, type: "circle_song", song: songId, circle: circle._id, note: String(req.body.note || "").trim().slice(0, 220) }).catch(() => null);
    const actor = await User.findById(req.userId).select("username name").lean();
    const actorName = actor?.username || actor?.name || "Someone";
    const recipients = (circle.members || []).map((member) => member.user).filter((userId) => id(userId) !== id(req.userId)).slice(0, 40);
    await Promise.allSettled(recipients.map((userId) => createNotificationForUser({
      user: userId, fromUser: req.userId, type: "circle_activity",
      title: `${actorName} added a song to ${circle.name}`,
      message: String(req.body.note || "Tap to listen with your Circle.").slice(0, 120),
      link: `/social/circles/${circle._id}`, relatedSong: songId,
      dedupeKey: `circle-song:${circle._id}:${songId}:${req.userId}:${userId}`,
    })));
    return res.json({ success: true });
  } catch (error) { return res.status(500).json({ success: false, message: "Could not add song to Circle" }); }
};

export const getSongMoments = async (req, res) => {
  try {
    const moments = await SongMoment.find({ song: req.params.songId }).sort({ momentAt: 1, createdAt: -1 }).limit(80)
      .populate("user", "username name image").populate("replies.user", "username name image");
    return res.json({ success: true, moments: moments.map((moment) => sanitizeMoment(moment, req.userId)) });
  } catch (error) { return res.status(500).json({ success: false, message: "Could not load song moments" }); }
};

export const createSongMoment = async (req, res) => {
  try {
    const momentAt = Math.max(0, Number(req.body.momentAt || 0));
    const body = String(req.body.body || "").trim().slice(0, 320);
    const emoji = String(req.body.emoji || "🎵").trim().slice(0, 12);
    if (!validId(req.params.songId) || !(await Song.exists({ _id: req.params.songId }))) return res.status(404).json({ success: false, message: "Song not found" });
    if (!body && !emoji) return res.status(400).json({ success: false, message: "Add a reaction or note" });
    const moment = await SongMoment.create({ song: req.params.songId, user: req.userId, momentAt, body, emoji });
    await SocialActivity.create({ actor: req.userId, type: "song_moment", song: req.params.songId, note: body, momentAt }).catch(() => null);
    const populated = await SongMoment.findById(moment._id).populate("user", "username name image");
    return res.status(201).json({ success: true, moment: sanitizeMoment(populated, req.userId) });
  } catch (error) { return res.status(500).json({ success: false, message: "Could not post song moment" }); }
};

export const toggleSongMomentLike = async (req, res) => {
  try {
    const moment = await SongMoment.findById(req.params.momentId);
    if (!moment) return res.status(404).json({ success: false, message: "Moment not found" });
    const index = moment.likedBy.findIndex((item) => id(item) === id(req.userId));
    let liked = false;
    if (index >= 0) moment.likedBy.splice(index, 1); else { moment.likedBy.push(req.userId); liked = true; }
    await moment.save();
    if (liked && id(moment.user) !== id(req.userId)) {
      const actor = await User.findById(req.userId).select("username name").lean();
      const actorName = actor?.username || actor?.name || "Someone";
      await createNotificationForUser({
        user: moment.user, fromUser: req.userId, type: "song_moment_like",
        title: `${actorName} liked your song moment`,
        message: String(moment.body || moment.emoji || "Music moment").slice(0, 110),
        link: `/song/${moment.song}`, relatedSong: moment.song,
        dedupeKey: `moment-like:${moment._id}:${req.userId}`,
      }).catch(() => null);
    }
    return res.json({ success: true, liked, likes: moment.likedBy.length });
  } catch (error) { return res.status(500).json({ success: false, message: "Could not react" }); }
};

export const replySongMoment = async (req, res) => {
  try {
    const body = String(req.body.body || "").trim().slice(0, 300);
    if (!body) return res.status(400).json({ success: false, message: "Write a reply" });
    const moment = await SongMoment.findById(req.params.momentId);
    if (!moment) return res.status(404).json({ success: false, message: "Moment not found" });
    moment.replies.push({ user: req.userId, body });
    await moment.save();
    if (id(moment.user) !== id(req.userId)) {
      const actor = await User.findById(req.userId).select("username name").lean();
      const actorName = actor?.username || actor?.name || "Someone";
      await createNotificationForUser({ user: moment.user, fromUser: req.userId, type: "song_moment", title: `${actorName} replied to your song moment`, message: body.slice(0, 100), link: `/song/${moment.song}`, relatedSong: moment.song, dedupeKey: `moment-reply:${moment._id}:${req.userId}:${moment.replies.length}` });
    }
    return res.json({ success: true });
  } catch (error) { return res.status(500).json({ success: false, message: "Could not reply" }); }
};

export const getDiscoveryTrail = async (req, res) => {
  try {
    const me = await User.findById(req.userId).select("followingUsers");
    const followed = [req.userId, ...(me?.followingUsers || [])];
    const trail = await SocialActivity.find({ song: req.params.songId, actor: { $in: followed }, type: { $in: ["daily_pick", "song_moment", "circle_song"] } }).sort({ createdAt: -1 }).limit(12).populate("actor", "username name image").populate("circle", "name");
    return res.json({ success: true, trail });
  } catch (error) { return res.status(500).json({ success: false, message: "Could not load discovery trail" }); }
};

export const createLiveRoom = async (req, res) => {
  try {
    const name = String(req.body.name || "Pass the Aux").trim().slice(0, 70) || "Pass the Aux";
    let code = randomCode(6);
    while (await LiveRoom.exists({ code })) code = randomCode(6);
    const room = await LiveRoom.create({ name, host: req.userId, code, members: [{ user: req.userId }], lastActiveAt: new Date() });
    await SocialActivity.create({ actor: req.userId, type: "room_created", room: room._id }).catch(() => null);
    return res.status(201).json({ success: true, room });
  } catch (error) { return res.status(500).json({ success: false, message: "Could not create room" }); }
};

export const joinLiveRoom = async (req, res) => {
  try {
    const code = String(req.body.code || "").trim().toUpperCase();
    const room = await LiveRoom.findOne({ code, status: "active" });
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });
    if (!memberOfRoom(room, req.userId)) room.members.push({ user: req.userId });
    room.lastActiveAt = new Date();
    await room.save();
    return res.json({ success: true, code: room.code });
  } catch (error) { return res.status(500).json({ success: false, message: "Could not join room" }); }
};

export const getLiveRoom = async (req, res) => {
  try {
    const room = await LiveRoom.findOne({ code: String(req.params.code || "").toUpperCase(), status: "active" })
      .populate("host", "username name image").populate("members.user", "username name image")
      .populate({ path: "queue.song", populate: [{ path: "artist" }, { path: "album" }] })
      .populate("queue.addedBy", "username name image")
      .populate({ path: "currentSong", populate: [{ path: "artist" }, { path: "album" }] });
    if (!room || !memberOfRoom(room, req.userId)) return res.status(404).json({ success: false, message: "Room not found" });
    return res.json({ success: true, room });
  } catch (error) { return res.status(500).json({ success: false, message: "Could not load room" }); }
};

export const addLiveRoomSong = async (req, res) => {
  try {
    const room = await LiveRoom.findOne({ code: String(req.params.code || "").toUpperCase(), status: "active" });
    if (!room || !memberOfRoom(room, req.userId)) return res.status(404).json({ success: false, message: "Room not found" });
    const songId = req.body.songId;
    if (!validId(songId) || !(await Song.exists({ _id: songId }))) return res.status(404).json({ success: false, message: "Song not found" });
    if (!room.queue.some((entry) => !entry.played && id(entry.song) === id(songId))) room.queue.push({ song: songId, addedBy: req.userId, votes: [req.userId] });
    room.lastActiveAt = new Date();
    await room.save();
    return res.json({ success: true });
  } catch (error) { return res.status(500).json({ success: false, message: "Could not update room queue" }); }
};

export const voteLiveRoomSong = async (req, res) => {
  try {
    const room = await LiveRoom.findOne({ code: String(req.params.code || "").toUpperCase(), status: "active" });
    if (!room || !memberOfRoom(room, req.userId)) return res.status(404).json({ success: false, message: "Room not found" });
    const entry = room.queue.id(req.params.entryId);
    if (!entry) return res.status(404).json({ success: false, message: "Queue item not found" });
    const index = entry.votes.findIndex((item) => id(item) === id(req.userId));
    if (index >= 0) entry.votes.splice(index, 1); else entry.votes.push(req.userId);
    room.lastActiveAt = new Date();
    await room.save();
    return res.json({ success: true, votes: entry.votes.length });
  } catch (error) { return res.status(500).json({ success: false, message: "Could not vote" }); }
};

export const advanceLiveRoom = async (req, res) => {
  try {
    const room = await LiveRoom.findOne({ code: String(req.params.code || "").toUpperCase(), status: "active" });
    if (!room || id(room.host) !== id(req.userId)) return res.status(403).json({ success: false, message: "Only the host can advance the room" });
    const candidates = room.queue.filter((entry) => !entry.played).sort((a, b) => b.votes.length - a.votes.length || new Date(a.createdAt) - new Date(b.createdAt));
    const next = candidates[0];
    if (!next) return res.json({ success: true, currentSong: null });
    next.played = true;
    room.currentSong = next.song;
    room.currentStartedAt = new Date();
    room.lastActiveAt = new Date();
    await room.save();
    const song = await Song.findById(next.song).populate("artist album");
    return res.json({ success: true, currentSong: song });
  } catch (error) { return res.status(500).json({ success: false, message: "Could not advance room" }); }
};

export const buildFriendMix = async (req, res) => {
  try {
    const requested = Array.isArray(req.body.userIds) ? req.body.userIds.filter(validId).slice(0, 4) : [];
    const ids = [...new Set([id(req.userId), ...requested.map(id)])];
    const users = await User.find({ _id: { $in: ids } }).select("username name preferences likedSongs history socialSettings");
    if (users.length < 2) return res.status(400).json({ success: false, message: "Choose at least one friend" });

    const candidates = await Song.find({ status: { $ne: "draft" } }).populate("artist album featuredArtists").sort({ plays: -1, likes: -1 }).limit(220);
    const scores = new Map();
    users.forEach((user) => {
      rankSongsForUser(user, candidates).slice(0, 80).forEach((song, index) => {
        const songId = id(song);
        const value = Number(song.recommendationScore || 0) + Math.max(0, 18 - index * 0.18);
        scores.set(songId, Number(scores.get(songId) || 0) + value);
      });
    });
    const ranked = [...candidates]
      .map((song) => ({ song, score: Number(scores.get(id(song)) || 0) }))
      .sort((a, b) => b.score - a.score || Number(b.song.plays || 0) - Number(a.song.plays || 0))
      .slice(0, 30)
      .map(({ song }) => song);
    return res.json({ success: true, users: users.map((u) => publicUser(u, req.userId)), songs: ranked });
  } catch (error) { return res.status(500).json({ success: false, message: "Could not build Friend Mix" }); }
};
