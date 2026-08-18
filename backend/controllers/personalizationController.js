import mongoose from "mongoose";
import User from "../models/userModel.js";
import Song from "../models/uploadSongModel.js";
import Artist from "../models/artistModel.js";
import Album from "../models/albumModel.js";
import {
  applyAlbumPreferenceSignal,
  applyArtistPreferenceSignal,
  applySongPreferenceSignal,
  compactPreferences,
} from "../utils/preferencesHelper.js";
import { emitSocialRefresh, emitToUsers } from "../utils/realtimeHub.js";

const MAX_EVENTS = 30;

const EVENT_STRENGTH = Object.freeze({
  song_view: 0.35,
  lyrics_open: 0.55,
  play_20s: 0.8,
  play_60s: 1.6,
  complete: 3.2,
  repeat: 2.6,
  search_play: 1.8,
  playlist_add: 4.5,
  playlist_remove: -1.8,
  skip_early: -1.2,
  album_view: 0.75,
  artist_view: 0.75,
});

const cleanId = (value) =>
  value && mongoose.Types.ObjectId.isValid(String(value)) ? String(value) : "";

export const recordPersonalizationEvents = async (req, res) => {
  try {
    const input = Array.isArray(req.body?.events) ? req.body.events : [];
    const events = input.slice(0, MAX_EVENTS).filter((event) => EVENT_STRENGTH[event?.type] !== undefined);

    if (!events.length) {
      return res.json({ success: true, accepted: 0 });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const songIds = [...new Set(events.map((event) => cleanId(event.songId)).filter(Boolean))];
    const artistIds = [...new Set(events.map((event) => cleanId(event.artistId)).filter(Boolean))];
    const albumIds = [...new Set(events.map((event) => cleanId(event.albumId)).filter(Boolean))];

    const [songs, artists, albums] = await Promise.all([
      songIds.length
        ? Song.find({ _id: { $in: songIds }, status: "published" })
            .select("_id artist album genre mood country songLanguage releaseYear")
            .lean()
        : [],
      artistIds.length ? Artist.find({ _id: { $in: artistIds } }).select("_id country").lean() : [],
      albumIds.length ? Album.find({ _id: { $in: albumIds } }).select("_id artist").lean() : [],
    ]);

    const songMap = new Map(songs.map((song) => [song._id.toString(), song]));
    const artistMap = new Map(artists.map((artist) => [artist._id.toString(), artist]));
    const albumMap = new Map(albums.map((album) => [album._id.toString(), album]));

    let accepted = 0;

    for (const event of events) {
      const strength = EVENT_STRENGTH[event.type];
      const songId = cleanId(event.songId);
      const artistId = cleanId(event.artistId);
      const albumId = cleanId(event.albumId);

      if (songId && songMap.has(songId)) {
        applySongPreferenceSignal(user, songMap.get(songId), strength);
        accepted += 1;
        continue;
      }

      if (event.type === "artist_view" && artistId && artistMap.has(artistId)) {
        applyArtistPreferenceSignal(user, artistMap.get(artistId), strength);
        accepted += 1;
        continue;
      }

      if (event.type === "album_view" && albumId && albumMap.has(albumId)) {
        applyAlbumPreferenceSignal(user, albumMap.get(albumId), strength);
        accepted += 1;
      }
    }

    compactPreferences(user);
    await user.save();

    if (accepted > 0) {
      const audience = [user._id, ...(user.followers || [])];
      emitToUsers(audience, "taste:update", {
        userId: String(user._id),
        accepted,
        at: new Date().toISOString(),
      });
      emitSocialRefresh(audience, "taste_updated");
    }

    return res.json({ success: true, accepted, algorithmVersion: 3 });
  } catch (error) {
    console.error("Personalization events error:", error);
    return res.status(500).json({ success: false, message: "Could not update personalization" });
  }
};
