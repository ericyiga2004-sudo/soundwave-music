import Song from "../models/uploadSongModel.js";
import User from "../models/userModel.js";
import Artist from "../models/artistModel.js";

import {
  buildPreferenceMatchQuery,
  getSafeLimit,
  getSongIdList,
  getUserRecommendationProfile,
  mergeMongoQueries,
  rankSongsForUser,
} from "../utils/recommendationHelper.js";

const populateSong = (query) => {
  return query
    .populate("artist")
    .populate("featuredArtists")
    .populate("album");
};

const getAuthUser = async (userId) => {
  return User.findById(userId)
    .populate("followedArtists")
    .populate("likedSongs")
    .populate({
      path: "history.song",
      populate: [
        {
          path: "artist",
        },
        {
          path: "album",
        },
      ],
    });
};

const uniqueSongs = (songs = []) => {
  const seen = new Set();

  return songs.filter((song) => {
    const id = song?._id?.toString();

    if (!id || seen.has(id)) {
      return false;
    }

    seen.add(id);
    return true;
  });
};

const fetchPersonalizedSongs = async ({
  user,
  baseQuery = {},
  sort = {
    plays: -1,
    likes: -1,
    createdAt: -1,
  },
  limit = 20,
  candidateLimit = 150,
  excludeIds = [],
}) => {
  const profile = getUserRecommendationProfile(user);

  const finalBaseQuery = {
    status: "published",
    ...baseQuery,
  };

  if (excludeIds.length > 0) {
    finalBaseQuery._id = {
      $nin: excludeIds,
    };
  }

  const preferenceQuery = buildPreferenceMatchQuery(profile);
  const personalizedQuery = mergeMongoQueries(finalBaseQuery, preferenceQuery);

  let songs = await populateSong(Song.find(personalizedQuery))
    .sort(sort)
    .limit(candidateLimit)
    .lean();

  if (songs.length < limit) {
    const fallbackSongs = await populateSong(Song.find(finalBaseQuery))
      .sort(sort)
      .limit(candidateLimit)
      .lean();

    songs = uniqueSongs([...songs, ...fallbackSongs]);
  }

  return rankSongsForUser(user, songs).slice(0, limit);
};

const rankArtistsForUser = (user, artists = []) => {
  const profile = getUserRecommendationProfile(user);

  const artistScoreMap = profile.scoreMaps.artist;
  const countryScoreMap = profile.scoreMaps.country;

  const followedIds = new Set(
    (user.followedArtists || []).map((artist) => {
      if (artist?._id) return artist._id.toString();
      return artist.toString();
    })
  );

  return [...artists]
    .map((artist) => {
      const plainArtist =
        typeof artist.toObject === "function" ? artist.toObject() : { ...artist };

      const artistId = plainArtist._id?.toString();

      let recommendationScore = 0;

      if (followedIds.has(artistId)) {
        recommendationScore += 100;
      }

      recommendationScore += Number(
        artistScoreMap.get(artistId?.toLowerCase()) || 0
      ) * 1.4;

      recommendationScore += Number(
        countryScoreMap.get(plainArtist.country?.toLowerCase()) || 0
      );

      recommendationScore += Number(plainArtist.followers || 0) * 0.05;

      if (plainArtist.verified) {
        recommendationScore += 5;
      }

      return {
        ...plainArtist,
        recommendationScore,
      };
    })
    .sort((a, b) => {
      if (b.recommendationScore !== a.recommendationScore) {
        return b.recommendationScore - a.recommendationScore;
      }

      return Number(b.followers || 0) - Number(a.followers || 0);
    });
};

const fetchRecommendedArtists = async (user, limit = 20) => {
  const profile = getUserRecommendationProfile(user);

  const followedIds = (user.followedArtists || [])
    .map((artist) => {
      if (artist?._id) return artist._id;
      return artist;
    })
    .filter(Boolean);

  const preferredArtistIds = profile.topArtists.filter(Boolean);

  const queries = [];

  if (followedIds.length > 0 || preferredArtistIds.length > 0) {
    queries.push({
      _id: {
        $in: [...followedIds, ...preferredArtistIds],
      },
    });
  }

  if (profile.topCountries.length > 0) {
    queries.push({
      country: {
        $in: profile.topCountries,
      },
    });
  }

  const preferredArtists =
    queries.length > 0
      ? await Artist.find({
          $or: queries,
        })
          .limit(100)
          .lean()
      : [];

  const popularArtists = await Artist.find()
    .sort({
      followers: -1,
      createdAt: -1,
    })
    .limit(100)
    .lean();

  const artists = [];
  const seen = new Set();

  [...preferredArtists, ...popularArtists].forEach((artist) => {
    const id = artist?._id?.toString();

    if (!id || seen.has(id)) return;

    seen.add(id);
    artists.push(artist);
  });

  return rankArtistsForUser(user, artists).slice(0, limit);
};

export const getHomeRecommendations = async (req, res) => {
  try {
    const user = await getAuthUser(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const limit = getSafeLimit(req.query.limit, 20, 50);

    const likedIds = getSongIdList(user.likedSongs);
    const historyIds = getSongIdList(user.history);

    const [
      forYou,
      trending,
      newReleases,
      mostLiked,
      discover,
      artists,
      yearsSongs,
    ] = await Promise.all([
      fetchPersonalizedSongs({
        user,
        limit,
        sort: {
          plays: -1,
          likes: -1,
          createdAt: -1,
        },
      }),

      fetchPersonalizedSongs({
        user,
        limit: 15,
        sort: {
          plays: -1,
          likes: -1,
          createdAt: -1,
        },
      }),

      fetchPersonalizedSongs({
        user,
        limit: 15,
        sort: {
          releaseDate: -1,
          createdAt: -1,
        },
      }),

      fetchPersonalizedSongs({
        user,
        limit: 15,
        sort: {
          likes: -1,
          plays: -1,
          createdAt: -1,
        },
      }),

      fetchPersonalizedSongs({
        user,
        limit: 15,
        excludeIds: [...likedIds, ...historyIds],
        sort: {
          createdAt: -1,
          plays: -1,
        },
      }),

      fetchRecommendedArtists(user, 20),

      fetchPersonalizedSongs({
        user,
        limit: 20,
        baseQuery: {},
        sort: {
          releaseYear: -1,
          plays: -1,
        },
      }),
    ]);

    const profile = getUserRecommendationProfile(user);

    return res.json({
      success: true,
      sections: {
        forYou,
        trending,
        newReleases,
        mostLiked,
        discover,
        artists,
        yearsSongs,
      },
      preferences: {
        countries: profile.countries,
        genres: profile.genres,
        moods: profile.moods,
        languages: profile.languages,
        years: profile.years,
        artists: profile.artists,
      },
    });
  } catch (error) {
    console.error("Home Recommendations Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getForYouRecommendations = async (req, res) => {
  try {
    const user = await getAuthUser(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const songs = await fetchPersonalizedSongs({
      user,
      limit: getSafeLimit(req.query.limit, 30, 100),
      sort: {
        plays: -1,
        likes: -1,
        createdAt: -1,
      },
    });

    return res.json({
      success: true,
      songs,
    });
  } catch (error) {
    console.error("For You Recommendations Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getTrendingRecommendations = async (req, res) => {
  try {
    const user = await getAuthUser(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const songs = await fetchPersonalizedSongs({
      user,
      limit: getSafeLimit(req.query.limit, 20, 100),
      sort: {
        plays: -1,
        likes: -1,
        createdAt: -1,
      },
    });

    return res.json({
      success: true,
      songs,
    });
  } catch (error) {
    console.error("Trending Recommendations Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getNewReleaseRecommendations = async (req, res) => {
  try {
    const user = await getAuthUser(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const songs = await fetchPersonalizedSongs({
      user,
      limit: getSafeLimit(req.query.limit, 20, 100),
      sort: {
        releaseDate: -1,
        createdAt: -1,
      },
    });

    return res.json({
      success: true,
      songs,
    });
  } catch (error) {
    console.error("New Release Recommendations Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getMostLikedRecommendations = async (req, res) => {
  try {
    const user = await getAuthUser(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const songs = await fetchPersonalizedSongs({
      user,
      limit: getSafeLimit(req.query.limit, 20, 100),
      sort: {
        likes: -1,
        plays: -1,
        createdAt: -1,
      },
    });

    return res.json({
      success: true,
      songs,
    });
  } catch (error) {
    console.error("Most Liked Recommendations Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getArtistRecommendations = async (req, res) => {
  try {
    const user = await getAuthUser(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const artists = await fetchRecommendedArtists(
      user,
      getSafeLimit(req.query.limit, 20, 100)
    );

    return res.json({
      success: true,
      artists,
    });
  } catch (error) {
    console.error("Artist Recommendations Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getYearRecommendations = async (req, res) => {
  try {
    const user = await getAuthUser(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const profile = getUserRecommendationProfile(user);

    const { from, to, fromYear, toYear } = req.query;

    const startYear = Number(fromYear || from);
    const endYear = Number(toYear || to);

    const baseQuery = {};

    if (Number.isFinite(startYear) || Number.isFinite(endYear)) {
      baseQuery.releaseYear = {};

      if (Number.isFinite(startYear)) {
        baseQuery.releaseYear.$gte = startYear;
      }

      if (Number.isFinite(endYear)) {
        baseQuery.releaseYear.$lte = endYear;
      }
    } else if (profile.topYears.length > 0) {
      baseQuery.releaseYear = {
        $in: profile.topYears,
      };
    }

    const songs = await fetchPersonalizedSongs({
      user,
      baseQuery,
      limit: getSafeLimit(req.query.limit, 30, 100),
      sort: {
        releaseYear: -1,
        plays: -1,
        likes: -1,
      },
    });

    return res.json({
      success: true,
      years: profile.years,
      songs,
    });
  } catch (error) {
    console.error("Year Recommendations Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getSingleYearRecommendations = async (req, res) => {
  try {
    const user = await getAuthUser(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const year = Number(req.params.year);

    if (!Number.isFinite(year)) {
      return res.status(400).json({
        success: false,
        message: "Invalid year",
      });
    }

    const songs = await fetchPersonalizedSongs({
      user,
      baseQuery: {
        releaseYear: year,
      },
      limit: getSafeLimit(req.query.limit, 50, 100),
      sort: {
        plays: -1,
        likes: -1,
        createdAt: -1,
      },
    });

    return res.json({
      success: true,
      year,
      songs,
    });
  } catch (error) {
    console.error("Single Year Recommendations Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getDiscoverRecommendations = async (req, res) => {
  try {
    const user = await getAuthUser(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const likedIds = getSongIdList(user.likedSongs);
    const historyIds = getSongIdList(user.history);

    const songs = await fetchPersonalizedSongs({
      user,
      excludeIds: [...likedIds, ...historyIds],
      limit: getSafeLimit(req.query.limit, 30, 100),
      sort: {
        createdAt: -1,
        plays: -1,
        likes: -1,
      },
    });

    return res.json({
      success: true,
      songs,
    });
  } catch (error) {
    console.error("Discover Recommendations Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getLikedBasedRecommendations = async (req, res) => {
  try {
    const user = await getAuthUser(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const likedIds = getSongIdList(user.likedSongs);

    const songs = await fetchPersonalizedSongs({
      user,
      excludeIds: likedIds,
      limit: getSafeLimit(req.query.limit, 30, 100),
      sort: {
        likes: -1,
        plays: -1,
        createdAt: -1,
      },
    });

    return res.json({
      success: true,
      likedSongsCount: likedIds.length,
      songs,
    });
  } catch (error) {
    console.error("Liked Based Recommendations Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getHistoryBasedRecommendations = async (req, res) => {
  try {
    const user = await getAuthUser(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const historyIds = getSongIdList(user.history);

    const recentSongs = (user.history || [])
      .slice(0, 10)
      .map((item) => item.song)
      .filter(Boolean);

    const recentCountries = [
      ...new Set(recentSongs.map((song) => song.country).filter(Boolean)),
    ];

    const recentGenres = [
      ...new Set(recentSongs.map((song) => song.genre).filter(Boolean)),
    ];

    const recentArtists = [
      ...new Set(
        recentSongs
          .map((song) => {
            if (song.artist?._id) return song.artist._id;
            return song.artist;
          })
          .filter(Boolean)
      ),
    ];

    const baseQuery = {};

    const or = [];

    if (recentCountries.length > 0) {
      or.push({
        country: {
          $in: recentCountries,
        },
      });
    }

    if (recentGenres.length > 0) {
      or.push({
        genre: {
          $in: recentGenres,
        },
      });
    }

    if (recentArtists.length > 0) {
      or.push({
        artist: {
          $in: recentArtists,
        },
      });
    }

    if (or.length > 0) {
      baseQuery.$or = or;
    }

    const songs = await fetchPersonalizedSongs({
      user,
      baseQuery,
      excludeIds: historyIds,
      limit: getSafeLimit(req.query.limit, 30, 100),
      sort: {
        plays: -1,
        likes: -1,
        createdAt: -1,
      },
    });

    return res.json({
      success: true,
      historyCount: historyIds.length,
      songs,
    });
  } catch (error) {
    console.error("History Based Recommendations Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getPreferenceSummary = async (req, res) => {
  try {
    const user = await getAuthUser(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const profile = getUserRecommendationProfile(user);

    return res.json({
      success: true,
      preferences: {
        countries: profile.countries,
        genres: profile.genres,
        moods: profile.moods,
        languages: profile.languages,
        years: profile.years,
        artists: profile.artists,
      },
    });
  } catch (error) {
    console.error("Preference Summary Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};