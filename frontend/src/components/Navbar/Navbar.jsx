import React from "react";
import { NavLink } from "react-router-dom";
import {
  House,
  Compass,
  Library,
  Heart,
  Music2,
  User,
} from "lucide-react";
import "./Navbar.css";

const Navbar = () => {
  return (
    <aside className="sidebar">
      <div className="logo">
        <Music2 size={30} />
        <span>SoundWave</span>
      </div>

      <nav className="nav-links">
        <NavLink to="/" className="nav-item">
          <House size={22} />
          <span>Home</span>
        </NavLink>

        <NavLink to="/explore" className="nav-item">
          <Compass size={22} />
          <span>Explore</span>
        </NavLink>

        <NavLink to="/library" className="nav-item">
          <Library size={22} />
          <span>Library</span>
        </NavLink>

        <NavLink to="/liked" className="nav-item">
          <Heart size={22} />
          <span>Liked</span>
        </NavLink>

        <NavLink to="/account" className="nav-item">
          <User size={22} />
          <span>Account</span>
        </NavLink>

        <NavLink to="/playlist" className="nav-item">
          <User size={22} />
          <span>Playlist</span>
        </NavLink>

      </nav>
    </aside>
  );
};

export default Navbar;