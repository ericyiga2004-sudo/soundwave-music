import React from "react";
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

const App = () => {
  const location = useLocation();

  const isFullScreenMusicPage =
    location.pathname.startsWith("/song/") || location.pathname === "/dj";

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
          <Route path="/yearly/:yearSlug" element={<YearsPage />} />
        </Routes>
      </main>

      {/* Keep MusicPlay mounted so audio/player context keeps working */}
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