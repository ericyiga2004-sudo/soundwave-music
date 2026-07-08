const normalizeKey = (value) => {
    if (value === undefined || value === null) return "";
    return value.toString().trim().toLowerCase();
  };
  
  const toId = (value) => {
    if (!value) return "";
    if (value._id) return value._id.toString();
    return value.toString();
  };
  
  const cleanPreferenceValue = (value) => {
    if (value === undefined || value === null || value === "") return false;
  
    const normalized = normalizeKey(value);
  
    if (
      normalized === "" ||
      normalized === "unknown" ||
      normalized === "undefined" ||
      normalized === "null"
    ) {
      return false;
    }
  
    return true;
  };
  
  const sortPreferenceList = (list = [], key, limit = 10) => {
    if (!Array.isArray(list)) return [];
  
    return [...list]
      .filter((item) => cleanPreferenceValue(item?.[key]))
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
      .slice(0, limit);
  };
  
  const buildScoreMap = (list = [], key) => {
    const map = new Map();
  
    if (!Array.isArray(list)) return map;
  
    list.forEach((item) => {
      const value = item?.[key];
  
      if (!cleanPreferenceValue(value)) return;
  
      map.set(normalizeKey(value), Number(item.score || 0));
    });
  
    return map;
  };
  
  const getMapScore = (map, value) => {
    if (!value) return 0;
    return Number(map.get(normalizeKey(value)) || 0);
  };
  
  export const getSafeLimit = (value, fallback = 20, max = 100) => {
    const number = Number(value || fallback);
  
    if (!Number.isFinite(number) || number <= 0) {
      return fallback;
    }
  
    return Math.min(number, max);
  };
  
  export const getUserRecommendationProfile = (user) => {
    const preferences = user?.preferences || {};
  
    const countries = sortPreferenceList(preferences.countries, "name", 20);
    const genres = sortPreferenceList(preferences.genres, "name", 20);
    const moods = sortPreferenceList(preferences.moods, "name", 20);
    const languages = sortPreferenceList(preferences.languages, "name", 20);
    const years = sortPreferenceList(preferences.years, "year", 20);
    const artists = sortPreferenceList(preferences.artists, "artist", 30);
  
    const topCountries = countries.slice(0, 5).map((item) => item.name);
    const topGenres = genres.slice(0, 8).map((item) => item.name);
    const topMoods = moods.slice(0, 8).map((item) => item.name);
    const topLanguages = languages.slice(0, 5).map((item) => item.name);
    const topYears = years.slice(0, 10).map((item) => item.year);
    const topArtists = artists.slice(0, 15).map((item) => item.artist);
  
    return {
      countries,
      genres,
      moods,
      languages,
      years,
      artists,
  
      topCountries,
      topGenres,
      topMoods,
      topLanguages,
      topYears,
      topArtists,
  
      scoreMaps: {
        country: buildScoreMap(countries, "name"),
        genre: buildScoreMap(genres, "name"),
        mood: buildScoreMap(moods, "name"),
        language: buildScoreMap(languages, "name"),
        year: buildScoreMap(years, "year"),
        artist: buildScoreMap(artists, "artist"),
      },
    };
  };
  
  export const buildPreferenceMatchQuery = (profile) => {
    const or = [];
  
    if (profile.topCountries.length > 0) {
      or.push({
        country: {
          $in: profile.topCountries,
        },
      });
    }
  
    if (profile.topGenres.length > 0) {
      or.push({
        genre: {
          $in: profile.topGenres,
        },
      });
    }
  
    if (profile.topMoods.length > 0) {
      or.push({
        mood: {
          $in: profile.topMoods,
        },
      });
    }
  
    if (profile.topLanguages.length > 0) {
      or.push({
        songLanguage: {
          $in: profile.topLanguages,
        },
      });
    }
  
    if (profile.topYears.length > 0) {
      or.push({
        releaseYear: {
          $in: profile.topYears,
        },
      });
    }
  
    if (profile.topArtists.length > 0) {
      or.push({
        artist: {
          $in: profile.topArtists,
        },
      });
  
      or.push({
        featuredArtists: {
          $in: profile.topArtists,
        },
      });
    }
  
    if (or.length === 0) {
      return {};
    }
  
    return {
      $or: or,
    };
  };
  
  export const mergeMongoQueries = (baseQuery = {}, extraQuery = {}) => {
    const hasBase = Object.keys(baseQuery || {}).length > 0;
    const hasExtra = Object.keys(extraQuery || {}).length > 0;
  
    if (hasBase && hasExtra) {
      return {
        $and: [baseQuery, extraQuery],
      };
    }
  
    if (hasBase) return baseQuery;
    if (hasExtra) return extraQuery;
  
    return {};
  };
  
  export const rankSongsForUser = (user, songs = []) => {
    const profile = getUserRecommendationProfile(user);
    const maps = profile.scoreMaps;
  
    return [...songs]
      .map((song) => {
        const plainSong =
          typeof song.toObject === "function" ? song.toObject() : { ...song };
  
        const artistId = toId(plainSong.artist);
        const featuredArtistIds = Array.isArray(plainSong.featuredArtists)
          ? plainSong.featuredArtists.map((artist) => toId(artist)).filter(Boolean)
          : [];
  
        let recommendationScore = 0;
  
        recommendationScore += getMapScore(maps.country, plainSong.country);
        recommendationScore += getMapScore(maps.genre, plainSong.genre);
        recommendationScore += getMapScore(maps.mood, plainSong.mood);
        recommendationScore += getMapScore(maps.language, plainSong.songLanguage);
        recommendationScore += getMapScore(maps.year, plainSong.releaseYear);
  
        recommendationScore += getMapScore(maps.artist, artistId) * 1.3;
  
        featuredArtistIds.forEach((featuredArtistId) => {
          recommendationScore += getMapScore(maps.artist, featuredArtistId) * 0.6;
        });
  
        recommendationScore += Number(plainSong.likes || 0) * 0.05;
        recommendationScore += Number(plainSong.plays || 0) * 0.01;
  
        return {
          ...plainSong,
          recommendationScore,
        };
      })
      .sort((a, b) => {
        if (b.recommendationScore !== a.recommendationScore) {
          return b.recommendationScore - a.recommendationScore;
        }
  
        if (Number(b.likes || 0) !== Number(a.likes || 0)) {
          return Number(b.likes || 0) - Number(a.likes || 0);
        }
  
        if (Number(b.plays || 0) !== Number(a.plays || 0)) {
          return Number(b.plays || 0) - Number(a.plays || 0);
        }
  
        const dateA = new Date(a.releaseDate || a.createdAt || 0).getTime();
        const dateB = new Date(b.releaseDate || b.createdAt || 0).getTime();
  
        return dateB - dateA;
      });
  };
  
  export const getSongIdList = (items = []) => {
    return items
      .map((item) => {
        if (!item) return null;
  
        if (item.song) {
          return toId(item.song);
        }
  
        return toId(item);
      })
      .filter(Boolean);
  };