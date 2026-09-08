import AccountIdentity from "../components/UI/AccountIdentity";
import { safeLocalStorage, safeSessionStorage } from "../utils/safeStorage";
import { useState, useContext, useEffect, useMemo } from "react";
import axios from "axios";
import {
  FaMusic,
  FaUser,
  FaEnvelope,
  FaLock,
  FaClock,
  FaHeadphones,
  FaBatteryHalf,
  FaWifi,
  FaMagic,
} from "react-icons/fa";

import "./CSS/Account.tailwind.css";
import { MusicContext } from "../context/ShopContext";
import SongItem from "../components/SongItem/SongItem";
import {
  getBatterySaver,
  getLowData,
  getPersonalizationEnabled,
  setBatterySaver,
  setLowData,
  setPersonalizationEnabled,
  UI_PREFERENCES_EVENT,
} from "../utils/uiPreferences";

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
  const storedToken = safeLocalStorage.getItem("token");

  if (isBadTokenValue(storedToken)) {
    safeLocalStorage.removeItem("token");
    return "";
  }

  return storedToken.trim();
};

const Account = () => {
  const { token, setToken, logout, backendUrl } = useContext(MusicContext);

  const validToken = useMemo(() => {
    return getValidToken(token || safeLocalStorage.getItem("token"));
  }, [token]);

  const [historySongs, setHistorySongs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [batterySaverEnabled, setBatterySaverEnabled] = useState(() => getBatterySaver());
  const [lowDataEnabled, setLowDataEnabled] = useState(() => getLowData());
  const [personalizationEnabled, setPersonalizationState] = useState(() => getPersonalizationEnabled());

  useEffect(() => {
    const syncPreferences = () => {
      setBatterySaverEnabled(getBatterySaver());
      setLowDataEnabled(getLowData());
      setPersonalizationState(getPersonalizationEnabled());
    };

    window.addEventListener(UI_PREFERENCES_EVENT, syncPreferences);
    return () => window.removeEventListener(UI_PREFERENCES_EVENT, syncPreferences);
  }, []);

  const toggleBatterySaver = () => {
    const next = !batterySaverEnabled;
    setBatterySaver(next);
    setBatterySaverEnabled(next);
  };

  const toggleLowData = () => {
    const next = !lowDataEnabled;
    setLowData(next);
    setLowDataEnabled(next);
  };

  const togglePersonalization = () => {
    const next = !personalizationEnabled;
    setPersonalizationEnabled(next);
    setPersonalizationState(next);
  };

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

    if (type === "error") return;
    window.setTimeout(() => {
      setNotice(null);
    }, 3500);
  };

  const fetchHistory = async () => {
    const authToken = getValidToken(token || safeLocalStorage.getItem("token"));

    if (!authToken) {
      setHistorySongs([]);
      setHistoryLoading(false);
      return;
    }

    try {
      setHistoryLoading(true);

      const res = await axios.get(`${backendUrl}/api/history/get`, {
        timeout: 25000,
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
        safeLocalStorage.removeItem("token");
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
    safeLocalStorage.removeItem("token");

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
    if (loading) return;
    setNotice(null);

    try {
      setLoading(true);

      const cleanUsername = username.trim();
      const cleanEmail = email.trim().toLowerCase();
      const cleanPassword = password;


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
            };

      const res = await axios.post(`${backendUrl}${endpoint}`, payload, {
        timeout: 25000,
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (res.data.success && !isBadTokenValue(res.data.token)) {
        const authToken = String(res.data.token).trim();

        setToken(authToken);
        safeLocalStorage.setItem("token", authToken);

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
        safeLocalStorage.removeItem("token");
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
        (error.code === "ECONNABORTED" ? "Sign-in took too long. Please try again; the server may still be starting." : !error.response ? "Could not reach SoundWave. Check your connection and try again." : error.message) ||
        "Something went wrong";

      showNotice("error", message);
    } finally {
      setLoading(false);
    }
  };

  const noticeMarkup = notice && (
    <div role="alert" className={`auth-notice ${notice.type}`}>
      <span className="auth-notice-dot"></span>
      <p>{notice.message}</p>
    </div>
  );

  if (validToken) {
    return (
      <main className="account-dashboard">
        {noticeMarkup}

        <div className="sw-container-fluid w-full mx-auto px-3 !px-[0.5rem] sm:!px-[1rem] lg:!px-[1.5rem]">
          <section className="dashboard-card row flex flex-wrap [--sw-gutter-x:1.5rem] [--sw-gutter-y:0px] -mx-[calc(var(--sw-gutter-x)/2)] -mt-[var(--sw-gutter-y)] [&>*]:px-[calc(var(--sw-gutter-x)/2)] [&>*]:mt-[var(--sw-gutter-y)] [&>*]:shrink-0 [&>*]:w-full [&>*]:max-w-full [--sw-gutter-x:1rem] [--sw-gutter-y:1rem] md:[--sw-gutter-x:1.5rem] md:[--sw-gutter-y:1.5rem] !items-center">
            <div className="col !w-[100%] flex-none col md:!w-auto md:flex-none !text-center md:!text-left">
              <div className="dashboard-avatar !mx-auto md:!mx-[0px]">
                <FaUser />
              </div>
            </div>

            <div className="col !w-[100%] flex-none col md:flex-[1_0_0%] !text-center md:!text-left">
              <span className="dashboard-badge">Your Account</span>
              <h1>Welcome Back</h1>
              <AccountIdentity token={validToken} backendUrl={backendUrl} />
              <p>Your music, history, playlists, and personal mixes are ready.</p>
            </div>

            <div className="col !w-[100%] flex-none col md:!w-auto md:flex-none !text-center md:!text-right">
              <button
                type="button"
                className="logout-btn"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          </section>

          <section className="account-performance-section" aria-labelledby="performance-settings-title">
            <div className="account-performance-copy">
              <span className="account-performance-eyebrow">Performance</span>
              <h2 id="performance-settings-title">Playback & data settings</h2>
              <p>Keep SoundWave fast on phones, save battery, and reduce unnecessary network use.</p>
            </div>

            <div className="account-performance-options">
              <button
                type="button"
                className={`account-setting-row ${batterySaverEnabled ? "is-on" : ""}`}
                onClick={toggleBatterySaver}
                aria-pressed={batterySaverEnabled}
              >
                <span className="account-setting-icon"><FaBatteryHalf /></span>
                <span className="account-setting-text">
                  <strong>Battery Saver</strong>
                  <small>Disables decorative motion and expensive visual effects.</small>
                </span>
                <span className="account-setting-state">{batterySaverEnabled ? "On" : "Off"}</span>
              </button>

              <button
                type="button"
                className={`account-setting-row ${lowDataEnabled ? "is-on" : ""}`}
                onClick={toggleLowData}
                aria-pressed={lowDataEnabled}
              >
                <span className="account-setting-icon"><FaWifi /></span>
                <span className="account-setting-text">
                  <strong>Low Data Mode</strong>
                  <small>Defers artwork, loads smaller catalog pages, and reduces audio preloading while keeping your queue playing.</small>
                </span>
                <span className="account-setting-state">{lowDataEnabled ? "On" : "Off"}</span>
              </button>

              <button
                type="button"
                className={`account-setting-row ${personalizationEnabled ? "is-on" : ""}`}
                onClick={togglePersonalization}
                aria-pressed={personalizationEnabled}
              >
                <span className="account-setting-icon"><FaMagic /></span>
                <span className="account-setting-text">
                  <strong>Personalized recommendations</strong>
                  <small>Learns from listening time, likes, saves, searches, artists, albums, genres and languages. SoundWave stores compact preference scores instead of a large raw activity log.</small>
                </span>
                <span className="account-setting-state">{personalizationEnabled ? "On" : "Off"}</span>
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

      <div className="sw-container-fluid w-full mx-auto px-3 !px-[0.5rem] sm:!px-[1rem] lg:!px-[1.5rem]">
        <section className="auth-container row flex flex-wrap [--sw-gutter-x:1.5rem] [--sw-gutter-y:0px] -mx-[calc(var(--sw-gutter-x)/2)] -mt-[var(--sw-gutter-y)] [&>*]:px-[calc(var(--sw-gutter-x)/2)] [&>*]:mt-[var(--sw-gutter-y)] [&>*]:shrink-0 [&>*]:w-full [&>*]:max-w-full [--sw-gutter-x:0px] [--sw-gutter-y:0px] !mx-auto">
          <div className="auth-left col !w-[100%] flex-none col lg:!w-[58.333333333333336%] lg:flex-none">
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

          <div className="auth-right col !w-[100%] flex-none col lg:!w-[41.666666666666664%] lg:flex-none">
            <div className="auth-switch">
              <button
                type="button"
                className={mode === "login" ? "active" : ""}
                disabled={loading}
                onClick={() => setMode("login")}
              >
                Login
              </button>

              <button
                type="button"
                className={mode === "register" ? "active" : ""}
                disabled={loading}
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
                  autoComplete="email"
                  autoCapitalize="none"
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
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
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