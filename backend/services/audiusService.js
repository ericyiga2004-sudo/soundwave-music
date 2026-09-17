import axios from "axios";

const AUDIUS_BASE_URL = String(
  process.env.AUDIUS_API_BASE_URL || "https://api.audius.co/v1"
).replace(/\/$/, "");

const AUDIUS_TIMEOUT_MS = Math.max(5000, Number(process.env.AUDIUS_TIMEOUT_MS || 15000));
const CACHE_TTL_MS = Math.max(30000, Number(process.env.AUDIUS_CACHE_TTL_MS || 180000));
const STALE_TTL_MS = Math.max(CACHE_TTL_MS, Number(process.env.AUDIUS_STALE_TTL_MS || 1800000));
const RETRIES = Math.min(Math.max(Number(process.env.AUDIUS_RETRIES || 2), 0), 4);

const cache = new Map();
const clean = (value) => String(value || "").trim();
const numberOr = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

const shouldRetry = (error) => {
  const status = Number(error?.response?.status || 0);
  return !status || status === 408 || status === 425 || status === 429 || status >= 500;
};

const requestAudius = async (
  path,
  { params = {}, headers = {}, responseType = "json", timeout = AUDIUS_TIMEOUT_MS, retries = RETRIES } = {}
) => {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await axios.get(`${AUDIUS_BASE_URL}${path}`, {
        params,
        headers: { ...getAuthHeaders(), ...headers },
        responseType,
        timeout,
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400,
      });
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !shouldRetry(error)) break;
      await sleep(250 * 2 ** attempt + Math.floor(Math.random() * 180));
    }
  }
  throw lastError;
};

const getCached = async (key, loader) => {
  const now = Date.now();
  const existing = cache.get(key);
  if (existing?.value && now - existing.updatedAt < CACHE_TTL_MS) {
    return { value: existing.value, stale: false, cacheHit: true };
  }
  if (existing?.promise) return existing.promise;

  const pending = (async () => {
    try {
      const value = await loader();
      cache.set(key, { value, updatedAt: Date.now() });
      return { value, stale: false, cacheHit: false };
    } catch (error) {
      const staleEntry = cache.get(key);
      if (staleEntry?.value && now - staleEntry.updatedAt < STALE_TTL_MS) {
        return { value: staleEntry.value, stale: true, cacheHit: true, error };
      }
      throw error;
    }
  })();

  cache.set(key, { ...(existing || {}), promise: pending, updatedAt: existing?.updatedAt || 0 });
  try {
    return await pending;
  } finally {
    const current = cache.get(key);
    if (current?.promise === pending) {
      const { promise, ...rest } = current;
      cache.set(key, rest);
    }
  }
};

const pickArtwork = (source) =>
  source?.artwork?._1000x1000 || source?.artwork?.["1000x1000"] ||
  source?.artwork?._480x480 || source?.artwork?.["480x480"] ||
  source?.artwork?._150x150 || source?.artwork?.["150x150"] ||
  source?.coverArt?._1000x1000 || source?.cover_art?._1000x1000 || "";

const pickArtistArtwork = (user) =>
  user?.profilePicture?._1000x1000 || user?.profile_picture?._1000x1000 ||
  user?.profilePicture?._480x480 || user?.profilePicture?.["480x480"] ||
  user?.profile_picture?._480x480 || user?.profile_picture?.["480x480"] ||
  user?.profilePicture?._150x150 || user?.profile_picture?._150x150 || "";

const normalizeTags = (tags) => Array.isArray(tags)
  ? tags.map(clean).filter(Boolean)
  : clean(tags).split(",").map((tag) => tag.trim()).filter(Boolean);

const isTrackStreamable = (track) => {
  const value = track?.isStreamable ?? track?.is_streamable ?? true;
  return value !== false && String(value).toLowerCase() !== "false";
};

const extractAlbum = (track, artist) => {
  const raw = track?.album || track?.playlist || track?.albumBacklink || track?.album_backlink || null;
  const id = clean(
    raw?.id || raw?.playlistId || raw?.playlist_id || track?.albumId || track?.album_id ||
    track?.playlistId || track?.playlist_id
  );
  const title = clean(raw?.name || raw?.title || track?.albumName || track?.album_name);
  // Only expose an album route when Audius gives us a concrete playlist/album
  // id. A title alone is not enough to create a resolvable link.
  if (!id) return null;
  return {
    _id: `audius_album_${id}`,
    externalId: id,
    title: title || "Audius Album",
    name: title || "Audius Album",
    imageUrl: pickArtwork(raw) || pickArtwork(track),
    coverImage: pickArtwork(raw) || pickArtwork(track),
    artist,
    source: "audius",
    externalSource: "audius",
    isExternal: true,
    isAlbum: true,
  };
};

export const normalizeAudiusUser = (user = {}) => {
  const userId = clean(user?.id || user?.userId || user?.user_id || user?.handle);
  return {
    _id: `audius_user_${userId || "unknown"}`,
    externalId: userId,
    name: clean(user?.name || user?.handle) || "Audius Artist",
    handle: clean(user?.handle),
    imageUrl: pickArtistArtwork(user) || "/fallback-artist.svg",
    image: pickArtistArtwork(user) || "/fallback-artist.svg",
    followers: numberOr(user?.followerCount ?? user?.follower_count),
    verified: Boolean(user?.isVerified || user?.is_verified || user?.verified),
    bio: clean(user?.bio),
    country: clean(user?.country || user?.location) || "Unknown",
    source: "audius",
    externalSource: "audius",
    isExternal: true,
  };
};

export const normalizeAudiusTrack = (track = {}) => {
  const externalId = clean(track?.id || track?.trackId || track?.track_id);
  const artist = normalizeAudiusUser(track?.user || {});
  const releaseDate = track?.releaseDate || track?.release_date || track?.createdAt || track?.created_at || null;
  const releaseYear = releaseDate ? Number(String(releaseDate).slice(0, 4)) || undefined : undefined;
  const album = extractAlbum(track, artist);

  return {
    _id: `audius_${externalId}`,
    id: `audius_${externalId}`,
    source: "audius",
    externalSource: "audius",
    externalId,
    isExternal: true,
    isStreamable: isTrackStreamable(track),
    title: clean(track?.title) || "Untitled",
    artist,
    featuredArtists: [],
    album,
    audioUrl: externalId ? `/api/audius/stream/${encodeURIComponent(externalId)}` : "",
    imageUrl: pickArtwork(track) || artist.imageUrl || "/fallback-cover.svg",
    genre: clean(track?.genre) || "Unknown",
    tags: normalizeTags(track?.tags),
    mood: clean(track?.mood) || "Unknown",
    country: clean(track?.country || track?.user?.country || track?.user?.location) || "Unknown",
    songLanguage: clean(track?.language || track?.songLanguage || track?.song_language) || "Unknown",
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

const unwrapObject = (response) => response?.data?.data || response?.data || null;
const normalizePlayableTracks = (response) => unwrapArray(response)
  .map(normalizeAudiusTrack)
  .filter((track) => track.externalId && track.audioUrl && track.isStreamable);

export const getAudiusTrendingMeta = async ({ limit = 60, offset = 0, time = "week", genre } = {}) => {
  const safe = {
    limit: Math.min(Math.max(Number(limit) || 60, 1), 100),
    offset: Math.max(Number(offset) || 0, 0),
    time: clean(time) || "week",
    genre: clean(genre),
  };
  return getCached(`trending:${safe.limit}:${safe.offset}:${safe.time}:${safe.genre}`, async () => {
    const response = await requestAudius("/tracks/trending", {
      params: { limit: safe.limit, offset: safe.offset, time: safe.time, ...(safe.genre ? { genre: safe.genre } : {}) },
    });
    return normalizePlayableTracks(response);
  });
};

export const getAudiusTrending = async (options = {}) => (await getAudiusTrendingMeta(options)).value;

export const searchAudiusTracksMeta = async ({ query, limit = 30, offset = 0, sortMethod = "popular" } = {}) => {
  const q = clean(query);
  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  return getCached(`search:${q.toLowerCase()}:${safeLimit}:${safeOffset}:${sortMethod}`, async () => {
    const response = await requestAudius("/tracks/search", {
      params: { query: q, limit: safeLimit, offset: safeOffset, sort_method: clean(sortMethod) || "popular" },
    });
    return normalizePlayableTracks(response);
  });
};

export const searchAudiusTracks = async (options = {}) => (await searchAudiusTracksMeta(options)).value;


const uniqueArtistsFromTracks = (tracks = []) => {
  const byId = new Map();
  for (const track of tracks) {
    const artist = track?.artist;
    const id = clean(artist?.externalId || artist?._id).replace(/^audius_user_/, "");
    if (!id) continue;
    const normalized = {
      ...artist,
      _id: `audius_user_${id}`,
      externalId: id,
      source: "audius",
      externalSource: "audius",
      isExternal: true,
    };
    const current = byId.get(id);
    if (!current || numberOr(normalized.followers) > numberOr(current.followers)) {
      byId.set(id, normalized);
    }
  }
  return [...byId.values()];
};

const sortAudiusArtists = (artists = [], sort = "followers") => {
  const copy = [...artists];
  if (sort === "name") {
    return copy.sort((a, b) => clean(a?.name).localeCompare(clean(b?.name)));
  }
  return copy.sort((a, b) => numberOr(b?.followers) - numberOr(a?.followers));
};

export const getAudiusArtistsMeta = async ({ limit = 36, offset = 0, query = "", sort = "followers" } = {}) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 36, 1), 60);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const q = clean(query);
  const key = `artists:${q.toLowerCase()}:${safeLimit}:${safeOffset}:${sort}`;

  return getCached(key, async () => {
    let artists = [];

    // Audius supports user search through the API. Try it first for explicit
    // artist searches, then fall back to track-derived artists if the upstream
    // user search is temporarily unavailable or returns nothing.
    if (q) {
      try {
        const response = await requestAudius("/users/search", {
          params: { query: q, limit: 100, offset: 0 },
        });
        artists = unwrapArray(response)
          .map(normalizeAudiusUser)
          .filter((artist) => artist.externalId);
      } catch {
        artists = [];
      }
    }

    if (!artists.length) {
      const trackResult = q
        ? await searchAudiusTracksMeta({ query: q, limit: 100, offset: 0, sortMethod: "popular" })
        : await getAudiusTrendingMeta({ limit: 100, offset: 0, time: "month" });
      artists = uniqueArtistsFromTracks(trackResult.value || []);
    }

    if (q) {
      const qLower = q.toLowerCase();
      artists = artists.filter((artist) => {
        const name = clean(artist?.name).toLowerCase();
        const handle = clean(artist?.handle).toLowerCase();
        return name.includes(qLower) || handle.includes(qLower) || !name;
      });
    }

    const deduped = [];
    const seen = new Set();
    for (const artist of artists) {
      const id = clean(artist?.externalId || artist?._id).replace(/^audius_user_/, "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      deduped.push(artist);
    }

    const sorted = sortAudiusArtists(deduped, sort);
    return {
      artists: sorted.slice(safeOffset, safeOffset + safeLimit),
      total: sorted.length,
      hasMore: safeOffset + safeLimit < sorted.length,
    };
  });
};

export const getAudiusArtists = async (options = {}) => (await getAudiusArtistsMeta(options)).value;

export const getAudiusTrack = async (trackId) => {
  const id = clean(trackId).replace(/^audius_/, "");
  const meta = await getCached(`track:${id}`, async () => {
    const response = await requestAudius(`/tracks/${encodeURIComponent(id)}`);
    return normalizeAudiusTrack(unwrapObject(response) || {});
  });
  return meta.value;
};

export const getAudiusUser = async (userId) => {
  const id = clean(userId).replace(/^audius_user_/, "");
  const meta = await getCached(`user:${id}`, async () => {
    const response = await requestAudius(`/users/${encodeURIComponent(id)}`);
    return normalizeAudiusUser(unwrapObject(response) || {});
  });
  return meta.value;
};

export const getAudiusUserTracks = async (userId, { limit = 100, offset = 0 } = {}) => {
  const id = clean(userId).replace(/^audius_user_/, "");
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 100);
  const meta = await getCached(`usertracks:${id}:${safeLimit}:${offset}`, async () => {
    const response = await requestAudius(`/users/${encodeURIComponent(id)}/tracks`, {
      params: { limit: safeLimit, offset: Math.max(Number(offset) || 0, 0) },
    });
    return normalizePlayableTracks(response);
  });
  return meta.value;
};

export const getAudiusAlbum = async (albumId) => {
  const id = clean(albumId).replace(/^audius_album_/, "");
  const meta = await getCached(`album:${id}`, async () => {
    const response = await requestAudius(`/playlists/${encodeURIComponent(id)}`);
    const raw = unwrapObject(response) || {};
    const owner = normalizeAudiusUser(raw?.user || {});
    const tracksRaw = raw?.tracks || raw?.playlistContents || raw?.playlist_contents || [];
    const songs = Array.isArray(tracksRaw)
      ? tracksRaw.map((item) => normalizeAudiusTrack(item?.track || item)).filter((song) => song.externalId)
      : [];
    return {
      _id: `audius_album_${id}`,
      externalId: id,
      title: clean(raw?.playlistName || raw?.playlist_name || raw?.name || raw?.title) || "Audius Album",
      description: clean(raw?.description),
      coverImage: pickArtwork(raw),
      imageUrl: pickArtwork(raw),
      artist: owner,
      releaseDate: raw?.createdAt || raw?.created_at || null,
      songs,
      source: "audius",
      externalSource: "audius",
      isExternal: true,
      isAlbum: true,
    };
  });
  return meta.value;
};

export const openAudiusStream = async (trackId, rangeHeader = "") => {
  const id = clean(trackId).replace(/^audius_/, "");
  if (!id) throw new Error("Missing Audius track id");
  return requestAudius(`/tracks/${encodeURIComponent(id)}/stream`, {
    headers: rangeHeader ? { Range: rangeHeader } : {},
    responseType: "stream",
    timeout: Math.max(AUDIUS_TIMEOUT_MS, 30000),
    retries: 1,
  });
};
