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
import { emitAll, emitSocialRefresh, emitToUsers, isUserOnline } from "../utils/realtimeHub.js";

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
    online: isUserOnline(raw._id),
  };
};

const sanitizeMoment = (moment, viewerId = "") => {
  const raw = typeof moment?.toObject === "function" ? moment.toObject() : moment;
  if (!raw) return null;
  const viewer = id(viewerId);
  return {
    ...raw,
    likes: (raw.likedBy || []).length,
    liked: viewer ? (raw.likedBy || []).some((item) => id(item) === viewer) : false,
    likedBy: undefined,
    replies: (raw.replies || []).map((reply) => ({
      ...reply,
      parentReplyId: reply.parentReplyId || null,
      likes: (reply.likedBy || []).length,
      liked: viewer ? (reply.likedBy || []).some((item) => id(item) === viewer) : false,
      likedBy: undefined,
    })),
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
  add("country", profile.countries, "name");
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

const roomPlaybackPosition = (room, nowMs = Date.now()) => {
  const base = Math.max(0, Number(room?.playbackPosition || 0));
  if (room?.playbackState !== "playing" || !room?.playbackStartedAt) return base;
  const startedMs = new Date(room.playbackStartedAt).getTime();
  if (!Number.isFinite(startedMs) || startedMs <= 0) return base;
  return Math.max(0, base + Math.max(0, nowMs - startedMs) / 1000);
};

const roomPlaybackPacket = (room, now = new Date()) => ({
  code: String(room?.code || ""),
  songId: id(room?.currentSong),
  playbackState: room?.playbackState || "paused",
  playbackPosition: roomPlaybackPosition(room, now.getTime()),
  playbackStartedAt: room?.playbackStartedAt || null,
  playbackVersion: Number(room?.playbackVersion || 0),
  serverTime: now.toISOString(),
});

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
      SocialActivity.find({
        $or: [
          { actor: { $in: [me._id, ...followingIds] } },
          { targetUser: me._id },
        ],
      })
        .sort({ createdAt: -1 }).limit(30)
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
    const affected = [user._id, ...(user.followers || [])];
    emitToUsers(affected, "profile:update", { userId: id(user._id), reason: "profile_changed", at: new Date().toISOString() });
    emitSocialRefresh(affected, "profile_changed");
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
    emitToUsers([me._id, target._id], "people:update", {
      actorId: id(me._id),
      targetId: id(target._id),
      following,
      followersCount: target.followers.length,
      at: new Date().toISOString(),
    });
    emitSocialRefresh([me._id, target._id], following ? "follow" : "unfollow");
    return res.json({ success: true, following, followersCount: target.followers.length, user: publicUser(target, me._id) });
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
    const audience = [req.userId, ...followers];
    emitToUsers(audience, "daily:update", { userId: id(req.userId), songId: id(songId), dayKey, at: new Date().toISOString() });
    emitSocialRefresh(audience, "daily_pick");
    return res.json({ success: true, pick });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not save today's song" });
  }
};

export const shareSongDirect = async (req, res) => {
  try {
    const songId = req.body.songId;
    const requested = Array.isArray(req.body.userIds) ? req.body.userIds : [req.body.userId];
    const recipientIds = [...new Set(requested.map(id).filter((value) => validId(value) && value !== id(req.userId)))].slice(0, 10);
    const note = String(req.body.message || req.body.note || "").trim().slice(0, 240);

    if (!validId(songId)) return res.status(400).json({ success: false, message: "Choose a song to share" });
    if (!recipientIds.length) return res.status(400).json({ success: false, message: "Choose at least one listener" });

    const [song, sender, recipients] = await Promise.all([
      Song.findById(songId).populate("artist album"),
      User.findById(req.userId).select("username name"),
      User.find({ _id: { $in: recipientIds } }).select("_id username name socialSettings"),
    ]);

    if (!song) return res.status(404).json({ success: false, message: "Song not found" });
    const validRecipients = recipients;
    if (!validRecipients.length) return res.status(404).json({ success: false, message: "Listeners not found" });

    const senderName = sender?.username || sender?.name || "A friend";
    await Promise.allSettled(validRecipients.map(async (recipient) => {
      await SocialActivity.create({
        actor: req.userId,
        type: "song_shared",
        song: songId,
        targetUser: recipient._id,
        note,
      }).catch(() => null);
      return createNotificationForUser({
        user: recipient._id,
        fromUser: req.userId,
        type: "song_shared",
        title: `${senderName} shared ${song.title} with you`,
        message: note || `Tap to play ${song.title}.`,
        link: `/song/${song._id}`,
        relatedSong: song._id,
        dedupeKey: `song-share:${song._id}:${req.userId}:${recipient._id}:${Date.now()}`,
      });
    }));

    const shareAudience = [req.userId, ...validRecipients.map((user) => user._id)];
    emitToUsers(shareAudience, "share:update", {
      senderId: id(req.userId),
      recipientIds: validRecipients.map((user) => id(user._id)),
      songId: id(song._id),
      at: new Date().toISOString(),
    });
    emitSocialRefresh(shareAudience, "song_shared");
    return res.status(201).json({
      success: true,
      sharedWith: validRecipients.map((user) => publicUser(user, req.userId)),
      song,
    });
  } catch (error) {
    console.error("Direct song share error:", error);
    return res.status(500).json({ success: false, message: "Could not share this song" });
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
    emitToUsers([req.userId], "circle:update", { circleId: id(circle._id), reason: "circle_created", at: new Date().toISOString() });
    emitSocialRefresh([req.userId], "circle_created");
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
    const wasMember = memberOfCircle(circle, req.userId);
    if (!wasMember) circle.members.push({ user: req.userId, role: "member" });
    await circle.save();
    const memberIds = (circle.members || []).map((member) => member.user);
    if (!wasMember && id(circle.owner) !== id(req.userId)) {
      const actor = await User.findById(req.userId).select("username name").lean();
      await createNotificationForUser({
        user: circle.owner,
        fromUser: req.userId,
        type: "circle_activity",
        title: `${actor?.username || actor?.name || "A listener"} joined ${circle.name}`,
        message: "Your Sound Circle has a new member.",
        link: `/social/circles/${circle._id}`,
        dedupeKey: `circle-join:${circle._id}:${req.userId}`,
      }).catch(() => null);
    }
    emitToUsers(memberIds, "circle:update", { circleId: id(circle._id), reason: "member_joined", at: new Date().toISOString() });
    emitSocialRefresh(memberIds, "circle_joined");
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
    const memberIds = [circle.owner, ...(circle.members || []).map((member) => member.user), req.userId];
    emitToUsers(memberIds, "circle:update", { circleId: id(circle._id), reason: "member_left", at: new Date().toISOString() });
    emitSocialRefresh(memberIds, "circle_left");
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
    const circleUsers = [circle.owner, ...(circle.members || []).map((member) => member.user)];
    emitToUsers(circleUsers, "circle:update", { circleId: id(circle._id), reason: "song_added", at: new Date().toISOString() });
    emitSocialRefresh(circleUsers, "circle_song");
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
    const serialized = sanitizeMoment(populated, req.userId);
    emitAll("song:moment:update", {
      songId: id(req.params.songId), reason: "created", moment: { ...serialized, liked: false }, at: new Date().toISOString(),
    });
    return res.status(201).json({ success: true, moment: serialized });
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
    emitAll("song:moment:update", {
      songId: id(moment.song), reason: "liked", momentId: id(moment._id),
      likes: moment.likedBy.length, actorId: id(req.userId), liked, at: new Date().toISOString(),
    });
    return res.json({ success: true, liked, likes: moment.likedBy.length });
  } catch (error) { return res.status(500).json({ success: false, message: "Could not react" }); }
};

export const replySongMoment = async (req, res) => {
  try {
    const body = String(req.body.body || "").trim().slice(0, 300);
    const parentReplyId = req.body.parentReplyId && validId(req.body.parentReplyId) ? req.body.parentReplyId : null;
    if (!body) return res.status(400).json({ success: false, message: "Write a reply" });
    const moment = await SongMoment.findById(req.params.momentId);
    if (!moment) return res.status(404).json({ success: false, message: "Moment not found" });
    const parentReply = parentReplyId ? moment.replies.id(parentReplyId) : null;
    if (parentReplyId && !parentReply) return res.status(404).json({ success: false, message: "Reply not found" });

    moment.replies.push({ user: req.userId, body, parentReplyId: parentReply?._id || null });
    await moment.save();
    const created = moment.replies[moment.replies.length - 1];
    const actor = await User.findById(req.userId).select("username name image").lean();
    const actorName = actor?.username || actor?.name || "Someone";
    const notifyUser = parentReply?.user || moment.user;
    if (id(notifyUser) !== id(req.userId)) {
      await createNotificationForUser({
        user: notifyUser, fromUser: req.userId, type: "song_moment",
        title: parentReply ? `${actorName} replied to your reply` : `${actorName} replied to your song moment`,
        message: body.slice(0, 100), link: `/song/${moment.song}`, relatedSong: moment.song,
        dedupeKey: `moment-reply:${moment._id}:${created._id}:${notifyUser}`,
      }).catch(() => null);
    }
    const reply = {
      _id: created._id, body: created.body, parentReplyId: created.parentReplyId || null,
      createdAt: created.createdAt, likes: 0, liked: false,
      user: actor ? { _id: actor._id, username: actor.username || actor.name, name: actor.name || actor.username, image: actor.image || "" } : null,
    };
    emitAll("song:moment:update", {
      songId: id(moment.song), reason: "reply_created", momentId: id(moment._id), reply, at: new Date().toISOString(),
    });
    return res.status(201).json({ success: true, reply });
  } catch (error) { return res.status(500).json({ success: false, message: "Could not reply" }); }
};

export const toggleSongMomentReplyLike = async (req, res) => {
  try {
    const moment = await SongMoment.findById(req.params.momentId);
    if (!moment) return res.status(404).json({ success: false, message: "Moment not found" });
    const reply = moment.replies.id(req.params.replyId);
    if (!reply) return res.status(404).json({ success: false, message: "Reply not found" });
    const index = (reply.likedBy || []).findIndex((item) => id(item) === id(req.userId));
    let liked = false;
    if (index >= 0) reply.likedBy.splice(index, 1); else { reply.likedBy.push(req.userId); liked = true; }
    await moment.save();
    if (liked && id(reply.user) !== id(req.userId)) {
      const actor = await User.findById(req.userId).select("username name").lean();
      const actorName = actor?.username || actor?.name || "Someone";
      await createNotificationForUser({
        user: reply.user, fromUser: req.userId, type: "song_moment_like",
        title: `${actorName} liked your reply`, message: String(reply.body || "").slice(0, 110),
        link: `/song/${moment.song}`, relatedSong: moment.song,
        dedupeKey: `moment-reply-like:${reply._id}:${req.userId}`,
      }).catch(() => null);
    }
    emitAll("song:moment:update", {
      songId: id(moment.song), reason: "reply_liked", momentId: id(moment._id), replyId: id(reply._id),
      likes: reply.likedBy.length, actorId: id(req.userId), liked, at: new Date().toISOString(),
    });
    return res.json({ success: true, liked, likes: reply.likedBy.length });
  } catch (error) { return res.status(500).json({ success: false, message: "Could not react to reply" }); }
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

    const host = await User.findById(req.userId).select("username name image followers preferences socialSettings");
    if (!host) return res.status(404).json({ success: false, message: "User not found" });
    const followerIds = (host.followers || []).map(id).filter(Boolean).slice(0, 60);
    const followerSet = new Set(followerIds);
    const hostTaste = preferenceVector(host).map;
    const similarCandidates = await User.find({
      _id: { $nin: [host._id, ...followerIds] },
      "socialSettings.publicProfile": { $ne: false },
      "socialSettings.allowTasteMatch": { $ne: false },
    }).select("_id preferences socialSettings").limit(120);
    const tasteMatches = similarCandidates
      .map((user) => ({ user, score: cosineMatch(hostTaste, preferenceVector(user).map) }))
      .filter((item) => item.score >= 70)
      .sort((a, b) => b.score - a.score)
      .slice(0, 24);
    const invitedIds = [...new Set([...followerIds, ...tasteMatches.map((item) => id(item.user._id))])];

    const room = await LiveRoom.create({
      name, host: req.userId, code, members: [{ user: req.userId }], invitedUsers: invitedIds, lastActiveAt: new Date(),
    });
    await SocialActivity.create({ actor: req.userId, type: "room_created", room: room._id }).catch(() => null);

    const hostName = host.username || host.name || "A listener";
    const scoreByUser = new Map(tasteMatches.map((item) => [id(item.user._id), item.score]));
    await Promise.allSettled(invitedIds.map((userId) => {
      const score = scoreByUser.get(id(userId));
      const follower = followerSet.has(id(userId));
      return createNotificationForUser({
        user: userId, fromUser: req.userId, type: "live_started",
        title: `${hostName} started a live listening room`,
        message: follower
          ? `Private code ${room.code}. Tap to join the live chat and listen together.`
          : `${score}% taste match · Private code ${room.code}. Tap to join the live chat.`,
        link: `/social/rooms/${room.code}`,
        dedupeKey: `live-start:${room._id}:${userId}`,
      });
    }));

    const audience = [req.userId, ...invitedIds];
    emitToUsers(audience, "room:update", { code: room.code, reason: "room_created", hostId: id(req.userId), at: new Date().toISOString() });
    emitSocialRefresh(audience, "room_created");
    return res.status(201).json({ success: true, room, notified: invitedIds.length });
  } catch (error) {
    console.error("Create live room error:", error);
    return res.status(500).json({ success: false, message: "Could not create room" });
  }
};

export const joinLiveRoom = async (req, res) => {
  try {
    const code = String(req.body.code || "").trim().toUpperCase();
    const room = await LiveRoom.findOne({ code, status: "active" });
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });
    const wasMember = memberOfRoom(room, req.userId);
    if (!wasMember) room.members.push({ user: req.userId });
    room.lastActiveAt = new Date();
    await room.save();
    const memberIds = [room.host, ...(room.members || []).map((member) => member.user)];
    emitToUsers(memberIds, "room:update", { code: room.code, reason: "member_joined", at: new Date().toISOString() });
    emitSocialRefresh(memberIds, "room_joined");
    return res.json({ success: true, code: room.code });
  } catch (error) { return res.status(500).json({ success: false, message: "Could not join room" }); }
};

export const getLiveRoom = async (req, res) => {
  try {
    const room = await LiveRoom.findOne({ code: String(req.params.code || "").toUpperCase(), status: "active" })
      .populate("host", "username name image").populate("members.user", "username name image")
      .populate("chat.user", "username name image")
      .populate("chat.reactions.users", "username name image")
      .populate({ path: "queue.song", populate: [{ path: "artist" }, { path: "album" }] })
      .populate("queue.addedBy", "username name image")
      .populate({ path: "currentSong", populate: [{ path: "artist" }, { path: "album" }] });
    if (!room || !memberOfRoom(room, req.userId)) return res.status(404).json({ success: false, message: "Room not found" });
    const plainRoom = room.toObject();
    plainRoom.members = (plainRoom.members || []).map((member) => ({
      ...member,
      user: member.user ? { ...member.user, online: isUserOnline(member.user._id) } : member.user,
    }));
    if (plainRoom.host) plainRoom.host = { ...plainRoom.host, online: isUserOnline(plainRoom.host._id) };
    plainRoom.chat = (plainRoom.chat || []).slice(-120);
    // Existing V22 rooms used currentStartedAt only. Treat those as playing so
    // an in-progress room upgrades without suddenly pausing for everybody.
    if (
      plainRoom.currentSong &&
      Number(plainRoom.playbackVersion || 0) === 0 &&
      !plainRoom.playbackStartedAt &&
      plainRoom.currentStartedAt
    ) {
      plainRoom.playbackState = "playing";
      plainRoom.playbackPosition = 0;
      plainRoom.playbackStartedAt = plainRoom.currentStartedAt;
    }
    const now = new Date();
    return res.json({
      success: true,
      room: plainRoom,
      isHost: id(room.host) === id(req.userId),
      viewerId: id(req.userId),
      serverTime: now.toISOString(),
      expectedPosition: roomPlaybackPosition(plainRoom, now.getTime()),
    });
  } catch (error) { return res.status(500).json({ success: false, message: "Could not load room" }); }
};

export const updateLiveRoomPlayback = async (req, res) => {
  try {
    const room = await LiveRoom.findOne({ code: String(req.params.code || "").toUpperCase(), status: "active" });
    if (!room || id(room.host) !== id(req.userId)) {
      return res.status(403).json({ success: false, message: "Only the host controls room playback" });
    }
    if (!room.currentSong) return res.status(400).json({ success: false, message: "Start a room song first" });

    const requestedState = String(req.body.playbackState || req.body.state || "").toLowerCase();
    if (!["playing", "paused"].includes(requestedState)) {
      return res.status(400).json({ success: false, message: "Playback state must be playing or paused" });
    }

    const now = new Date();
    const requestedPosition = Number(req.body.position);
    const position = Number.isFinite(requestedPosition)
      ? Math.max(0, requestedPosition)
      : roomPlaybackPosition(room, now.getTime());

    room.playbackState = requestedState;
    room.playbackPosition = position;
    room.playbackStartedAt = requestedState === "playing" ? now : null;
    room.currentStartedAt = requestedState === "playing"
      ? new Date(now.getTime() - position * 1000)
      : room.currentStartedAt;
    room.playbackVersion = Number(room.playbackVersion || 0) + 1;
    room.lastActiveAt = now;
    await room.save();

    const memberIds = [room.host, ...(room.members || []).map((member) => member.user)];
    const packet = roomPlaybackPacket(room, now);
    emitToUsers(memberIds, "room:playback", packet);
    emitToUsers(memberIds, "room:update", { code: room.code, reason: "playback_changed", at: now.toISOString() });
    return res.json({ success: true, playback: packet });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not update room playback" });
  }
};

export const postLiveRoomChat = async (req, res) => {
  try {
    const code = String(req.params.code || "").toUpperCase();
    const body = String(req.body.body || "").trim().slice(0, 280);
    if (!body) return res.status(400).json({ success: false, message: "Write a message" });
    const room = await LiveRoom.findOne({ code, status: "active" });
    if (!room || !memberOfRoom(room, req.userId)) return res.status(404).json({ success: false, message: "Room not found" });

    room.chat.push({ user: req.userId, body, reactions: [] });
    if (room.chat.length > 150) room.chat.splice(0, room.chat.length - 150);
    room.lastActiveAt = new Date();
    await room.save();
    const created = room.chat[room.chat.length - 1];
    const actor = await User.findById(req.userId).select("username name image").lean();
    const message = {
      _id: created._id, body: created.body, createdAt: created.createdAt, reactions: [],
      user: actor ? { _id: actor._id, username: actor.username || actor.name, name: actor.name || actor.username, image: actor.image || "", online: isUserOnline(actor._id) } : null,
    };
    const memberIds = [room.host, ...(room.members || []).map((member) => member.user)];
    emitToUsers(memberIds, "room:chat", { code: room.code, message, at: new Date().toISOString() });
    return res.status(201).json({ success: true, message });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not send live message" });
  }
};

export const reactLiveRoomChat = async (req, res) => {
  try {
    const code = String(req.params.code || "").toUpperCase();
    const emoji = String(req.body.emoji || "❤️").trim().slice(0, 8);
    const allowed = new Set(["❤️", "🔥", "😂", "👏", "🎵", "🙌"]);
    if (!allowed.has(emoji)) return res.status(400).json({ success: false, message: "Unsupported reaction" });
    const room = await LiveRoom.findOne({ code, status: "active" });
    if (!room || !memberOfRoom(room, req.userId)) return res.status(404).json({ success: false, message: "Room not found" });
    const message = room.chat.id(req.params.messageId);
    if (!message) return res.status(404).json({ success: false, message: "Message not found" });
    let reaction = (message.reactions || []).find((item) => item.emoji === emoji);
    if (!reaction) {
      message.reactions.push({ emoji, users: [] });
      reaction = message.reactions[message.reactions.length - 1];
    }
    const index = reaction.users.findIndex((userId) => id(userId) === id(req.userId));
    let active = false;
    if (index >= 0) reaction.users.splice(index, 1); else { reaction.users.push(req.userId); active = true; }
    message.reactions = message.reactions.filter((item) => item.users.length > 0);
    room.lastActiveAt = new Date();
    await room.save();
    const reactions = message.reactions.map((item) => ({ emoji: item.emoji, count: item.users.length }));
    const memberIds = [room.host, ...(room.members || []).map((member) => member.user)];
    emitToUsers(memberIds, "room:chat:reaction", {
      code: room.code, messageId: id(message._id), reactions, actorId: id(req.userId), emoji, active, at: new Date().toISOString(),
    });
    return res.json({ success: true, active, reactions });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not react to live message" });
  }
};

export const addLiveRoomSong = async (req, res) => {
  try {
    const room = await LiveRoom.findOne({ code: String(req.params.code || "").toUpperCase(), status: "active" });
    if (!room || !memberOfRoom(room, req.userId)) return res.status(404).json({ success: false, message: "Room not found" });
    const songId = req.body.songId;
    if (!validId(songId) || !(await Song.exists({ _id: songId }))) return res.status(404).json({ success: false, message: "Song not found" });
    if (id(room.currentSong) === id(songId)) {
      return res.status(409).json({ success: false, message: "That song is already playing in this room" });
    }

    // V23.4: one song may appear only once during a live-room session. This
    // prevents members from repeatedly re-adding the same track after it has
    // played and accidentally creating a loop that dominates the voted queue.
    const existing = (room.queue || []).find((entry) => id(entry.song) === id(songId));
    if (existing) {
      return res.status(409).json({
        success: false,
        message: existing.played ? "That song has already played in this room" : "That song is already in the room queue",
      });
    }

    room.queue.push({ song: songId, addedBy: req.userId, votes: [req.userId] });
    room.lastActiveAt = new Date();
    await room.save();
    const memberIds = [room.host, ...(room.members || []).map((member) => member.user)];
    emitToUsers(memberIds, "room:update", { code: room.code, reason: "queue_changed", at: new Date().toISOString() });
    emitSocialRefresh(memberIds, "room_queue_changed");
    return res.json({ success: true });
  } catch (error) { return res.status(500).json({ success: false, message: "Could not update room queue" }); }
};

export const voteLiveRoomSong = async (req, res) => {
  try {
    const room = await LiveRoom.findOne({ code: String(req.params.code || "").toUpperCase(), status: "active" });
    if (!room || !memberOfRoom(room, req.userId)) return res.status(404).json({ success: false, message: "Room not found" });
    const entry = room.queue.id(req.params.entryId);
    if (!entry) return res.status(404).json({ success: false, message: "Queue item not found" });
    if (entry.played || id(entry.song) === id(room.currentSong)) {
      return res.status(409).json({ success: false, message: "Voting is closed for the song already playing" });
    }
    const index = entry.votes.findIndex((item) => id(item) === id(req.userId));
    let voted = false;
    if (index >= 0) entry.votes.splice(index, 1); else { entry.votes.push(req.userId); voted = true; }
    room.lastActiveAt = new Date();
    await room.save();
    const memberIds = [room.host, ...(room.members || []).map((member) => member.user)];
    emitToUsers(memberIds, "room:update", { code: room.code, reason: "vote_changed", at: new Date().toISOString() });
    emitSocialRefresh(memberIds, "room_vote_changed");
    return res.json({ success: true, votes: entry.votes.length, voted });
  } catch (error) { return res.status(500).json({ success: false, message: "Could not vote" }); }
};


export const playLiveRoomQueueEntry = async (req, res) => {
  try {
    const room = await LiveRoom.findOne({ code: String(req.params.code || "").toUpperCase(), status: "active" });
    if (!room || id(room.host) !== id(req.userId)) {
      return res.status(403).json({ success: false, message: "Only the host can play voted room songs" });
    }

    const entry = room.queue.id(req.params.entryId);
    if (!entry || entry.played) {
      return res.status(404).json({ success: false, message: "That voted song is no longer waiting in the room queue" });
    }

    const selectedSongId = id(entry.song);
    if (!selectedSongId || !(await Song.exists({ _id: selectedSongId }))) {
      return res.status(404).json({ success: false, message: "Song not found" });
    }

    // A deliberate host selection is the only action here that can replace the
    // current room song. Ordinary vote changes only reorder the waiting queue.
    room.queue.forEach((queuedEntry) => {
      if (id(queuedEntry.song) === selectedSongId) queuedEntry.played = true;
    });

    const now = new Date();
    room.currentSong = selectedSongId;
    room.currentStartedAt = now;
    room.playbackState = "playing";
    room.playbackPosition = 0;
    room.playbackStartedAt = now;
    room.playbackVersion = Number(room.playbackVersion || 0) + 1;
    room.lastActiveAt = now;
    await room.save();

    const song = await Song.findById(selectedSongId).populate("artist album");
    const memberIds = [room.host, ...(room.members || []).map((member) => member.user)];

    emitToUsers(memberIds, "room:update", {
      code: room.code,
      reason: "host_selected_song",
      songId: id(song?._id),
      at: now.toISOString(),
    });
    emitToUsers(memberIds, "room:playback", {
      ...roomPlaybackPacket(room, now),
      songId: id(song?._id),
    });
    emitSocialRefresh(memberIds, "room_host_selected_song");

    return res.json({ success: true, currentSong: song });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not play that voted room song" });
  }
};

export const advanceLiveRoom = async (req, res) => {
  try {
    const room = await LiveRoom.findOne({ code: String(req.params.code || "").toUpperCase(), status: "active" });
    if (!room || id(room.host) !== id(req.userId)) return res.status(403).json({ success: false, message: "Only the host can advance the room" });
    const currentSongId = id(room.currentSong);
    // V23.4 voted queue contract: choose the winner only at the moment the host
    // starts/advances (or the current track ends). Votes may reorder the waiting
    // queue at any time, but they never interrupt the song that is already live.
    // Highest vote count wins; ties go to the song added earliest.
    const candidates = room.queue
      .filter((entry) => !entry.played && id(entry.song) !== currentSongId)
      .sort((a, b) => (b.votes?.length || 0) - (a.votes?.length || 0) || new Date(a.createdAt) - new Date(b.createdAt));
    const next = candidates[0];
    if (!next) {
      const now = new Date();
      room.currentSong = null;
      room.currentStartedAt = null;
      room.playbackState = "paused";
      room.playbackPosition = 0;
      room.playbackStartedAt = null;
      room.playbackVersion = Number(room.playbackVersion || 0) + 1;
      room.lastActiveAt = now;
      await room.save();
      const memberIds = [room.host, ...(room.members || []).map((member) => member.user)];
      emitToUsers(memberIds, "room:update", { code: room.code, reason: "queue_finished", songId: "", at: now.toISOString() });
      emitToUsers(memberIds, "room:playback", {
        ...roomPlaybackPacket(room, now),
        songId: "",
      });
      return res.json({ success: true, currentSong: null, queueFinished: true });
    }
    next.played = true;
    // Clean up legacy duplicate queue entries so the same song cannot be
    // selected again on the next host advance.
    room.queue.forEach((entry) => {
      if (id(entry.song) === id(next.song)) entry.played = true;
    });
    room.currentSong = next.song;
    const now = new Date();
    room.currentStartedAt = now;
    room.playbackState = "playing";
    room.playbackPosition = 0;
    room.playbackStartedAt = now;
    room.playbackVersion = Number(room.playbackVersion || 0) + 1;
    room.lastActiveAt = now;
    await room.save();
    const song = await Song.findById(next.song).populate("artist album");
    const memberIds = [room.host, ...(room.members || []).map((member) => member.user)];
    emitToUsers(memberIds, "room:update", { code: room.code, reason: "song_advanced", songId: id(song?._id), at: now.toISOString() });
    emitToUsers(memberIds, "room:playback", {
      ...roomPlaybackPacket(room, now),
      songId: id(song?._id),
    });
    emitSocialRefresh(memberIds, "room_song_advanced");
    return res.json({ success: true, currentSong: song });
  } catch (error) { return res.status(500).json({ success: false, message: "Could not advance room" }); }
};

export const buildFriendMix = async (req, res) => {
  try {
    const requested = Array.isArray(req.body.userIds)
      ? req.body.userIds.filter(validId).map(id).slice(0, 4)
      : [];

    const me = await User.findById(req.userId)
      .select("username name image followingUsers preferences likedSongs history socialSettings");
    if (!me) return res.status(404).json({ success: false, message: "User not found" });

    const allowed = new Set((me.followingUsers || []).map(id));
    const selectedIds = [...new Set(requested.filter((userId) => allowed.has(userId)))];
    if (!selectedIds.length) {
      return res.status(400).json({ success: false, message: "Choose at least one person you follow" });
    }

    const friends = await User.find({
      _id: { $in: selectedIds },
      "socialSettings.allowTasteMatch": { $ne: false },
    }).select("username name image preferences likedSongs history socialSettings");

    const users = [me, ...friends];
    if (users.length < 2) {
      return res.status(400).json({ success: false, message: "Those friends are not available for Friend Mix" });
    }

    const candidates = await Song.find({ status: { $ne: "draft" } })
      .populate("artist album featuredArtists")
      .sort({ plays: -1, likes: -1, createdAt: -1 })
      .limit(320);

    const perUser = users.map((user) => {
      const ranked = rankSongsForUser(user, candidates).slice(0, 120);
      const maxScore = Math.max(1, ...ranked.map((song) => Number(song.recommendationScore || 0)));
      const affinity = new Map();
      ranked.forEach((song, index) => {
        const positionScore = Math.max(0, 100 - index * 0.82);
        const tasteScore = Math.max(0, Math.min(100, (Number(song.recommendationScore || 0) / maxScore) * 100));
        affinity.set(id(song), Math.round((positionScore * 0.55 + tasteScore * 0.45) * 10) / 10);
      });
      const recent = new Set((user.history || []).slice(0, 18).map((entry) => id(entry?.song || entry)).filter(Boolean));
      const profile = getUserRecommendationProfile(user);
      return { user, affinity, recent, profile };
    });

    const scored = candidates.map((songDoc) => {
      const song = typeof songDoc.toObject === "function" ? songDoc.toObject() : songDoc;
      const songId = id(song);
      const scores = perUser.map((entry) => Number(entry.affinity.get(songId) || 0));
      const average = scores.reduce((sum, value) => sum + value, 0) / Math.max(1, scores.length);
      const minimum = Math.min(...scores);
      const overlapCount = scores.filter((value) => value >= 55).length;
      const overlapPercent = (overlapCount / scores.length) * 100;
      const recentCount = perUser.filter((entry) => entry.recent.has(songId)).length;

      const genreMatches = perUser.filter((entry) =>
        entry.profile.topGenres.some((value) => String(value).toLowerCase() === String(song.genre || "").toLowerCase())
      ).length;
      const languageMatches = perUser.filter((entry) =>
        entry.profile.topLanguages.some((value) => String(value).toLowerCase() === String(song.songLanguage || "").toLowerCase())
      ).length;

      let groupScore = average * 0.56 + minimum * 0.20 + overlapPercent * 0.19;
      groupScore += Math.min(5, Math.log1p(Number(song.likes || 0)) * 0.45 + Math.log1p(Number(song.plays || 0)) * 0.2);
      groupScore -= recentCount * 4.5;

      const reasons = [];
      if (overlapCount >= 2) reasons.push(`Matches ${overlapCount} of ${scores.length} listeners`);
      if (genreMatches >= 2 && song.genre) reasons.push(`Shared ${song.genre} taste`);
      if (languageMatches >= 2 && song.songLanguage) reasons.push(`Shared ${song.songLanguage} listening`);
      if (!recentCount) reasons.push("Fresh for the group");
      if (!reasons.length) reasons.push("Balanced across your tastes");

      return {
        ...song,
        friendMixScore: Math.max(0, Math.min(100, Math.round(groupScore))),
        friendMixCoverage: overlapCount,
        friendMixPeople: scores.length,
        friendMixReasons: reasons.slice(0, 3),
      };
    }).sort((a, b) =>
      Number(b.friendMixScore || 0) - Number(a.friendMixScore || 0) ||
      Number(b.friendMixCoverage || 0) - Number(a.friendMixCoverage || 0) ||
      Number(b.plays || 0) - Number(a.plays || 0)
    );

    const selected = [];
    const artistCounts = new Map();
    const albumCounts = new Map();
    const genreCounts = new Map();
    const pool = [...scored];

    while (pool.length && selected.length < 30) {
      let chosenIndex = -1;
      for (let index = 0; index < Math.min(pool.length, 40); index += 1) {
        const song = pool[index];
        const artistId = id(song.artist);
        const albumId = id(song.album);
        const genre = String(song.genre || "unknown").toLowerCase();
        if (artistId && (artistCounts.get(artistId) || 0) >= 2) continue;
        if (albumId && (albumCounts.get(albumId) || 0) >= 2) continue;
        if ((genreCounts.get(genre) || 0) >= 7) continue;
        chosenIndex = index;
        break;
      }
      if (chosenIndex < 0) chosenIndex = 0;
      const [song] = pool.splice(chosenIndex, 1);
      selected.push(song);
      const artistId = id(song.artist);
      const albumId = id(song.album);
      const genre = String(song.genre || "unknown").toLowerCase();
      if (artistId) artistCounts.set(artistId, Number(artistCounts.get(artistId) || 0) + 1);
      if (albumId) albumCounts.set(albumId, Number(albumCounts.get(albumId) || 0) + 1);
      genreCounts.set(genre, Number(genreCounts.get(genre) || 0) + 1);
    }

    const participants = users.map((user) => ({
      _id: user._id,
      username: user.username || user.name || "Listener",
      name: user.name || user.username || "Listener",
      image: user.image || "",
    }));

    return res.json({
      success: true,
      users: participants,
      songs: selected,
      mixMeta: {
        participantCount: participants.length,
        generatedAt: new Date().toISOString(),
        strongestScore: selected[0]?.friendMixScore || 0,
        diversity: {
          artists: new Set(selected.map((song) => id(song.artist)).filter(Boolean)).size,
          genres: new Set(selected.map((song) => String(song.genre || "").trim()).filter(Boolean)).size,
        },
      },
    });
  } catch (error) {
    console.error("Friend Mix error:", error);
    return res.status(500).json({ success: false, message: "Could not build Friend Mix" });
  }
};
