import axios from "axios";

const AUDIUS_BASE_URL = String(
  process.env.AUDIUS_API_BASE_URL || "https://api.audius.co/v1"
).replace(/\/$/, "");

const AUDIUS_TIMEOUT_MS = Math.max(
  5000,
  Number(process.env.AUDIUS_TIMEOUT_MS || 15000)
);

const clean = (value) => String(value || "").trim();

const numberOr = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getAuthHeaders = () => {
  const bearerToken = clean(process.env.AUDIUS_BEARER_TOKEN);
  return bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {};
};

export const getAudiusConfigState = () => ({
  apiKeyConfigured: Boolean(clean(process.env.AUDIUS_API_KEY)),
  bearerTokenConfigured: Boolean(clean(process.env.AUDIUS_BEARER_TOKEN)),
});

export const isAudiusConfigured = () => {
  const state = getAudiusConfigState();
  return state.apiKeyConfigured && state.bearerTokenConfigured;
};

const requestAudius = async (
  path,
  {
    params = {},
    headers = {},
    responseType = "json",
    timeout = AUDIUS_TIMEOUT_MS,
  } = {}
) => {
  return axios.get(`${AUDIUS_BASE_URL}${path}`, {
    params,
    headers: {
      ...getAuthHeaders(),
      ...headers,
    },
    responseType,
    timeout,
    maxRedirects: 5,
    validateStatus: (status) => status >= 200 && status < 400,
  });
};

const pickArtwork = (track) =>
  track?.artwork?._1000x1000 ||
  track?.artwork?.["1000x1000"] ||
  track?.artwork?._480x480 ||
  track?.artwork?.["480x480"] ||
  track?.artwork?._150x150 ||
  track?.artwork?.["150x150"] ||
  "";

const pickArtistArtwork = (user) =>
  user?.profilePicture?._480x480 ||
  user?.profilePicture?.["480x480"] ||
  user?.profilePicture?._150x150 ||
  user?.profilePicture?.["150x150"] ||
  user?.profile_picture?._480x480 ||
  user?.profile_picture?.["480x480"] ||
  user?.profile_picture?._150x150 ||
  user?.profile_picture?.["150x150"] ||
  "";

const normalizeTags = (tags) => {
  if (Array.isArray(tags)) {
    return tags.map((tag) => clean(tag)).filter(Boolean);
  }

  return clean(tags)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
};

const isTrackStreamable = (track) => {
  const value = track?.isStreamable ?? track?.is_streamable ?? true;
  return value !== false && String(value).toLowerCase() !== "false";
};

export const normalizeAudiusTrack = (track) => {
  const externalId = clean(track?.id || track?.trackId || track?.track_id);
  const user = track?.user || {};
  const userId = clean(user?.id || user?.userId || user?.user_id || user?.handle);
  const releaseDate = track?.releaseDate || track?.release_date || null;
  const releaseYear = releaseDate
    ? Number(String(releaseDate).slice(0, 4)) || undefined
    : undefined;

  return {
    _id: `audius_${externalId}`,
    id: `audius_${externalId}`,
    source: "audius",
    externalSource: "audius",
    externalId,
    isExternal: true,
    isStreamable: isTrackStreamable(track),

    title: clean(track?.title) || "Untitled",
    artist: {
      _id: `audius_user_${userId || "unknown"}`,
      name: clean(user?.name || user?.handle) || "Audius Artist",
      handle: clean(user?.handle),
      imageUrl: pickArtistArtwork(user),
      verified: Boolean(user?.isVerified || user?.is_verified || user?.verified),
      source: "audius",
      isExternal: true,
    },
    featuredArtists: [],
    album: null,

    // Keep the secret Bearer token on the backend. The browser only talks to
    // Soundwave, and Soundwave proxies the Audius stream with Range support.
    audioUrl: externalId
      ? `/api/audius/stream/${encodeURIComponent(externalId)}`
      : "",
    imageUrl: pickArtwork(track),

    genre: clean(track?.genre) || "Unknown",
    tags: normalizeTags(track?.tags),
    mood: clean(track?.mood) || "Unknown",
    duration: numberOr(track?.duration),
    plays: numberOr(track?.playCount ?? track?.play_count),
    likes: numberOr(track?.favoriteCount ?? track?.favorite_count),
    reposts: numberOr(track?.repostCount ?? track?.repost_count),
    releaseDate,
    releaseYear,
    explicit: Boolean(track?.isExplicit || track?.is_explicit),
    permalink: clean(track?.permalink),
    downloadable: Boolean(track?.downloadable),
    status: "published",
  };
};

const unwrapArray = (response) => {
  const payload = response?.data;

  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;

  return [];
};

const normalizePlayableTracks = (response) =>
  unwrapArray(response)
    .map(normalizeAudiusTrack)
    .filter((track) => track.externalId && track.audioUrl && track.isStreamable);

export const getAudiusTrending = async ({
  limit = 60,
  offset = 0,
  time = "week",
  genre,
} = {}) => {
  const response = await requestAudius("/tracks/trending", {
    params: {
      limit: Math.min(Math.max(Number(limit) || 60, 1), 100),
      offset: Math.max(Number(offset) || 0, 0),
      time,
      ...(genre ? { genre: clean(genre) } : {}),
    },
  });

  return normalizePlayableTracks(response);
};

export const searchAudiusTracks = async ({
  query,
  limit = 30,
  offset = 0,
  sortMethod = "popular",
} = {}) => {
  const response = await requestAudius("/tracks/search", {
    params: {
      query: clean(query),
      limit: Math.min(Math.max(Number(limit) || 30, 1), 100),
      offset: Math.max(Number(offset) || 0, 0),
      sort_method: clean(sortMethod) || "popular",
    },
  });

  return normalizePlayableTracks(response);
};

export const openAudiusStream = async (trackId, rangeHeader = "") => {
  const id = clean(trackId);
  if (!id) throw new Error("Missing Audius track id");

  return requestAudius(`/tracks/${encodeURIComponent(id)}/stream`, {
    headers: rangeHeader ? { Range: rangeHeader } : {},
    responseType: "stream",
    timeout: Math.max(AUDIUS_TIMEOUT_MS, 30000),
  });
};
