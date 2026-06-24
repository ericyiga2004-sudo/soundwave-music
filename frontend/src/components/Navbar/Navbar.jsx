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

const navItems = [
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
      <aside className="sidebar">
        <div className="logo">
          <Music2 size={30} />
          <span>SoundWave</span>
        </div>

        <nav className="nav-links">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink key={item.path} to={item.path} className="nav-item">
                <Icon size={22} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <nav className="mobile-bottom-nav">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink key={item.path} to={item.path} className="mobile-nav-item">
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