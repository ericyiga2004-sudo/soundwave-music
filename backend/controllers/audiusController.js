import Song from "../models/uploadSongModel.js";
import {
  getAudiusConfigState,
  getAudiusTrending,
  isAudiusConfigured,
  openAudiusStream,
  searchAudiusTracks,
} from "../services/audiusService.js";

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
  const limit = clampLimit(req.query.limit, 60, 100);
  const time = ["week", "month", "year", "allTime"].includes(req.query.time)
    ? req.query.time
    : "week";

  try {
    if (!isAudiusConfigured()) {
      throw new Error("Audius credentials are not configured");
    }

    const songs = await getAudiusTrending({
      limit,
      time,
      genre: req.query.genre,
    });

    if (!songs.length) {
      throw new Error("Audius returned no playable tracks");
    }

    return res.json({
      success: true,
      songs,
      source: "audius",
      fallback: false,
    });
  } catch (error) {
    console.warn(
      "Audius catalog unavailable; using Soundwave fallback:",
      error?.message || error
    );

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

  if (!query) {
    return res.json({
      success: true,
      songs: [],
      source: "audius",
      fallback: false,
    });
  }

  try {
    if (!isAudiusConfigured()) {
      throw new Error("Audius credentials are not configured");
    }

    const songs = await searchAudiusTracks({
      query,
      limit,
      sortMethod: req.query.sort || "popular",
    });

    return res.json({
      success: true,
      songs,
      source: "audius",
      fallback: false,
    });
  } catch (error) {
    console.warn(
      "Audius search unavailable; using Soundwave fallback:",
      error?.message || error
    );

    const songs = await fetchLocalSongs({ limit, query });

    return res.json({
      success: true,
      songs,
      source: "soundwave",
      fallback: true,
      fallbackReason: "audius_unavailable",
    });
  }
};

export const streamAudiusTrack = async (req, res) => {
  try {
    if (!isAudiusConfigured()) {
      return res.status(503).json({
        success: false,
        message: "Audius is not configured",
      });
    }

    const upstream = await openAudiusStream(
      req.params.trackId,
      req.headers.range || ""
    );

    [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "etag",
      "last-modified",
      "cache-control",
    ].forEach((name) => {
      const value = upstream.headers?.[name];
      if (value !== undefined) res.setHeader(name, value);
    });

    if (!res.getHeader("Cache-Control")) {
      res.setHeader("Cache-Control", "public, max-age=300");
    }

    res.status(upstream.status === 206 ? 206 : 200);

    res.on("close", () => {
      if (!res.writableEnded && !upstream.data.destroyed) {
        upstream.data.destroy();
      }
    });

    upstream.data.on("error", (error) => {
      console.error("Audius stream pipe error:", error?.message || error);
      if (!res.headersSent) res.status(502).end();
      else res.end();
    });

    upstream.data.pipe(res);
  } catch (error) {
    const upstreamStatus = Number(error?.response?.status);
    const status =
      Number.isFinite(upstreamStatus) && upstreamStatus >= 400 && upstreamStatus < 600
        ? upstreamStatus
        : 502;

    console.error("Audius stream failed:", status, error?.message || error);

    if (!res.headersSent) {
      return res.status(status).json({
        success: false,
        message: "Audius audio is temporarily unavailable",
      });
    }

    res.end();
  }
};

export const getAudiusStatus = (_req, res) => {
  const config = getAudiusConfigState();

  res.json({
    success: true,
    provider: "audius",
    configured: isAudiusConfigured(),
    ...config,
  });
};
