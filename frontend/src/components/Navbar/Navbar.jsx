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
  {
    path: "/",
    label: "Home",
    icon: House,
  },
  {
    path: "/explore",
    label: "Explore",
    icon: Compass,
  },
  {
    path: "/library",
    label: "Library",
    icon: Library,
  },
  {
    path: "/liked",
    label: "Liked",
    icon: Heart,
  },
  {
    path: "/playlist",
    label: "Playlist",
    icon: ListMusic,
  },
  {
    path: "/account",
    label: "Account",
    icon: User,
  },
];

const Navbar = () => {
  return (
    <>
      {/* DESKTOP SIDEBAR */}
      <aside className="desktop-sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Music2 size={24} />
          </div>
          <span>SoundWave</span>
        </div>

        <nav className="desktop-nav-links">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink key={item.path} to={item.path} className="desktop-nav-item">
                <Icon size={21} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      {/* MOBILE BOTTOM NAV */}
      <nav className="mobile-bottom-nav">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink key={item.path} to={item.path} className="mobile-nav-item">
              <Icon size={21} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </>
  );
};

export default Navbar;