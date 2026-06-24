import React from "react";
import { NavLink } from "react-router-dom";
import {
  House,
  Compass,
  Library,
  Heart,
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
    <nav className="sw-bottom-navbar mobile-only">
      {navLinks.map((item) => {
        const Icon = item.icon;

        return (
          <NavLink key={item.path} to={item.path} className="sw-bottom-link">
            <Icon size={20} />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};

export default Navbar;