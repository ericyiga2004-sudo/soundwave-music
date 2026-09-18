import { useContext, useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  BatteryMedium,
  ChevronLeft,
  ChevronRight,
  Home,
  Library,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Radio,
  Search,
  Sparkles,
  Sun,
  User,
  UsersRound,
  WifiOff,
} from "lucide-react";
import { FaRegUser, FaSearch } from "react-icons/fa";
import "./Navbar.tailwind.css";
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

  const performancePopover = settingsOpen ? (
    <div className="sw-settings-popover" role="dialog" aria-label="Performance settings">
      <div className="sw-settings-heading">
        <div>
          <strong>Performance</strong>
          <small>Use less battery and mobile data.</small>
        </div>
      </div>

      <button type="button" className="sw-settings-row" onClick={() => setBatterySaver(!batterySaver)}>
        <span className="sw-settings-row-icon"><BatteryMedium size={17} /></span>
        <span className="sw-settings-copy"><strong>Battery Saver</strong><small>Stops decorative motion and expensive effects.</small></span>
        <span className={`sw-switch ${batterySaver ? "on" : ""}`} aria-hidden="true"><i /></span>
      </button>

      <button type="button" className="sw-settings-row" onClick={() => setLowData(!lowData)}>
        <span className="sw-settings-row-icon"><WifiOff size={17} /></span>
        <span className="sw-settings-copy"><strong>Low Data Mode</strong><small>Loads lower-priority sections only when you reach them.</small></span>
        <span className={`sw-switch ${lowData ? "on" : ""}`} aria-hidden="true"><i /></span>
      </button>

      <button type="button" className="sw-settings-row" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
        <span className="sw-settings-row-icon">{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</span>
        <span className="sw-settings-copy"><strong>Appearance</strong><small>{theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}</small></span>
        <span className="sw-settings-value">{theme === "dark" ? "Dark" : "Light"}</span>
      </button>

      <button type="button" className="sw-settings-row" onClick={() => setSidebarHidden(!sidebarHidden)}>
        <span className="sw-settings-row-icon">{sidebarHidden ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</span>
        <span className="sw-settings-copy"><strong>Sidebar</strong><small>{sidebarHidden ? "Bring the desktop sidebar back." : "Hide only the sidebar and reclaim its page width."}</small></span>
        <span className={`sw-switch ${sidebarHidden ? "on" : ""}`} aria-hidden="true"><i /></span>
      </button>
    </div>
  ) : null;

  return (
    <>
      {/* Phone header: deliberately Tailwind-only so legacy converted CSS cannot squeeze icons. */}
      <header className="sticky top-0 z-[2300] flex min-h-[68px] w-full items-center justify-between gap-3 border-b border-[var(--sw-border)] bg-[var(--sw-bg)] px-4 py-2 sm:hidden">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--sw-accent)] text-[23px] font-black text-white" aria-hidden="true">♪</span>
          <strong className="min-w-0 truncate text-[20px] font-extrabold tracking-[-0.03em] text-[var(--sw-text)]">{title}</strong>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button type="button" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--sw-surface-2)] text-[var(--sw-text)]" onClick={() => setOpenSearch(true)} aria-label="Search">
            <FaSearch className="block text-[24px]" aria-hidden="true" />
          </button>
          <NotificationBell />
          <NavLink to="/account" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--sw-surface-2)] text-[var(--sw-text)]" aria-label="Account">
            <FaRegUser className="block text-[25px]" aria-hidden="true" />
          </NavLink>
        </div>
      </header>

      {/* Tablet/desktop header keeps the established reference layout. */}
      <header className="sw-top-header !hidden sm:!grid">
        <div className="sw-top-left">
          <button type="button" className="sw-icon-btn !hidden lg:!grid" onClick={() => setSidebarHidden(!sidebarHidden)} aria-controls="soundwave-sidebar" aria-expanded={!sidebarHidden} aria-label={sidebarHidden ? "Show sidebar" : "Hide sidebar"}>{sidebarHidden ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}</button>
          <div className="sw-history-controls !hidden lg:!flex">
            <button type="button" onClick={() => navigate(-1)} aria-label="Back"><ChevronLeft size={19} /></button>
            <button type="button" onClick={() => navigate(1)} aria-label="Forward"><ChevronRight size={19} /></button>
          </div>
          <div className="sw-mobile-brand !flex lg:!hidden">
            <span className="sw-mobile-brand-icon">♪</span>
            <strong>{title}</strong>
          </div>
        </div>

        <button type="button" className="sw-search-btn" onClick={() => setOpenSearch(true)}>
          <Search size={18} />
          <span>Search</span>
          <kbd className="!hidden xl:!inline">/</kbd>
        </button>

        <div className="sw-top-actions">
          <NavLink to="/social" className={({ isActive }) => `sw-icon-btn sw-social-top-link !hidden lg:!grid ${isActive ? "active" : ""}`} title="SoundWave Social" aria-label="Open SoundWave Social"><UsersRound size={20} /></NavLink>

          <div className="sw-settings-wrap">
            <button type="button" className={`sw-icon-btn !h-10 !w-10 ${batterySaver || lowData ? "active" : ""}`} onClick={() => setSettingsOpen((open) => !open)} title="Performance settings" aria-label="Open performance settings" aria-expanded={settingsOpen}>
              <span className="grid h-full w-full place-items-center text-[22px]">⚙</span>
            </button>
            {performancePopover}
          </div>

          <NotificationBell />

          <NavLink to="/account" className="sw-account-pill" aria-label="Account">
            <User size={20} />
            <span className="!hidden xl:!inline">Account</span>
          </NavLink>
        </div>
      </header>

      <SearchModal isOpen={openSearch} onClose={() => setOpenSearch(false)} songs={songs} onPlaySong={playSongFromSearch} />

      {/* Phone bottom nav is Tailwind-only: no legacy 18px svg rule can override it. */}
      <nav className="fixed inset-x-3 bottom-[max(10px,env(safe-area-inset-bottom))] z-[2400] grid h-[80px] grid-cols-5 items-center gap-1 rounded-[22px] border border-[var(--sw-border)] bg-[var(--sw-player-bg)] px-2 py-2 shadow-[0_14px_38px_rgba(0,0,0,0.18)] backdrop-blur-xl lg:hidden" aria-label="Main navigation">
        {mobileLinks.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.path} to={item.path} className={({ isActive }) => `flex min-h-[60px] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-bold no-underline ${isActive ? "text-[var(--sw-accent)]" : "text-[var(--sw-text-tertiary)]"}`}>
              <Icon className="h-[27px] w-[27px] shrink-0" strokeWidth={2.35} />
              <span className="leading-none">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </>
  );
};

export default Navbar;
