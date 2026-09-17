import Artist from "../models/artistModel.js";
import Album from "../models/albumModel.js";
import Song from "../models/uploadSongModel.js";

const clean = (value) => String(value || "").trim();
const safeNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const FALLBACK_COVER = "/fallback-cover.svg";
const FALLBACK_ARTIST = "/fallback-artist.svg";

const artistCacheKey = (artist = {}) => clean(artist.externalId || artist._id).replace(/^audius_user_/, "");
const albumCacheKey = (album = {}, artistExternalId = "") => {
  const albumId = clean(album.externalId || album._id).replace(/^audius_album_/, "");
  return albumId || `singles:${artistExternalId || "unknown"}`;
};

const populateSongById = (id) => Song.findById(id).populate("artist").populate("featuredArtists").populate("album").lean();

export const syncAudiusArtist = async (artist = {}) => {
  const externalId = artistCacheKey(artist);
  if (!externalId) return null;
  const displayName = clean(artist.name || artist.handle) || "Audius Artist";

  const existingExternal = await Artist.findOne({ externalSource: "audius", externalId });
  if (existingExternal) {
    const nameConflict = await Artist.findOne({ name: displayName, _id: { $ne: existingExternal._id } }).select("_id");
    if (!nameConflict) existingExternal.name = displayName;
    existingExternal.image = clean(artist.image || artist.imageUrl) || existingExternal.image || FALLBACK_ARTIST;
    existingExternal.bio = clean(artist.bio);
    existingExternal.verified = Boolean(artist.verified);
    existingExternal.followers = Math.max(safeNumber(existingExternal.followers), safeNumber(artist.followers));
    existingExternal.source = "audius";
    existingExternal.isExternal = true;
    existingExternal.handle = clean(artist.handle);
    await existingExternal.save();
    return existingExternal;
  }

  // Preserve existing SoundWave artist links when the exact artist name is
  // already present. This avoids duplicate artist pages for the same name.
  const sameName = await Artist.findOne({ name: displayName });
  if (sameName) return sameName;

  return Artist.create({
    name: displayName,
    image: clean(artist.image || artist.imageUrl) || FALLBACK_ARTIST,
    bio: clean(artist.bio),
    country: clean(artist.country) || "Unknown",
    verified: Boolean(artist.verified),
    followers: safeNumber(artist.followers),
    source: "audius",
    externalSource: "audius",
    externalId,
    isExternal: true,
    handle: clean(artist.handle),
  });
};

const syncAudiusAlbum = async (track = {}, artistDoc) => {
  if (!artistDoc) return null;
  const artistExternalId = artistCacheKey(track.artist || {});
  const album = track.album || {};
  const externalId = albumCacheKey(album, artistExternalId);
  const isSingles = externalId.startsWith("singles:");
  const title = clean(album.title || album.name) || (isSingles ? "Singles" : "Audius Album");
  const coverImage = clean(album.coverImage || album.imageUrl || track.imageUrl || track.artist?.imageUrl || track.artist?.image) || FALLBACK_COVER;

  return Album.findOneAndUpdate(
    { externalSource: "audius", externalId },
    {
      $set: {
        title,
        artist: artistDoc._id,
        coverImage,
        description: clean(album.description),
        releaseDate: track.releaseDate ? new Date(track.releaseDate) : undefined,
        source: "audius",
        externalSource: "audius",
        externalId,
        isExternal: true,
      },
      $setOnInsert: { songs: [], totalPlays: 0 },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

export const syncAudiusTrack = async (track = {}) => {
  const externalId = clean(track.externalId || track.id || track._id).replace(/^audius_/, "");
  if (!externalId) return null;

  const artistDoc = await syncAudiusArtist(track.artist || {});
  if (!artistDoc) return null;
  const albumDoc = await syncAudiusAlbum(track, artistDoc);
  if (!albumDoc) return null;

  const releaseDate = track.releaseDate ? new Date(track.releaseDate) : null;
  const validReleaseDate = releaseDate && !Number.isNaN(releaseDate.getTime()) ? releaseDate : undefined;
  const releaseYear = Number(track.releaseYear || (validReleaseDate ? validReleaseDate.getFullYear() : 0)) || undefined;
  const imageUrl = clean(track.imageUrl || track.coverImage || track.artist?.imageUrl || track.artist?.image) || FALLBACK_COVER;
  const audioUrl = `/api/audius/stream/${encodeURIComponent(externalId)}`;

  const song = await Song.findOneAndUpdate(
    { externalSource: "audius", externalId },
    {
      $set: {
        title: clean(track.title) || "Untitled",
        artist: artistDoc._id,
        featuredArtists: [],
        album: albumDoc._id,
        audioUrl,
        imageUrl,
        genre: clean(track.genre) || "Unknown",
        tags: Array.isArray(track.tags) ? track.tags.map(clean).filter(Boolean).slice(0, 40) : [],
        mood: clean(track.mood) || "Unknown",
        songLanguage: clean(track.songLanguage) || "Unknown",
        country: clean(track.country) || "Unknown",
        ...(validReleaseDate ? { releaseDate: validReleaseDate } : {}),
        ...(releaseYear ? { releaseYear } : {}),
        duration: Math.max(0, safeNumber(track.duration)),
        explicit: Boolean(track.explicit),
        status: "published",
        source: "audius",
        externalSource: "audius",
        externalId,
        isExternal: true,
        providerPermalink: clean(track.permalink),
        providerPlays: safeNumber(track.plays),
        providerLikes: safeNumber(track.likes),
      },
      $max: {
        plays: safeNumber(track.plays),
        likes: safeNumber(track.likes),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await Album.updateOne({ _id: albumDoc._id }, { $addToSet: { songs: song._id }, $max: { totalPlays: safeNumber(track.plays) } });
  return populateSongById(song._id);
};

export const syncAudiusTracks = async (tracks = []) => {
  const unique = [];
  const seen = new Set();
  for (const track of Array.isArray(tracks) ? tracks : []) {
    const id = clean(track?.externalId || track?.id || track?._id).replace(/^audius_/, "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    unique.push(track);
  }

  const results = [];
  const concurrency = 6;
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, unique.length || 1) }, async () => {
    while (cursor < unique.length) {
      const index = cursor++;
      try {
        const song = await syncAudiusTrack(unique[index]);
        if (song) results[index] = song;
      } catch (error) {
        console.warn("Audius catalog mirror skipped track:", error?.message || error);
      }
    }
  });
  await Promise.all(workers);
  return results.filter(Boolean);
};
