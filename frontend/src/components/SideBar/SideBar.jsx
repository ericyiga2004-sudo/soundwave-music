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
import "./SideBar.css";

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

const SideBar = () => {
  return (
    <>
      {/* DESKTOP SIDEBAR */}
      <aside className="sw-desktop-sidebar">
        <div className="sw-logo">
          <div className="sw-logo-icon">
            <Music2 size={24} />
          </div>

          <div>
            <h2>SoundWave</h2>
            <p>Music Studio</p>
          </div>
        </div>

        <nav className="sw-desktop-menu">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink key={item.path} to={item.path} className="sw-desktop-link">
                <Icon size={21} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      {/* MOBILE TOP BAR */}
      <header className="sw-mobile-header">
        <div className="sw-mobile-brand">
          <Music2 size={20} />
          <span>SoundWave</span>
        </div>
      </header>

      {/* MOBILE BOTTOM NAV */}
      <nav className="sw-mobile-bottom-nav">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink key={item.path} to={item.path} className="sw-mobile-link">
              <Icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </>
  );
};

export default SideBar;