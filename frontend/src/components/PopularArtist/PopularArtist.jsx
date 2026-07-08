import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  FaCheckCircle,
  FaUsers,
  FaMapMarkerAlt,
  FaArrowRight,
  FaUserPlus,
  FaUserCheck,
} from "react-icons/fa";
import "./PopularArtist.css";

const backendUrl = import.meta.env.VITE_BACKEND_URL;

const MAX_ARTIST_STATS_SONGS = 300;

const formatFollowers = (value = 0) => {
  const number = Number(value || 0);

  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(number);
};

const getArtistIdFromSong = (song) => {
  return (
    song?.artist?._id ||
    song?.artist ||
    song?.artistId ||
    ""
  ).toString();
};

const getPreferenceArtistId = (item) => {
  return (
    item?.artist?._id ||
    item?.artist ||
    ""
  ).toString();
};

const buildPreferenceScoreMap = (items = [], key = "name") => {
  const map = new Map();

  items.forEach((item) => {
    const value =
      key === "artist" ? getPreferenceArtistId(item) : item?.[key];

    if (value !== undefined && value !== null && value !== "") {
      map.set(value.toString().toLowerCase(), Number(item.score || 0));
    }
  });

  return map;
};

const buildArtistSongStats = (songs = [], moodScoreMap = new Map()) => {
  const statsMap = new Map();

  songs.forEach((song) => {
    const artistId = getArtistIdFromSong(song);

    if (!artistId) return;

    const current = statsMap.get(artistId) || {
      songCount: 0,
      totalLikes: 0,
      totalPlays: 0,
      moodScore: 0,
      newestDate: 0,
    };

    const songLikes = Number(song.likes || 0);
    const songPlays = Number(song.plays || 0);
    const songMood = song.mood?.toString().toLowerCase();
    const moodScore = Number(moodScoreMap.get(songMood) || 0);

    const dateValue = new Date(
      song.releaseDate || song.createdAt || song.updatedAt || 0
    ).getTime();

    current.songCount += 1;
    current.totalLikes += songLikes;
    current.totalPlays += songPlays;
    current.moodScore += moodScore;

    if (!Number.isNaN(dateValue)) {
      current.newestDate = Math.max(current.newestDate, dateValue);
    }

    statsMap.set(artistId, current);
  });

  return statsMap;
};

const sortArtistsByUserTaste = ({
  artists = [],
  songs = [],
  followedArtistIds = [],
  preferences = {},
}) => {
  const followedSet = new Set(
    followedArtistIds.map((id) => id?.toString())
  );

  const artistPreferenceScoreMap = buildPreferenceScoreMap(
    preferences.artists || [],
    "artist"
  );

  const countryScoreMap = buildPreferenceScoreMap(
    preferences.countries || [],
    "name"
  );

  const moodScoreMap = buildPreferenceScoreMap(
    preferences.moods || [],
    "name"
  );

  const artistSongStatsMap = buildArtistSongStats(songs, moodScoreMap);

  return [...artists]
    .map((artist) => {
      const artistId = artist._id?.toString();
      const artistCountry = artist.country?.toString().toLowerCase();

      const songStats = artistSongStatsMap.get(artistId) || {
        songCount: 0,
        totalLikes: 0,
        totalPlays: 0,
        moodScore: 0,
        newestDate: 0,
      };

      const followedBoost = followedSet.has(artistId) ? 100000 : 0;

      // This score already comes from user plays, likes, and follows.
      const userArtistScore = Number(
        artistPreferenceScoreMap.get(artistId?.toLowerCase()) || 0
      );

      const countryScore = Number(
        countryScoreMap.get(artistCountry) || 0
      );

      const verifiedBoost = artist.verified ? 300 : 0;

      const rankingScore =
        followedBoost +
        userArtistScore * 1200 +
        countryScore * 200 +
        songStats.moodScore * 80 +
        songStats.totalLikes * 8 +
        songStats.totalPlays * 2 +
        Number(artist.followers || 0) * 0.1 +
        verifiedBoost;

      return {
        ...artist,
        rankingScore,
        songStats,
      };
    })
    .sort((a, b) => {
      if (b.rankingScore !== a.rankingScore) {
        return b.rankingScore - a.rankingScore;
      }

      if (b.songStats.totalLikes !== a.songStats.totalLikes) {
        return b.songStats.totalLikes - a.songStats.totalLikes;
      }

      if (b.songStats.totalPlays !== a.songStats.totalPlays) {
        return b.songStats.totalPlays - a.songStats.totalPlays;
      }

      return Number(b.followers || 0) - Number(a.followers || 0);
    });
};

const PopularArtist = () => {
  const navigate = useNavigate();

  const [artists, setArtists] = useState([]);
  const [songsForStats, setSongsForStats] = useState([]);
  const [preferences, setPreferences] = useState({});
  const [followedArtists, setFollowedArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followLoadingId, setFollowLoadingId] = useState("");

  const fetchArtists = async () => {
    try {
      setLoading(true);

      const token = localStorage.getItem("token");

      const artistsRequest = axios.get(`${backendUrl}/api/artists`);

      const songsRequest = axios.get(
        `${backendUrl}/api/songs?limit=${MAX_ARTIST_STATS_SONGS}&sort=popular`
      );

      const followedRequest = token
        ? axios.get(`${backendUrl}/api/artists/following`, {
            headers: {
              token,
            },
          })
        : Promise.resolve({
            data: {
              success: true,
              artists: [],
            },
          });

      const preferencesRequest = token
        ? axios.get(`${backendUrl}/api/recommend/preferences`, {
            headers: {
              token,
            },
          })
        : Promise.resolve({
            data: {
              success: true,
              preferences: {},
            },
          });

      const [artistsRes, songsRes, followedRes, preferencesRes] =
        await Promise.all([
          artistsRequest,
          songsRequest,
          followedRequest,
          preferencesRequest,
        ]);

      if (artistsRes.data.success) {
        setArtists(Array.isArray(artistsRes.data.artists) ? artistsRes.data.artists : []);
      } else {
        setArtists([]);
      }

      if (songsRes.data.success) {
        setSongsForStats(Array.isArray(songsRes.data.songs) ? songsRes.data.songs : []);
      } else {
        setSongsForStats([]);
      }

      if (followedRes.data.success) {
        const followedIds = (followedRes.data.artists || []).map(
          (artist) => artist._id
        );

        setFollowedArtists(followedIds);
      } else {
        setFollowedArtists([]);
      }

      if (preferencesRes.data.success) {
        setPreferences(preferencesRes.data.preferences || {});
      } else {
        setPreferences({});
      }
    } catch (error) {
      console.log("Fetch artists error:", error);
      setArtists([]);
      setSongsForStats([]);
      setPreferences({});
      setFollowedArtists([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArtists();

    window.addEventListener("music-history-updated", fetchArtists);
    window.addEventListener("music-liked-updated", fetchArtists);
    window.addEventListener("artist-follow-updated", fetchArtists);

    return () => {
      window.removeEventListener("music-history-updated", fetchArtists);
      window.removeEventListener("music-liked-updated", fetchArtists);
      window.removeEventListener("artist-follow-updated", fetchArtists);
    };
  }, []);

  const sortedArtists = useMemo(() => {
    return sortArtistsByUserTaste({
      artists,
      songs: songsForStats,
      followedArtistIds: followedArtists,
      preferences,
    });
  }, [artists, songsForStats, followedArtists, preferences]);

  const isFollowingArtist = (artistId) => {
    return followedArtists.includes(artistId);
  };

  const handleViewArtist = (artistId) => {
    navigate(`/artist/${artistId}`);
    window.scrollTo(0, 0);
  };

  const handleFollowArtist = async (artistId) => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/account");
      return;
    }

    if (!artistId || followLoadingId) return;

    try {
      setFollowLoadingId(artistId);

      const res = await axios.post(
        `${backendUrl}/api/artists/follow/${artistId}`,
        {},
        {
          headers: {
            token,
          },
        }
      );

      if (res.data.success) {
        setFollowedArtists((current) => {
          if (res.data.following) {
            return current.includes(artistId) ? current : [...current, artistId];
          }

          return current.filter((id) => id !== artistId);
        });

        setArtists((currentArtists) =>
          currentArtists.map((artist) =>
            artist._id === artistId
              ? {
                  ...artist,
                  followers: res.data.followers,
                }
              : artist
          )
        );

        window.dispatchEvent(new Event("artist-follow-updated"));
      }
    } catch (error) {
      console.log("Follow artist error:", error);
    } finally {
      setFollowLoadingId("");
    }
  };

  if (loading) {
    return (
      <section className="popular-artists-section">
        <div className="popular-artists-loading">Loading artists...</div>
      </section>
    );
  }

  return (
    <section className="popular-artists-section">
      <div className="popular-artists-header">
        <div>
          <span className="popular-artists-tag">Top Creators</span>
          <h2>Popular Artists</h2>
          <p>
            Artists ranked by your plays, likes, favorite moods, and their top songs.
          </p>
        </div>

        <button
          type="button"
          className="popular-artists-view-all"
          onClick={() => navigate("/artists")}
        >
          View All
          <FaArrowRight />
        </button>
      </div>

      {sortedArtists.length > 0 ? (
        <div className="popular-artists-grid">
          {sortedArtists.map((artist) => {
            const following = isFollowingArtist(artist._id);
            const buttonLoading = followLoadingId === artist._id;

            return (
              <article className="popular-artist-card" key={artist._id}>
                <div
                  className="popular-artist-image-wrap"
                  onClick={() => handleViewArtist(artist._id)}
                  role="button"
                  tabIndex={0}
                >
                  <img
                    src={artist.image || "/fallback-cover.png"}
                    alt={artist.name || "Artist"}
                    className="popular-artist-image"
                  />

                  {artist.verified && (
                    <span className="popular-artist-verified-badge">
                      <FaCheckCircle />
                    </span>
                  )}
                </div>

                <div className="popular-artist-content">
                  <h3>{artist.name || "Unknown Artist"}</h3>

                  <p className="popular-artist-country">
                    <FaMapMarkerAlt />
                    <span>{artist.country || "Unknown Location"}</span>
                  </p>

                  <div className="popular-artist-stats">
                    <FaUsers />
                    <span>{formatFollowers(artist.followers)} followers</span>
                  </div>

                  <div className="popular-artist-actions">
                    <button
                      type="button"
                      className={`popular-artist-follow-btn ${
                        following ? "following" : ""
                      }`}
                      onClick={() => handleFollowArtist(artist._id)}
                      disabled={buttonLoading}
                    >
                      {buttonLoading ? (
                        "..."
                      ) : following ? (
                        <>
                          <FaUserCheck />
                          Following
                        </>
                      ) : (
                        <>
                          <FaUserPlus />
                          Follow
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      className="popular-artist-button"
                      onClick={() => handleViewArtist(artist._id)}
                    >
                      View
                      <FaArrowRight />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="popular-artists-empty">No popular artists found.</div>
      )}
    </section>
  );
};

export default PopularArtist;