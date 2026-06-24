import React from "react";
import Navbar from "./components/Navbar/Navbar";
import { Route, Routes } from "react-router-dom";
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

const App = () => {
  return (
    <div className="app">
      <Navbar />

      <main className="main-content">
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
        </Routes>
      </main>

      <MusicPlay />
    </div>
  );
};

export default App;