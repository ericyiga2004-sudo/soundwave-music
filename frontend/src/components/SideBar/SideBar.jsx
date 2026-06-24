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
import "./Sidebar.css";

const sidebarLinks = [
  { path: "/", label: "Home", icon: House },
  { path: "/explore", label: "Explore", icon: Compass },
  { path: "/library", label: "Library", icon: Library },
  { path: "/liked", label: "Liked", icon: Heart },
  { path: "/playlist", label: "Playlist", icon: ListMusic },
  { path: "/account", label: "Account", icon: User },
];

const Sidebar = () => {
  return (
    <aside className="sw-sidebar desktop-only">
      <div className="sw-sidebar-logo">
        <div className="sw-sidebar-logo-icon">
          <Music2 size={24} />
        </div>

        <div>
          <h2>SoundWave</h2>
          <p>Feel the music</p>
        </div>
      </div>

      <nav className="sw-sidebar-nav">
        {sidebarLinks.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink key={item.path} to={item.path} className="sw-sidebar-link">
              <Icon size={22} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;