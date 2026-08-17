const LIMITS = {
  countries: 20,
  genres: 25,
  moods: 25,
  languages: 20,
  years: 20,
  artists: 60,
  albums: 60,
  songs: 80,
};

const MIN_SCORE = -30;
const MAX_SCORE = 250;

const normalize = (value) => String(value ?? "").trim().toLowerCase();

const isValidPreferenceValue = (value) => {
  const normalized = normalize(value);
  return !["", "unknown", "undefined", "null", "nan"].includes(normalized);
};

export const ensurePreferences = (user) => {
  if (!user.preferences) user.preferences = {};

  for (const key of Object.keys(LIMITS)) {
    if (!Array.isArray(user.preferences[key])) user.preferences[key] = [];
  }

  user.preferences.algorithmVersion = 2;
  return user.preferences;
};

const sameValue = (a, b) => normalize(a) === normalize(b);

export const adjustPreference = (list, key, value, amount = 1, options = {}) => {
  if (!Array.isArray(list) || !isValidPreferenceValue(value)) return;

  const now = options.now || new Date();
  const min = Number.isFinite(options.min) ? options.min : MIN_SCORE;
  const max = Number.isFinite(options.max) ? options.max : MAX_SCORE;
  const existing = list.find((item) => sameValue(item?.[key], value));

  if (existing) {
    const previous = Number(existing.score || 0);
    existing.score = Math.max(min, Math.min(max, previous + Number(amount || 0)));
    existing.updatedAt = now;
  } else {
    list.push({
      [key]: value,
      score: Math.max(min, Math.min(max, Number(amount || 0))),
      updatedAt: now,
    });
  }
};

export const increasePreference = (list, key, value, amount = 1) =>
  adjustPreference(list, key, value, Math.abs(Number(amount || 1)));

export const decreasePreference = (list, key, value, amount = 1) =>
  adjustPreference(list, key, value, -Math.abs(Number(amount || 1)));

export const trimPreferenceList = (list, limit) => {
  if (!Array.isArray(list)) return [];

  list.sort((a, b) => {
    const scoreDiff = Math.abs(Number(b.score || 0)) - Math.abs(Number(a.score || 0));
    if (scoreDiff !== 0) return scoreDiff;
    return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
  });

  if (list.length > limit) list.splice(limit);
  return list;
};

export const compactPreferences = (user) => {
  const preferences = ensurePreferences(user);
  for (const [key, limit] of Object.entries(LIMITS)) {
    trimPreferenceList(preferences[key], limit);
  }
  preferences.lastPersonalizedAt = new Date();
  return preferences;
};

export const applySongPreferenceSignal = (user, song, strength = 1) => {
  if (!user || !song) return;
  const preferences = ensurePreferences(user);
  const amount = Number(strength || 0);

  adjustPreference(preferences.songs, "song", song._id, amount * 1.8);
  adjustPreference(preferences.artists, "artist", song.artist?._id || song.artist, amount * 1.45);
  adjustPreference(preferences.albums, "album", song.album?._id || song.album, amount * 1.2);
  adjustPreference(preferences.genres, "name", song.genre, amount);
  adjustPreference(preferences.languages, "name", song.songLanguage, amount * 1.1);
  adjustPreference(preferences.moods, "name", song.mood, amount * 0.75);
  adjustPreference(preferences.countries, "name", song.country, amount * 0.45);
  adjustPreference(preferences.years, "year", song.releaseYear, amount * 0.25);

  compactPreferences(user);
};

export const applyArtistPreferenceSignal = (user, artist, strength = 1) => {
  if (!user || !artist) return;
  const preferences = ensurePreferences(user);
  adjustPreference(preferences.artists, "artist", artist._id || artist, Number(strength || 0));
  if (artist.country) {
    adjustPreference(preferences.countries, "name", artist.country, Number(strength || 0) * 0.25);
  }
  compactPreferences(user);
};

export const applyAlbumPreferenceSignal = (user, album, strength = 1) => {
  if (!user || !album) return;
  const preferences = ensurePreferences(user);
  adjustPreference(preferences.albums, "album", album._id || album, Number(strength || 0));
  if (album.artist) {
    adjustPreference(preferences.artists, "artist", album.artist?._id || album.artist, Number(strength || 0) * 0.55);
  }
  compactPreferences(user);
};
