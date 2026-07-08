import React, { useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { FaUserCheck } from "react-icons/fa";
import SongItem from "../SongItem/SongItem";
import { MusicContext } from "../../context/ShopContext";
import "./FollowedArtists.css";

const MAX_FOLLOWED_ARTIST_SONGS = 20;

const shuffleArray = (array) => {
  return [...array].sort(() => Math.random() - 0.5);
};

const getSongArtistId = (song) => {
  return (
    song?.artist?._id ||
    song?.artist ||
    song?.artistId ||
    ""
  ).toString();
};

const FollowedArtists = () => {
  const { songs = [], backendUrl } = useContext(MusicContext);

  const [followedArtists, setFollowedArtists] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchFollowedArtists = async () => {
    try {
      setLoading(true);

      const token = localStorage.getItem("token");

      if (!token) {
        setFollowedArtists([]);
        return;
      }

      const res = await axios.get(`${backendUrl}/api/artists/following`, {
        headers: {
          token,
        },
      });

      if (res.data.success) {
        setFollowedArtists(res.data.artists || []);
      } else {
        setFollowedArtists([]);
      }
    } catch (error) {
      console.log("Fetch followed artists error:", error);
      setFollowedArtists([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFollowedArtists();

    window.addEventListener("artist-follow-updated", fetchFollowedArtists);

    return () => {
      window.removeEventListener("artist-follow-updated", fetchFollowedArtists);
    };
  }, []);

  const followedArtistSongs = useMemo(() => {
    if (!followedArtists.length || !songs.length) return [];

    const followedIds = followedArtists.map((artist) => artist._id?.toString());

    const songsFromFollowedArtists = (songs || []).filter((song) => {
      const artistId = getSongArtistId(song);
      return followedIds.includes(artistId);
    });

    if (!songsFromFollowedArtists.length) return [];

    const groupedByArtist = {};

    songsFromFollowedArtists.forEach((song) => {
      const artistId = getSongArtistId(song);

      if (!groupedByArtist[artistId]) {
        groupedByArtist[artistId] = [];
      }

      groupedByArtist[artistId].push(song);
    });

    const artistGroups = Object.keys(groupedByArtist).map((artistId) => ({
      artistId,
      songs: shuffleArray(groupedByArtist[artistId]),
    }));

    const mixedSongs = [];
    let lastArtistId = null;

    while (
      mixedSongs.length < MAX_FOLLOWED_ARTIST_SONGS &&
      artistGroups.some((group) => group.songs.length > 0)
    ) {
      const availableGroups = artistGroups.filter(
        (group) => group.songs.length > 0
      );

      let possibleGroups = availableGroups.filter(
        (group) => group.artistId !== lastArtistId
      );

      if (possibleGroups.length === 0) {
        possibleGroups = availableGroups;
      }

      const randomGroup =
        possibleGroups[Math.floor(Math.random() * possibleGroups.length)];

      const nextSong = randomGroup.songs.shift();

      if (nextSong) {
        mixedSongs.push(nextSong);
        lastArtistId = randomGroup.artistId;
      }
    }

    return mixedSongs;
  }, [songs, followedArtists]);

  if (!loading && followedArtistSongs.length === 0) {
    return null;
  }

  return (
    <section className="followed-section">
      <div className="followed-glow"></div>

      <div className="followed-header">
        <div>
          <span className="followed-badge">
            <FaUserCheck />
            Following
          </span>

          <h2 className="followed-title">From Artists You Follow</h2>

          <p className="followed-subtitle">
            A random mix from the artists you care about.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="followed-slider">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div className="followed-skeleton-card" key={item}>
              <div className="followed-skeleton-cover"></div>
              <div className="followed-skeleton-line followed-skeleton-title"></div>
              <div className="followed-skeleton-line followed-skeleton-text"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="followed-slider">
          {followedArtistSongs.map((song) => (
            <div className="followed-slide-item" key={song._id}>
              <SongItem song={song} queue={followedArtistSongs} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default FollowedArtists;