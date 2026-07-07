import React, { useEffect, useMemo, useState } from "react";
import Navbar from "./components/Navbar/Navbar";
import { Route, Routes, useLocation } from "react-router-dom";
import Explore from "./pages/Explore";
import Library from "./pages/Library";
import Liked from "./pages/Liked";
import Home from "./pages/Home";
import Account from "./pages/Account";
import MusicPlay from "./pages/MusicPlay";
import "./App.css";
import SongDetails from "./pages/SongDetails";
import Album from "./pages/Album";
import Profile from "./pages/Profile";
import PlayList from "./pages/PlayList";
import YearsPage from "./pages/YearsPage";
import Dj from "./pages/Dj";
import Artist from "./pages/Artist";
import DjStudio from "./pages/DjStudio";
import MusicStudio from "./pages/MusicStudio";
import Visualizer from "./pages/Visualizer";

const LAUNCH_SEEN_KEY = "soundwave_launch_intro_seen";

const loadingHints = [
  "Enjoy the DJ essentials set in your library.",
  "Call or WhatsApp 0743073520 for more assistance.",
  "Add your request in the contacts menu for quick support.",
  "Listen with lyrics by clicking the lyrics button.",
  "Enjoy undisturbed visualizer mode for the full experience.",
  "Create playlists and keep your favorite songs close.",
  "Explore new sounds and artists inside SoundWave.",
];

const floatingNotes = ["♪", "♫", "♬", "♩", "♭", "♯"];

const LaunchLoadout = () => {
  const randomHint = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * loadingHints.length);
    return loadingHints[randomIndex];
  }, []);

  return (
    <div className="launch-loadout">
      <div className="launch-bg-grid"></div>

      <div className="launch-glow launch-glow-one"></div>
      <div className="launch-glow launch-glow-two"></div>
      <div className="launch-glow launch-glow-three"></div>

      <div className="launch-stars">
        <span></span>
        <span></span>
        <span></span>
        <span></span>
      </div>

      <div className="launch-notes" aria-hidden="true">
        {floatingNotes.map((note, index) => (
          <span key={`${note}-${index}`} style={{ "--i": index }}>
            {note}
          </span>
        ))}
      </div>

      <div className="launch-card">
        <div className="launch-badge">Now entering</div>

        <div className="launch-orb">
          <span></span>
          <i></i>
        </div>

        <div className="launch-equalizer" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </div>

        <h1>
          Sound<span>wave</span>
        </h1>

        <p className="launch-subtitle">Turning up your music experience...</p>

        <div className="launch-hint">
          <small>Tip of the moment</small>
          <span>{randomHint}</span>
        </div>

        <div className="launch-loader">
          <span></span>
        </div>

        <div className="launch-status">
          <em>Syncing beats</em>
          <b></b>
          <em>Loading vibes</em>
        </div>

        <div className="launch-developed">
          Developed by <strong>Ericom Co.</strong>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const location = useLocation();

  const [isLaunching, setIsLaunching] = useState(() => {
    return sessionStorage.getItem(LAUNCH_SEEN_KEY) !== "true";
  });

  useEffect(() => {
    if (!isLaunching) return;

    const timer = setTimeout(() => {
      sessionStorage.setItem(LAUNCH_SEEN_KEY, "true");
      setIsLaunching(false);
    }, 8500);

    return () => clearTimeout(timer);
  }, [isLaunching]);

  const isFullScreenMusicPage =
    location.pathname.startsWith("/song/") ||
    location.pathname.startsWith("/visualizer/") ||
    location.pathname === "/dj";

  if (isLaunching) {
    return <LaunchLoadout />;
  }

  return (
    <div className={isFullScreenMusicPage ? "app app-fullscreen-music" : "app"}>
      {!isFullScreenMusicPage && <Navbar />}

      <main
        className={
          isFullScreenMusicPage
            ? "main-content main-content-fullscreen"
            : "main-content"
        }
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/library" element={<Library />} />
          <Route path="/liked" element={<Liked />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/account" element={<Account />} />
          <Route path="/playlist" element={<PlayList />} />
          <Route path="/song/:songId" element={<SongDetails />} />
          <Route path="/album/:albumId" element={<Album />} />
          <Route path="/dj" element={<Dj />} />
          <Route path="/studio" element={<DjStudio />} />
          <Route path="/drumsequence" element={<MusicStudio />} />
          <Route path="/yearly/:yearSlug" element={<YearsPage />} />
          <Route path="/artist/:artistId" element={<Artist />} />
          <Route path="/visualizer/:songId" element={<Visualizer />} />
        </Routes>
      </main>

      <div
        className={
          isFullScreenMusicPage
            ? "music-play-shell music-play-shell-hidden"
            : "music-play-shell"
        }
        aria-hidden={isFullScreenMusicPage}
      >
        <MusicPlay />
      </div>
    </div>
  );
};

export default App;