const HALF_LIFE_DAYS = 45;
const MS_PER_DAY = 86400000;

const normalizeKey = (value) => String(value ?? "").trim().toLowerCase();
const toId = (value) => (value?._id ? value._id.toString() : value ? value.toString() : "");
const valid = (value) => !["", "unknown", "undefined", "null", "nan"].includes(normalizeKey(value));

const decayedScore = (item) => {
  const score = Number(item?.score || 0);
  const time = new Date(item?.updatedAt || 0).getTime();
  if (!time) return score;
  const ageDays = Math.max(0, (Date.now() - time) / MS_PER_DAY);
  return score * Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
};

const sortPreferenceList = (list = [], key, limit = 10) =>
  (Array.isArray(list) ? [...list] : [])
    .filter((item) => valid(item?.[key]))
    .map((item) => ({ ...((item?.toObject && item.toObject()) || item), effectiveScore: decayedScore(item) }))
    .sort((a, b) => Number(b.effectiveScore || 0) - Number(a.effectiveScore || 0))
    .slice(0, limit);

const buildScoreMap = (list = [], key) => {
  const map = new Map();
  for (const item of list) {
    if (valid(item?.[key])) map.set(normalizeKey(item[key]), Number(item.effectiveScore ?? item.score ?? 0));
  }
  return map;
};

const mapScore = (map, value) => Number(map.get(normalizeKey(value)) || 0);

export const getSafeLimit = (value, fallback = 20, max = 100) => {
  const number = Number(value || fallback);
  return Number.isFinite(number) && number > 0 ? Math.min(number, max) : fallback;
};

export const getUserRecommendationProfile = (user) => {
  const p = user?.preferences || {};
  const countries = sortPreferenceList(p.countries, "name", 20);
  const genres = sortPreferenceList(p.genres, "name", 25);
  const moods = sortPreferenceList(p.moods, "name", 25);
  const languages = sortPreferenceList(p.languages, "name", 20);
  const years = sortPreferenceList(p.years, "year", 20);
  const artists = sortPreferenceList(p.artists, "artist", 60);
  const albums = sortPreferenceList(p.albums, "album", 60);
  const songs = sortPreferenceList(p.songs, "song", 80);

  return {
    countries, genres, moods, languages, years, artists, albums, songs,
    topCountries: countries.filter((x) => x.effectiveScore > 0).slice(0, 5).map((x) => x.name),
    topGenres: genres.filter((x) => x.effectiveScore > 0).slice(0, 8).map((x) => x.name),
    topMoods: moods.filter((x) => x.effectiveScore > 0).slice(0, 8).map((x) => x.name),
    topLanguages: languages.filter((x) => x.effectiveScore > 0).slice(0, 6).map((x) => x.name),
    topYears: years.filter((x) => x.effectiveScore > 0).slice(0, 8).map((x) => x.year),
    topArtists: artists.filter((x) => x.effectiveScore > 0).slice(0, 18).map((x) => x.artist),
    topAlbums: albums.filter((x) => x.effectiveScore > 0).slice(0, 18).map((x) => x.album),
    topSongs: songs.filter((x) => x.effectiveScore > 0).slice(0, 24).map((x) => x.song),
    scoreMaps: {
      country: buildScoreMap(countries, "name"), genre: buildScoreMap(genres, "name"),
      mood: buildScoreMap(moods, "name"), language: buildScoreMap(languages, "name"),
      year: buildScoreMap(years, "year"), artist: buildScoreMap(artists, "artist"),
      album: buildScoreMap(albums, "album"), song: buildScoreMap(songs, "song"),
    },
  };
};

export const buildPreferenceMatchQuery = (profile) => {
  const or = [];
  if (profile.topCountries.length) or.push({ country: { $in: profile.topCountries } });
  if (profile.topGenres.length) or.push({ genre: { $in: profile.topGenres } });
  if (profile.topMoods.length) or.push({ mood: { $in: profile.topMoods } });
  if (profile.topLanguages.length) or.push({ songLanguage: { $in: profile.topLanguages } });
  if (profile.topYears.length) or.push({ releaseYear: { $in: profile.topYears } });
  if (profile.topArtists.length) {
    or.push({ artist: { $in: profile.topArtists } });
    or.push({ featuredArtists: { $in: profile.topArtists } });
  }
  if (profile.topAlbums.length) or.push({ album: { $in: profile.topAlbums } });
  if (profile.topSongs.length) or.push({ _id: { $in: profile.topSongs } });
  return or.length ? { $or: or } : {};
};

export const mergeMongoQueries = (baseQuery = {}, extraQuery = {}) => {
  const hasBase = Object.keys(baseQuery || {}).length > 0;
  const hasExtra = Object.keys(extraQuery || {}).length > 0;
  if (hasBase && hasExtra) return { $and: [baseQuery, extraQuery] };
  return hasBase ? baseQuery : hasExtra ? extraQuery : {};
};

const makeReason = (label, value, score) => ({ label, value, score: Math.round(score * 10) / 10 });

const diversify = (ranked, historyIds) => {
  const selected = [];
  const pool = [...ranked];
  const artistCounts = new Map();
  const albumCounts = new Map();

  while (pool.length) {
    const window = pool.slice(0, Math.min(18, pool.length));
    let bestIndex = 0;
    let bestAdjusted = -Infinity;

    window.forEach((song, index) => {
      const artistId = toId(song.artist);
      const albumId = toId(song.album);
      const artistPenalty = Number(artistCounts.get(artistId) || 0) * 5;
      const albumPenalty = Number(albumCounts.get(albumId) || 0) * 3;
      const recentPenalty = historyIds.has(toId(song)) ? 3 : 0;
      const adjusted = song.recommendationScore - artistPenalty - albumPenalty - recentPenalty;
      if (adjusted > bestAdjusted) { bestAdjusted = adjusted; bestIndex = index; }
    });

    const [picked] = pool.splice(bestIndex, 1);
    selected.push(picked);
    const artistId = toId(picked.artist);
    const albumId = toId(picked.album);
    artistCounts.set(artistId, Number(artistCounts.get(artistId) || 0) + 1);
    albumCounts.set(albumId, Number(albumCounts.get(albumId) || 0) + 1);
  }

  return selected;
};

export const rankSongsForUser = (user, songs = []) => {
  const profile = getUserRecommendationProfile(user);
  const maps = profile.scoreMaps;
  const likedIds = new Set((user?.likedSongs || []).map(toId));
  const historyIds = new Set((user?.history || []).slice(0, 15).map((item) => toId(item?.song || item)));

  const ranked = [...songs].map((song) => {
    const s = typeof song.toObject === "function" ? song.toObject() : { ...song };
    const songId = toId(s);
    const artistId = toId(s.artist);
    const albumId = toId(s.album);
    const featuredIds = (s.featuredArtists || []).map(toId).filter(Boolean);
    const reasons = [];
    let score = 0;

    const signals = [
      ["song", "Because you engage with this song", songId, mapScore(maps.song, songId) * 1.8],
      ["artist", "From an artist you enjoy", s.artist?.name || "Artist", mapScore(maps.artist, artistId) * 1.5],
      ["album", "From an album you enjoy", s.album?.title || "Album", mapScore(maps.album, albumId) * 1.25],
      ["language", "Matches your languages", s.songLanguage, mapScore(maps.language, s.songLanguage) * 1.15],
      ["genre", "Matches your genres", s.genre, mapScore(maps.genre, s.genre)],
      ["mood", "Matches your moods", s.mood, mapScore(maps.mood, s.mood) * 0.7],
      ["country", "Matches your regions", s.country, mapScore(maps.country, s.country) * 0.4],
      ["year", "Matches eras you play", s.releaseYear, mapScore(maps.year, s.releaseYear) * 0.25],
    ];

    for (const [, label, value, valueScore] of signals) {
      score += valueScore;
      if (valueScore >= 1 && valid(value)) reasons.push(makeReason(label, value, valueScore));
    }

    for (const id of featuredIds) score += mapScore(maps.artist, id) * 0.55;
    if (likedIds.has(songId)) score += 4;

    // Popularity is intentionally logarithmic so huge play counts cannot drown
    // out personal taste. A small freshness bonus helps discovery.
    score += Math.log1p(Number(s.likes || 0)) * 0.35;
    score += Math.log1p(Number(s.plays || 0)) * 0.18;
    const releaseTime = new Date(s.releaseDate || s.createdAt || 0).getTime();
    if (releaseTime) {
      const ageDays = Math.max(0, (Date.now() - releaseTime) / MS_PER_DAY);
      score += Math.max(0, 2.5 - ageDays / 120);
    }

    return { ...s, recommendationScore: Math.round(score * 100) / 100, recommendationReasons: reasons.sort((a,b) => b.score-a.score).slice(0,3) };
  }).sort((a, b) => b.recommendationScore - a.recommendationScore || Number(b.likes || 0) - Number(a.likes || 0));

  return diversify(ranked, historyIds);
};

export const getSongIdList = (items = []) => items.map((item) => toId(item?.song || item)).filter(Boolean);
