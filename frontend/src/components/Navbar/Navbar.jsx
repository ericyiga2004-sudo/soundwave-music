import React, { useContext, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  House,
  Compass,
  Library,
  Heart,
  Music2,
  User,
  ListMusic,
  Search,
} from "lucide-react";
import "./Navbar.css";

import SearchModal from "../../components/SearchModel/SearchModel";
import { MusicPlayerContext } from "../../context/MainPlayerContext";
import NotificationBell from "../../pages/NotificationBell";

const navLinks = [
  { path: "/", label: "Home", icon: House },
  { path: "/explore", label: "Explore", icon: Compass },
  { path: "/library", label: "Library", icon: Library },
  { path: "/liked", label: "Liked", icon: Heart },
  { path: "/playlist", label: "Playlist", icon: ListMusic },
  { path: "/account", label: "Account", icon: User },
];

const Navbar = () => {
  const [openSearch, setOpenSearch] = useState(false);

  const {
    songs = [],
    playSong: contextPlaySong,
    setCurrentSong,
  } = useContext(MusicPlayerContext);

  const playSongFromSearch = (song, playlist = []) => {
    if (!song?._id) return;

    if (contextPlaySong) {
      contextPlaySong(song, playlist.length ? playlist : songs);
    } else if (setCurrentSong) {
      setCurrentSong(song);
    }

    setOpenSearch(false);
  };

  return (
    <>
      <header className="sw-top-header">
        <NavLink to="/" className="sw-logo-link">
          <div className="sw-brand-mark">
            <div className="sw-brand-inner">
              <Music2 size={21} strokeWidth={2.6} />
            </div>
          </div>

          <div className="sw-logo-text">
            <h1>SoundWave</h1>
            <p>Feel the music</p>
          </div>
        </NavLink>

        <button
          type="button"
          className="sw-search-btn"
          onClick={() => setOpenSearch(true)}
        >
          <Search size={18} />
          <span>Search music...</span>
        </button>
      <NotificationBell/>
        
      </header>
      <SearchModal
        isOpen={openSearch}
        onClose={() => setOpenSearch(false)}
        songs={songs}
        onPlaySong={playSongFromSearch}
      />
     

      <nav className="sw-bottom-nav">
        {navLinks.map((item) => {
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