import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar/Navbar";
import Sidebar from "./components/SideBar/SideBar";
import Home from "./pages/Home";
import MusicPlay from "./pages/MusicPlay";
import {
  getBatterySaver,
  getLowData,
  getTheme,
  UI_PREFERENCES_EVENT,
} from "./utils/uiPreferences";
import "./App.css";

const Explore = lazy(() => import("./pages/Explore"));
const Library = lazy(() => import("./pages/Library"));
const Liked = lazy(() => import("./pages/Liked"));
const Account = lazy(() => import("./pages/Account"));
const SongDetails = lazy(() => import("./pages/SongDetails"));
const Album = lazy(() => import("./pages/Album"));
const Profile = lazy(() => import("./pages/Profile"));
const PlayList = lazy(() => import("./pages/PlayList"));
const YearsPage = lazy(() => import("./pages/YearsPage"));
const Dj = lazy(() => import("./pages/Dj"));
const Artist = lazy(() => import("./pages/Artist"));
const DjStudio = lazy(() => import("./pages/DjStudio"));
const MusicStudio = lazy(() => import("./pages/MusicStudio"));
const Visualizer = lazy(() => import("./pages/Visualizer"));
const MoodPage = lazy(() => import("./pages/MoodPage"));
const Radio = lazy(() => import("./pages/Radio"));
const Social = lazy(() => import("./pages/Social"));
const SocialProfile = lazy(() => import("./pages/SocialProfile"));
const Circle = lazy(() => import("./pages/Circle"));
const LiveRoom = lazy(() => import("./pages/LiveRoom"));
const ArtistsPage = lazy(() => import("./pages/ArtistsPage"));
const AlbumsPage = lazy(() => import("./pages/AlbumsPage"));
const SongsPage = lazy(() => import("./pages/SongsPage"));
const PlaylistDetails = lazy(() => import("./pages/PlaylistDetails"));
const NotFound = lazy(() => import("./pages/NotFound"));

const LAUNCH_SEEN_KEY = "soundwave_launch_intro_seen_v3";

const LaunchScreen = () => (
  <div className="sw-launch-screen" role="status" aria-label="Opening SoundWave">
    <div className="sw-launch-mark" aria-hidden="true">
      <span>♪</span>
    </div>
    <strong>SoundWave</strong>
    <small>Music, beautifully simple.</small>
  </div>
);

const RouteFallback = () => (
  <div className="sw-route-fallback" role="status" aria-label="Loading page">
    <span />
    <span />
    <span />
  </div>
);

const App = () => {
  const location = useLocation();
  const [isLaunching, setIsLaunching] = useState(
    () => sessionStorage.getItem(LAUNCH_SEEN_KEY) !== "true"
  );
  const [batterySaver, setBatterySaverState] = useState(getBatterySaver);
  const [lowData, setLowDataState] = useState(getLowData);
  const [theme, setThemeState] = useState(getTheme);

  useEffect(() => {
    if (!isLaunching) return undefined;
    const timer = window.setTimeout(() => {
      sessionStorage.setItem(LAUNCH_SEEN_KEY, "true");
      setIsLaunching(false);
    }, 850);
    return () => window.clearTimeout(timer);
  }, [isLaunching]);

  useEffect(() => {
    const syncPreferences = (event) => {
      if (typeof event?.detail?.batterySaver === "boolean") {
        setBatterySaverState(event.detail.batterySaver);
      } else {
        setBatterySaverState(getBatterySaver());
      }

      if (typeof event?.detail?.lowData === "boolean") {
        setLowDataState(event.detail.lowData);
      } else {
        setLowDataState(getLowData());
      }

      if (event?.detail?.theme) {
        setThemeState(event.detail.theme);
      } else {
        setThemeState(getTheme());
      }
    };

    window.addEventListener(UI_PREFERENCES_EVENT, syncPreferences);
    return () => window.removeEventListener(UI_PREFERENCES_EVENT, syncPreferences);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.swBatterySaver = batterySaver ? "true" : "false";
    document.documentElement.dataset.swLowData = lowData ? "true" : "false";
    document.documentElement.dataset.swTheme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [batterySaver, lowData, theme]);

  const isSongDetailPage = useMemo(
    () => location.pathname.startsWith("/song/"),
    [location.pathname]
  );

  const isImmersivePage = useMemo(
    () =>
      location.pathname.startsWith("/visualizer/") ||
      location.pathname === "/dj" ||
      location.pathname === "/studio" ||
      location.pathname === "/drumsequence",
    [location.pathname]
  );

  if (isLaunching) return <LaunchScreen />;

  return (
    <div className={`app ${isImmersivePage ? "app-immersive" : ""} ${isSongDetailPage ? "app-song-detail" : ""}`}>
      {!isImmersivePage ? (
        <div className="sw-app-shell">
          <Sidebar />

          <div className="sw-workspace">
            <Navbar />

            <main className="main-content">
              <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/explore" element={<Explore />} />
                <Route path="/radio" element={<Radio />} />
                <Route path="/social" element={<Social />} />
                <Route path="/social/circles/:circleId" element={<Circle />} />
                <Route path="/social/rooms/:code" element={<LiveRoom />} />
                <Route path="/u/:userId" element={<SocialProfile />} />
                <Route path="/library" element={<Library />} />
                <Route path="/liked" element={<Liked />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/account" element={<Account />} />
                <Route path="/playlist" element={<PlayList />} />
                <Route path="/playlist/:playlistId" element={<PlaylistDetails />} />
                <Route path="/artists" element={<ArtistsPage />} />
                <Route path="/albums" element={<AlbumsPage />} />
                <Route path="/songs" element={<SongsPage />} />
                <Route path="/song/:songId" element={<SongDetails />} />
                <Route path="/album/:albumId" element={<Album />} />
                <Route path="/yearly/:yearSlug" element={<YearsPage />} />
                <Route path="/artist/:artistId" element={<Artist />} />
                <Route path="/mood/:moodSlug" element={<MoodPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </main>
          </div>

          <div className="music-play-shell">
            <MusicPlay />
          </div>
        </div>
      ) : (
        <main className="main-content main-content-fullscreen">
          <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/dj" element={<Dj />} />
            <Route path="/studio" element={<DjStudio />} />
            <Route path="/drumsequence" element={<MusicStudio />} />
            <Route path="/visualizer/:songId" element={<Visualizer />} />
          </Routes>
          </Suspense>
        </main>
      )}
    </div>
  );
};

export default App;
