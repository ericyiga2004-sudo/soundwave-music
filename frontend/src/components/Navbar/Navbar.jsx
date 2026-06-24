import React from "react";
import { NavLink } from "react-router-dom";
import {
  House,
  Compass,
  Library,
  Heart,
  Music2,
  User,
  ListMusic,
} from "lucide-react";
import "./Navbar.css";

const navLinks = [
  { path: "/", label: "Home", icon: House },
  { path: "/explore", label: "Explore", icon: Compass },
  { path: "/library", label: "Library", icon: Library },
  { path: "/liked", label: "Liked", icon: Heart },
  { path: "/playlist", label: "Playlist", icon: ListMusic },
  { path: "/account", label: "Account", icon: User },
];

const Navbar = () => {
  return (
    <>
      {/* TOP LOGO BAR */}
      <header className="sw-top-header">
        <NavLink to="/" className="sw-logo-link">
          <div className="sw-logo-icon">
            <Music2 size={22} />
          </div>

          <div className="sw-logo-text">
            <h1>SoundWave</h1>
            <p>Feel the music</p>
          </div>
        </NavLink>
      </header>

      {/* BOTTOM NAVBAR */}
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