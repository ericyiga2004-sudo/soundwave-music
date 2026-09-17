import Song from "../models/uploadSongModel.js";
import {
  getAudiusAlbum,
  getAudiusArtistsMeta,
  getAudiusConfigState,
  getAudiusTrendingMeta,
  getAudiusUser,
  getAudiusUserTracks,
  getAudiusTrack,
  isAudiusConfigured,
  openAudiusStream,
  searchAudiusTracksMeta,
} from "../services/audiusService.js";
import { syncAudiusArtist, syncAudiusTrack, syncAudiusTracks } from "../services/externalCatalogSync.js";

const clampLimit = (value, fallback = 60, max = 120) =>
  Math.min(Math.max(Number(value) || fallback, 1), max);

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const fetchLocalSongs = async ({ limit = 60, query = "" } = {}) => {
  const filter = { status: "published" };
  const cleanQuery = String(query || "").trim();

  if (cleanQuery) {
    const safe = escapeRegex(cleanQuery);
    filter.$or = [
      { title: { $regex: safe, $options: "i" } },
      { genre: { $regex: safe, $options: "i" } },
      { mood: { $regex: safe, $options: "i" } },
      { tags: { $in: [new RegExp(safe, "i")] } },
    ];
  }

  return Song.find(filter)
    .populate("artist")
    .populate("featuredArtists")
    .populate("album")
    .sort({ plays: -1, likes: -1, createdAt: -1 })
    .limit(clampLimit(limit, 60, 120))
    .lean();
};

export const getAudiusCatalog = async (req, res) => {
  const limit = clampLimit(req.query.limit, 80, 100);
  const time = ["week", "month", "year", "allTime"].includes(req.query.time)
    ? req.query.time
    : "week";
  const genres = String(req.query.genres || req.query.genre || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 3);

  try {
    if (!isAudiusConfigured()) throw new Error("Audius credentials are not configured");

    const genericLimit = Math.min(70, limit);
    const requests = [
      getAudiusTrendingMeta({ limit: genericLimit, time, offset: Math.floor(Math.random() * 18) }),
      ...genres.map((genre) => getAudiusTrendingMeta({ limit: 32, time: "month", genre, offset: Math.floor(Math.random() * 10) })),
    ];
    const settled = await Promise.allSettled(requests);
    const raw = [];
    let stale = false;
    let cacheHit = false;
    settled.forEach((result) => {
      if (result.status !== "fulfilled") return;
      stale = stale || Boolean(result.value?.stale);
      cacheHit = cacheHit || Boolean(result.value?.cacheHit);
      raw.push(...(result.value?.value || []));
    });

    const deduped = [];
    const seen = new Set();
    for (const song of raw) {
      const id = String(song?.externalId || "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      deduped.push(song);
    }
    if (!deduped.length) throw new Error("Audius returned no playable tracks");

    // Mirror metadata into the normal SoundWave catalog. The audio itself is
    // still streamed from Audius, but the MongoDB ids make every existing
    // SoundWave feature understand the track after reload.
    const mirrored = await syncAudiusTracks(deduped);
    const shuffled = [...mirrored].sort(() => Math.random() - 0.5).slice(0, limit);

    return res.json({
      success: true,
      songs: shuffled,
      source: "audius",
      fallback: false,
      cacheHit,
      stale,
      personalizedGenres: genres,
      mirrored: true,
    });
  } catch (error) {
    console.warn("Audius catalog unavailable; using Soundwave fallback:", error?.message || error);
    const songs = await fetchLocalSongs({ limit });
    return res.json({
      success: true,
      songs,
      source: "soundwave",
      fallback: true,
      fallbackReason: "audius_unavailable",
    });
  }
};

export const searchAudius = async (req, res) => {
  const query = String(req.query.q || req.query.query || "").trim();
  const limit = clampLimit(req.query.limit, 30, 100);
  if (!query) return res.json({ success: true, songs: [], source: "audius", fallback: false });

  try {
    if (!isAudiusConfigured()) throw new Error("Audius credentials are not configured");
    const result = await searchAudiusTracksMeta({ query, limit, sortMethod: req.query.sort || "popular" });
    const songs = await syncAudiusTracks(result.value || []);
    return res.json({
      success: true,
      songs,
      source: "audius",
      fallback: false,
      cacheHit: Boolean(result.cacheHit),
      stale: Boolean(result.stale),
    });
  } catch (error) {
    console.warn("Audius search unavailable; using Soundwave fallback:", error?.message || error);
    const songs = await fetchLocalSongs({ limit, query });
    return res.json({ success: true, songs, source: "soundwave", fallback: true, fallbackReason: "audius_unavailable" });
  }
};


export const getAudiusArtists = async (req, res) => {
  const limit = clampLimit(req.query.limit, 36, 60);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const query = String(req.query.q || req.query.query || "").trim();
  const sort = ["followers", "name"].includes(String(req.query.sort)) ? String(req.query.sort) : "followers";

  try {
    if (!isAudiusConfigured()) throw new Error("Audius credentials are not configured");
    const result = await getAudiusArtistsMeta({ limit, offset, query, sort });
    const artists = (await Promise.all((result.value?.artists || []).map((artist) => syncAudiusArtist(artist).catch(() => null)))).filter(Boolean);
    return res.json({
      success: true,
      artists,
      total: Number(result.value?.total || 0),
      hasMore: Boolean(result.value?.hasMore),
      source: "audius",
      fallback: false,
      cacheHit: Boolean(result.cacheHit),
      stale: Boolean(result.stale),
    });
  } catch (error) {
    console.warn("Audius artist catalog unavailable:", error?.message || error);
    return res.json({
      success: true,
      artists: [],
      total: 0,
      hasMore: false,
      source: "audius",
      fallback: true,
    });
  }
};

export const getAudiusArtist = async (req, res) => {
  try {
    const audiusArtist = await getAudiusUser(req.params.artistId);
    const artist = await syncAudiusArtist(audiusArtist);
    const rawSongs = await getAudiusUserTracks(req.params.artistId, { limit: clampLimit(req.query.limit, 100, 100) });
    const songs = await syncAudiusTracks(rawSongs);
    return res.json({ success: true, artist, songs, source: "audius", mirrored: true });
  } catch (error) {
    console.error("Audius artist fetch failed:", error?.message || error);
    return res.status(502).json({ success: false, message: "Audius artist is temporarily unavailable" });
  }
};

export const getAudiusAlbumById = async (req, res) => {
  try {
    const rawAlbum = await getAudiusAlbum(req.params.albumId);
    const songs = await syncAudiusTracks(rawAlbum?.songs || []);
    const firstAlbum = songs.find((song) => song?.album)?._id ? songs.find((song) => song?.album)?.album : null;
    const album = firstAlbum || { ...rawAlbum, songs };
    return res.json({ success: true, album, songs, source: "audius", mirrored: true });
  } catch (error) {
    console.error("Audius album fetch failed:", error?.message || error);
    return res.status(502).json({ success: false, message: "Audius album is temporarily unavailable" });
  }
};

export const getAudiusTrackById = async (req, res) => {
  try {
    const raw = await getAudiusTrack(req.params.trackId);
    const song = await syncAudiusTrack(raw);
    if (!song) return res.status(404).json({ success: false, message: "Song not found" });
    return res.json({ success: true, song, source: "audius", mirrored: true });
  } catch (error) {
    console.error("Audius track fetch failed:", error?.message || error);
    return res.status(502).json({ success: false, message: "Audius song is temporarily unavailable" });
  }
};

export const streamAudiusTrack = async (req, res) => {
  try {
    if (!isAudiusConfigured()) return res.status(503).json({ success: false, message: "Audius is not configured" });
    const upstream = await openAudiusStream(req.params.trackId, req.headers.range || "");
    ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified", "cache-control"].forEach((name) => {
      const value = upstream.headers?.[name];
      if (value !== undefined) res.setHeader(name, value);
    });
    if (!res.getHeader("Cache-Control")) res.setHeader("Cache-Control", "public, max-age=300");
    res.status(upstream.status === 206 ? 206 : 200);
    res.on("close", () => {
      if (!res.writableEnded && !upstream.data.destroyed) upstream.data.destroy();
    });
    upstream.data.on("error", (error) => {
      console.error("Audius stream pipe error:", error?.message || error);
      if (!res.headersSent) res.status(502).end(); else res.end();
    });
    upstream.data.pipe(res);
  } catch (error) {
    const upstreamStatus = Number(error?.response?.status);
    const status = Number.isFinite(upstreamStatus) && upstreamStatus >= 400 && upstreamStatus < 600 ? upstreamStatus : 502;
    console.error("Audius stream failed:", status, error?.message || error);
    if (!res.headersSent) return res.status(status).json({ success: false, message: "Audius audio is temporarily unavailable" });
    res.end();
  }
};

export const getAudiusStatus = (_req, res) => {
  const config = getAudiusConfigState();
  res.json({ success: true, provider: "audius", configured: isAudiusConfigured(), ...config });
};
