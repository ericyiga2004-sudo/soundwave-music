import React, {
  useState,
  useContext,
} from "react";
import axios from "axios";
import {
  FaMusic,
  FaUser,
  FaEnvelope,
  FaLock,
  FaClock,
  FaPlay,
} from "react-icons/fa";


import "./CSS/Account.css";
import { MusicContext } from "../context/ShopContext";
import { MusicPlayerContext } from "../context/MainPlayerContext";
import SongItem from "../components/SongItem/SongItem";

const Account = () => {
  const {
    token,
    setToken,
    logout,
    backendUrl,
    historySongs,
  } = useContext(MusicContext);

  const { playSong } = useContext(MusicPlayerContext);

  const [mode, setMode] = useState("login");

  const [username, setUsername] = useState("");

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const submitHandler = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);

      const endpoint =
        mode === "login"
          ? "/api/user/login"
          : "/api/user/register";

      const payload =
        mode === "login"
          ? {
              email,
              password,
            }
          : {
              username,
              email,
              password,
            };

      const res = await axios.post(
        `${backendUrl}${endpoint}`,
        payload
      );

      if (res.data.success) {
        setToken(res.data.token);

        setEmail("");
        setPassword("");
        setUsername("");
      } else {
        alert(res.data.message);
      }
    } catch (error) {
      console.log(error);

      alert(
        error.response?.data?.message ||
          "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  };

  const formatPlayedAt = (date) => {
    if (!date) return "Recently";

    return new Date(date).toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getSongImage = (song) => {
    return (
      song?.imageUrl ||
      song?.image ||
      song?.coverImage ||
      song?.thumbnail ||
      song?.album?.imageUrl ||
      song?.album?.image ||
      ""
    );
  };

  const getSongTitle = (song) => {
    return song?.title || song?.name || "Unknown Song";
  };

  const getArtistName = (song) => {
    if (typeof song?.artist === "string") {
      return song.artist;
    }

    return (
      song?.artist?.name ||
      song?.artist?.username ||
      song?.artist?.artistName ||
      "Unknown Artist"
    );
  };

  // ==========================
  // LOGGED IN
  // ==========================
  if (token) {
    return (
      <div className="account-dashboard">
        <div className="dashboard-card">
          <div className="dashboard-avatar">
            <FaUser />
          </div>

          <h1>Welcome Back</h1>

          <p>
            You are successfully logged in.
          </p>

          <button
            className="logout-btn"
            onClick={logout}
          >
            Logout
          </button>
        </div>

        <div className="history-section">
          <div className="history-header">
            <div className="history-heading">
              <FaClock />
              <h2>Listening History</h2>
            </div>

            <p>
              Recently played songs from your account.
            </p>
          </div>

          {historySongs && historySongs.length > 0 ? (
  <div className="history-grid">
    {historySongs.map((item) => {
      const song = item.song;

      if (!song) return null;

      const historyQueue = historySongs
        .map((historyItem) => historyItem.song)
        .filter(Boolean);

      const handlePlay = (e) => {
        e.preventDefault();
        e.stopPropagation();
        playSong(song, historyQueue);
      };

      return (
        <div
          className="history-song-card"
          key={item._id || `${song._id}-${item.playedAt}`}
        >
          {/* <Link
            to={`/song/${song._id}`}
            className="history-song-link"
          >
            <div className="history-song-img-container">
              {getSongImage(song) ? (
                <img
                  src={getSongImage(song)}
                  alt={getSongTitle(song)}
                />
              ) : (
                <div className="history-song-placeholder">
                  <FaMusic />
                </div>
              )}

              <button
                type="button"
                className="history-play-overlay"
                onClick={handlePlay}
              >
                <FaPlay />
              </button>
            </div>

            <div className="history-song-content">
              <h3>{getSongTitle(song)}</h3>

              <p>{getArtistName(song)}</p>

              <span>
                Played {formatPlayedAt(item.playedAt)}
              </span>
            </div>
          </Link> */}

            {
              <SongItem key={song._id} song={song}/>
            }

        </div>
      );
    })}
  </div>
) : (
  <div className="empty-history">
    <FaMusic />
    <p>
      No listening history yet. Play a song to see it here.
    </p>
  </div>
)}
        </div>
      </div>
    );
  }

  // ==========================
  // LOGIN / REGISTER
  // ==========================
  return (
    <div className="auth-page">
      <div className="auth-container">
        {/* LEFT SIDE */}
        <div className="auth-left">
          <div className="logo-circle">
            <FaMusic />
          </div>

          <h1>
            Stream Music
            <br />
            Without Limits
          </h1>

          <p>
            Create playlists,
            save favorites,
            access listening history,
            and enjoy your music
            anywhere.
          </p>
        </div>

        {/* RIGHT SIDE */}
        <div className="auth-right">
          <div className="auth-switch">
            <button
              type="button"
              className={
                mode === "login"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setMode("login")
              }
            >
              Login
            </button>

            <button
              type="button"
              className={
                mode === "register"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setMode("register")
              }
            >
              Sign Up
            </button>
          </div>

          <form
            onSubmit={submitHandler}
          >
            {mode === "register" && (
              <div className="input-group">
                <FaUser />

                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) =>
                    setUsername(
                      e.target.value
                    )
                  }
                  required
                />
              </div>
            )}

            <div className="input-group">
              <FaEnvelope />

              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) =>
                  setEmail(
                    e.target.value
                  )
                }
                required
              />
            </div>

            <div className="input-group">
              <FaLock />

              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) =>
                  setPassword(
                    e.target.value
                  )
                }
                required
              />
            </div>

            <button
              type="submit"
              className="submit-btn"
              disabled={loading}
            >
              {loading
                ? "Please wait..."
                : mode === "login"
                ? "Login"
                : "Create Account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Account;