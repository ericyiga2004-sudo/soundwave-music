import { useContext, useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { BatteryMedium, Settings2, WifiOff, ChevronLeft, ChevronRight, Home, Library, Moon, Radio, Search, Sparkles, Sun, User, UsersRound, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import "./Navbar.css";
import SearchModal from "../SearchModel/SearchModel";
import { MusicPlayerContext } from "../../context/MainPlayerContext";
import NotificationBell from "../../pages/NotificationBell";
import {
  getBatterySaver,
  getLowData,
  getSidebarHidden,
  getTheme,
  setBatterySaver,
  setLowData,
  setSidebarHidden,
  setTheme,
  UI_PREFERENCES_EVENT,
} from "../../utils/uiPreferences";

const mobileLinks = [
  { path: "/", label: "Home", icon: Home },
  { path: "/explore", label: "New", icon: Sparkles },
  { path: "/social", label: "Social", icon: UsersRound },
  { path: "/radio", label: "Radio", icon: Radio },
  { path: "/library", label: "Library", icon: Library },
];

const pageTitles = {
  "/": "Home",
  "/explore": "New",
  "/radio": "Radio",
  "/social": "Social",
  "/library": "Library",
  "/liked": "Favorites",
  "/playlist": "Playlists",
  "/account": "Account",
  "/artists": "Artists",
  "/albums": "Albums",
  "/songs": "Songs",
};

const Navbar = () => {
  const [openSearch, setOpenSearch] = useState(false);
  const [batterySaver, setBatterySaverState] = useState(getBatterySaver);
  const [lowData, setLowDataState] = useState(getLowData);
  const [theme, setThemeState] = useState(getTheme);
  const [sidebarHidden, setSidebarHiddenState] = useState(getSidebarHidden);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { songs = [], playSong, setCurrentSong } = useContext(MusicPlayerContext);

  useEffect(() => {
    const onPreference = () => {
      setBatterySaverState(getBatterySaver());
      setLowDataState(getLowData());
      setThemeState(getTheme());
      setSidebarHiddenState(getSidebarHidden());
    };
    window.addEventListener(UI_PREFERENCES_EVENT, onPreference);
    return () => window.removeEventListener(UI_PREFERENCES_EVENT, onPreference);
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      const tag = event.target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (event.key === "/") {
        event.preventDefault();
        setOpenSearch(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const playSongFromSearch = (song, playlist = []) => {
    if (!song?._id) return;
    if (playSong) playSong(song, playlist.length ? playlist : songs);
    else setCurrentSong?.(song);
    setOpenSearch(false);
  };

  const title =
    pageTitles[location.pathname] ||
    (location.pathname.startsWith("/artist/")
      ? "Artist"
      : location.pathname.startsWith("/album/")
        ? "Album"
        : location.pathname.startsWith("/song/")
          ? "Now Playing"
          : location.pathname.startsWith("/social")
            ? "Social"
            : location.pathname.startsWith("/u/")
              ? "Music Profile"
              : location.pathname.startsWith("/playlist/")
                ? "Playlist"
                : "SoundWave");

  return (
    <>
      <header className="sw-top-header">
        <div className="sw-top-left">
          <div className="sw-history-controls d-none d-lg-flex">
            <button type="button" onClick={() => navigate(-1)} aria-label="Back">
              <ChevronLeft size={19} />
            </button>
            <button type="button" onClick={() => navigate(1)} aria-label="Forward">
              <ChevronRight size={19} />
            </button>
          </div>

          <div className="sw-mobile-brand d-lg-none">
            <span className="sw-mobile-brand-icon">♪</span>
            <strong>{title}</strong>
          </div>
        </div>

        <button type="button" className="sw-search-btn" onClick={() => setOpenSearch(true)}>
          <Search size={17} />
          <span>Search</span>
          <kbd className="d-none d-xl-inline">/</kbd>
        </button>

        <div className="sw-top-actions">
          <NavLink
            to="/social"
            className={({ isActive }) => `sw-icon-btn sw-social-top-link ${isActive ? "active" : ""}`}
            title="SoundWave Social"
            aria-label="Open SoundWave Social"
          >
            <UsersRound size={18} />
          </NavLink>

          <div className="sw-settings-wrap">
            <button
              type="button"
              className={`sw-icon-btn ${batterySaver || lowData ? "active" : ""}`}
              onClick={() => setSettingsOpen((open) => !open)}
              title="Performance settings"
              aria-label="Open performance settings"
              aria-expanded={settingsOpen}
            >
              <Settings2 size={18} />
            </button>

            {settingsOpen && (
              <div className="sw-settings-popover" role="dialog" aria-label="Performance settings">
                <div className="sw-settings-heading">
                  <div>
                    <strong>Performance</strong>
                    <small>Use less battery and mobile data.</small>
                  </div>
                </div>

                <button type="button" className="sw-settings-row" onClick={() => setBatterySaver(!batterySaver)}>
                  <span className="sw-settings-row-icon"><BatteryMedium size={17} /></span>
                  <span className="sw-settings-copy">
                    <strong>Battery Saver</strong>
                    <small>Stops decorative motion and expensive effects.</small>
                  </span>
                  <span className={`sw-switch ${batterySaver ? "on" : ""}`} aria-hidden="true"><i /></span>
                </button>

                <button type="button" className="sw-settings-row" onClick={() => setLowData(!lowData)}>
                  <span className="sw-settings-row-icon"><WifiOff size={17} /></span>
                  <span className="sw-settings-copy">
                    <strong>Low Data Mode</strong>
                    <small>Loads lower-priority sections only when you reach them.</small>
                  </span>
                  <span className={`sw-switch ${lowData ? "on" : ""}`} aria-hidden="true"><i /></span>
                </button>

                <button type="button" className="sw-settings-row" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                  <span className="sw-settings-row-icon">{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</span>
                  <span className="sw-settings-copy">
                    <strong>Appearance</strong>
                    <small>{theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}</small>
                  </span>
                  <span className="sw-settings-value">{theme === "dark" ? "Dark" : "Light"}</span>
                </button>

                <button type="button" className="sw-settings-row" onClick={() => setSidebarHidden(!sidebarHidden)}>
                  <span className="sw-settings-row-icon">{sidebarHidden ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</span>
                  <span className="sw-settings-copy">
                    <strong>Sidebar</strong>
                    <small>{sidebarHidden ? "Bring the desktop sidebar back." : "Hide only the sidebar and reclaim its page width."}</small>
                  </span>
                  <span className={`sw-switch ${sidebarHidden ? "on" : ""}`} aria-hidden="true"><i /></span>
                </button>
              </div>
            )}
          </div>

          <NotificationBell />

          <NavLink to="/account" className="sw-account-pill" aria-label="Account">
            <User size={17} />
            <span className="d-none d-xl-inline">Account</span>
          </NavLink>
        </div>
      </header>

      <SearchModal
        isOpen={openSearch}
        onClose={() => setOpenSearch(false)}
        songs={songs}
        onPlaySong={playSongFromSearch}
      />

      <nav className="sw-bottom-nav d-lg-none" aria-label="Main navigation">
        {mobileLinks.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.path} to={item.path} className="sw-bottom-item">
              <Icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </>
  );
};

export default Navbar;
