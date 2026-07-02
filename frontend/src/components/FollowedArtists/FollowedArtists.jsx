import React, { useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { FaUserCheck } from "react-icons/fa";
import SongItem from "../SongItem/SongItem";
import { MusicContext } from "../../context/ShopContext";
import "./FollowedArtists.css";

const MAX_FOLLOWED_ARTIST_SONGS = 20;

const FollowedArtists = () => {
  const { songs = [], backendUrl } = useContext(MusicContext);

  const [followedArtists, setFollowedArtists] = useState([]);
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem("token");

  const fetchFollowedArtists = async () => {
    if (!token) {
      setFollowedArtists([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

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
  }, []);

  const followedArtistSongs = useMemo(() => {
    if (!followedArtists.length) return [];

    const followedIds = followedArtists.map((artist) => artist._id);

    return (songs || [])
      .filter((song) => {
        const artistId = song?.artist?._id || song?.artist || song?.artistId;
        return followedIds.includes(artistId?.toString());
      })
      .slice(0, MAX_FOLLOWED_ARTIST_SONGS);
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
            Fresh picks from the artists you care about.
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