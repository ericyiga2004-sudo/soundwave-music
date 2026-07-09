import React, { useState, useContext, useEffect, useMemo } from "react";
import axios from "axios";
import {
  FaMusic,
  FaUser,
  FaEnvelope,
  FaLock,
  FaClock,
  FaHeadphones,
} from "react-icons/fa";

import "./CSS/Account.css";
import { MusicContext } from "../context/ShopContext";
import SongItem from "../components/SongItem/SongItem";

const MAX_HISTORY_SONGS = 20;

const isBadTokenValue = (value) => {
  if (!value) return true;

  const cleanValue = String(value).trim().toLowerCase();

  return (
    cleanValue === "" ||
    cleanValue === "false" ||
    cleanValue === "null" ||
    cleanValue === "undefined" ||
    cleanValue === "none" ||
    cleanValue === "nan"
  );
};

const getValidToken = (value) => {
  if (isBadTokenValue(value)) return "";

  return String(value).trim();
};

const cleanStoredToken = () => {
  const storedToken = localStorage.getItem("token");

  if (isBadTokenValue(storedToken)) {
    localStorage.removeItem("token");
    return "";
  }

  return storedToken.trim();
};

const Account = () => {
  const { token, setToken, logout, backendUrl } = useContext(MusicContext);

  const validToken = useMemo(() => {
    return getValidToken(token || localStorage.getItem("token"));
  }, [token]);

  const [historySongs, setHistorySongs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    const cleanedToken = cleanStoredToken();

    if (!cleanedToken && token) {
      setToken("");
    }

    if (cleanedToken && cleanedToken !== token) {
      setToken(cleanedToken);
    }
  }, []);

  const showNotice = (type, message) => {
    setNotice({ type, message });

    window.setTimeout(() => {
      setNotice(null);
    }, 3500);
  };

  const getUserLocation = () => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        () => {
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  };

  const saveLocationAfterAuth = async (authToken, location) => {
    if (!authToken || !location) return;

    try {
      await axios.post(`${backendUrl}/api/user/location`, location, {
        headers: {
          token: authToken,
        },
      });
    } catch (error) {
      console.log("Save location error:", error);
    }
  };

  const fetchHistory = async () => {
    const authToken = getValidToken(token || localStorage.getItem("token"));

    if (!authToken) {
      setHistorySongs([]);
      setHistoryLoading(false);
      return;
    }

    try {
      setHistoryLoading(true);

      const res = await axios.get(`${backendUrl}/api/history/get`, {
        headers: {
          token: authToken,
        },
      });

      if (res.data.success) {
        const songs = (res.data.history || [])
          .map((item) => item.song)
          .filter(Boolean)
          .slice(0, MAX_HISTORY_SONGS);

        setHistorySongs(songs);
      } else {
        setHistorySongs([]);
      }
    } catch (error) {
      console.error("Fetch history error:", error);

      if (
        error.response?.status === 401 ||
        error.response?.data?.message?.toLowerCase()?.includes("jwt") ||
        error.response?.data?.message?.toLowerCase()?.includes("token")
      ) {
        localStorage.removeItem("token");
        setToken("");
      }

      setHistorySongs([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();

    window.addEventListener("music-history-updated", fetchHistory);

    return () => {
      window.removeEventListener("music-history-updated", fetchHistory);
    };
  }, [backendUrl, token]);

  const handleLogout = () => {
    localStorage.removeItem("token");

    if (logout) {
      logout();
    }

    setToken("");
    setHistorySongs([]);
    setHistoryLoading(false);

    showNotice("success", "You have been logged out.");
  };

  const submitHandler = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);

      const cleanUsername = username.trim();
      const cleanEmail = email.trim().toLowerCase();
      const cleanPassword = password.trim();

      const location = await getUserLocation();

      const endpoint = mode === "login" ? "/api/user/login" : "/api/user/register";

      const payload =
        mode === "login"
          ? {
              email: cleanEmail,
              password: cleanPassword,
            }
          : {
              username: cleanUsername,
              email: cleanEmail,
              password: cleanPassword,
              location,
            };

      const res = await axios.post(`${backendUrl}${endpoint}`, payload, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (res.data.success && !isBadTokenValue(res.data.token)) {
        const authToken = String(res.data.token).trim();

        setToken(authToken);
        localStorage.setItem("token", authToken);

        if (mode === "login") {
          await saveLocationAfterAuth(authToken, location);
        }

        showNotice(
          "success",
          mode === "login"
            ? "Welcome back. You are now logged in."
            : "Account created successfully."
        );

        setUsername("");
        setEmail("");
        setPassword("");

        window.dispatchEvent(new Event("auth-updated"));
      } else {
        localStorage.removeItem("token");
        setToken("");

        showNotice(
          "error",
          res.data.message || "Login failed. Please try again."
        );
      }
    } catch (error) {
      console.log("Auth error:", error);

      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Something went wrong";

      showNotice("error", message);
    } finally {
      setLoading(false);
    }
  };

  const noticeMarkup = notice && (
    <div className={`auth-notice ${notice.type}`}>
      <span className="auth-notice-dot"></span>
      <p>{notice.message}</p>
    </div>
  );

  if (validToken) {
    return (
      <main className="account-dashboard">
        {noticeMarkup}

        <div className="container-fluid px-2 px-sm-3 px-lg-4">
          <section className="dashboard-card row g-3 g-md-4 align-items-center">
            <div className="col-12 col-md-auto text-center text-md-start">
              <div className="dashboard-avatar mx-auto mx-md-0">
                <FaUser />
              </div>
            </div>

            <div className="col-12 col-md text-center text-md-start">
              <span className="dashboard-badge">Your Account</span>
              <h1>Welcome Back</h1>
              <p>Your music, history, playlists, and personal mixes are ready.</p>
            </div>

            <div className="col-12 col-md-auto text-center text-md-end">
              <button
                type="button"
                className="logout-btn"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          </section>

          <section className="account-history-section">
            <div className="account-history-header">
              <div>
                <span className="account-history-badge">
                  <FaHeadphones />
                  Recently Played
                </span>

                <div className="account-history-heading">
                  <FaClock />
                  <h2>Listening History</h2>
                </div>

                <p>Your latest played songs, saved automatically.</p>
              </div>
            </div>

            {historyLoading ? (
              <div className="account-history-slider">
                {[1, 2, 3, 4, 5, 6].map((item) => (
                  <div className="account-history-skeleton" key={item}>
                    <div className="account-history-skeleton-cover"></div>
                    <div className="account-history-skeleton-line title"></div>
                    <div className="account-history-skeleton-line text"></div>
                  </div>
                ))}
              </div>
            ) : historySongs.length > 0 ? (
              <div className="account-history-slider">
                {historySongs.map((song) => (
                  <div className="account-history-slide" key={song._id}>
                    <SongItem song={song} queue={historySongs} />
                  </div>
                ))}
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
      {noticeMarkup}

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
              Create playlists, save favorites, access listening history, and enjoy
              your music anywhere.
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