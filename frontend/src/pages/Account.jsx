import React, { useState, useContext } from "react";
import axios from "axios";
import {
  FaMusic,
  FaUser,
  FaEnvelope,
  FaLock,
  FaClock,
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
        mode === "login" ? "/api/user/login" : "/api/user/register";

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

      const res = await axios.post(`${backendUrl}${endpoint}`, payload);

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

      alert(error.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const buildHistoryQueue = () => {
    if (!Array.isArray(historySongs)) return [];

    return historySongs
      .map((historyItem) => historyItem?.song)
      .filter(Boolean);
  };

  const handlePlayHistorySong = (song) => {
    if (!song) return;

    const historyQueue = buildHistoryQueue();
    playSong?.(song, historyQueue);
  };

  if (token) {
    return (
      <main className="account-dashboard">
        <div className="container-fluid px-2 px-sm-3 px-lg-4">
          <section className="dashboard-card row g-3 g-md-4 align-items-center">
            <div className="col-12 col-md-auto text-center text-md-start">
              <div className="dashboard-avatar mx-auto mx-md-0">
                <FaUser />
              </div>
            </div>

            <div className="col-12 col-md text-center text-md-start">
              <h1>Welcome Back</h1>
              <p>You are successfully logged in.</p>
            </div>

            <div className="col-12 col-md-auto text-center text-md-end">
              <button className="logout-btn" onClick={logout}>
                Logout
              </button>
            </div>
          </section>

          <section className="history-section">
            <div className="history-header row g-3 align-items-end">
              <div className="col-12 col-md">
                <div className="history-heading">
                  <FaClock />
                  <h2>Listening History</h2>
                </div>

                <p>Recently played songs from your account.</p>
              </div>
            </div>

            {historySongs && historySongs.length > 0 ? (
              <div className="history-grid row g-3 g-md-4">
                {historySongs.map((item) => {
                  const song = item.song;

                  if (!song) return null;

                  return (
                    <div
                      className="history-song-card col-6 col-sm-4 col-md-3 col-lg-2"
                      key={item._id || `${song._id}-${item.playedAt}`}
                      onClick={() => handlePlayHistorySong(song)}
                    >
                      <SongItem song={song} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-history">
                <FaMusic />
                <p>No listening history yet. Play a song to see it here.</p>
              </div>
            )}
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <div className="container-fluid px-2 px-sm-3 px-lg-4">
        <section className="auth-container row g-0 mx-auto">
          <div className="auth-left col-12 col-lg-7">
            <div className="logo-circle">
              <FaMusic />
            </div>

            <h1>
              Stream Music
              <br />
              Without Limits
            </h1>

            <p>
              Create playlists, save favorites, access listening history, and
              enjoy your music anywhere.
            </p>
          </div>

          <div className="auth-right col-12 col-lg-5">
            <div className="auth-switch">
              <button
                type="button"
                className={mode === "login" ? "active" : ""}
                onClick={() => setMode("login")}
              >
                Login
              </button>

              <button
                type="button"
                className={mode === "register" ? "active" : ""}
                onClick={() => setMode("register")}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={submitHandler}>
              {mode === "register" && (
                <div className="input-group">
                  <FaUser />

                  <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
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
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <FaLock />

                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading
                  ? "Please wait..."
                  : mode === "login"
                  ? "Login"
                  : "Create Account"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
};

export default Account;