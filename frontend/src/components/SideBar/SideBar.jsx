import { useContext } from "react";
import { NavLink } from "react-router-dom";
import {
  Heart,
  Home,
  Library,
  ListMusic,
  Music2,
  Disc3,
  Mic2,
  Plus,
  Radio,
  Sparkles,
  User,
  UsersRound,
} from "lucide-react";
import { MusicContext } from "../../context/ShopContext";
import "./SideBar.css";

const primaryLinks = [
  { path: "/", label: "Home", icon: Home },
  { path: "/explore", label: "New", icon: Sparkles },
  { path: "/radio", label: "Radio", icon: Radio },
  { path: "/social", label: "Social", icon: UsersRound },
];

const libraryLinks = [
  { path: "/library", label: "Library", icon: Library },
  { path: "/songs", label: "Songs", icon: Music2 },
  { path: "/artists", label: "Artists", icon: Mic2 },
  { path: "/albums", label: "Albums", icon: Disc3 },
  { path: "/liked", label: "Favorites", icon: Heart },
  { path: "/playlist", label: "Playlists", icon: ListMusic },
];

const SidebarLink = ({ item }) => {
  const Icon = item.icon;
  return (
    <NavLink to={item.path} className="sw-sidebar-link" title={item.label}>
      <Icon size={18} strokeWidth={2} />
      <span>{item.label}</span>
    </NavLink>
  );
};

const Sidebar = () => {
  const { playlists = [] } = useContext(MusicContext);

  return (
    <aside className="sw-sidebar d-none d-lg-flex">
      <NavLink to="/" className="sw-sidebar-logo" aria-label="SoundWave home">
        <div className="sw-sidebar-logo-icon">
          <Music2 size={22} strokeWidth={2.4} />
        </div>
        <div className="sw-sidebar-logo-copy">
          <strong>SoundWave</strong>
          <small>Music</small>
        </div>
      </NavLink>

      <nav className="sw-sidebar-nav" aria-label="SoundWave">
        <div className="sw-sidebar-group">
          {primaryLinks.map((item) => (
            <SidebarLink key={item.path} item={item} />
          ))}
        </div>

        <div className="sw-sidebar-divider" />

        <div className="sw-sidebar-group">
          <span className="sw-sidebar-label">Library</span>
          {libraryLinks.map((item) => (
            <SidebarLink key={item.path} item={item} />
          ))}
        </div>

        <div className="sw-sidebar-divider" />

        <div className="sw-sidebar-playlists">
          <div className="sw-sidebar-section-row">
            <span className="sw-sidebar-label">Playlists</span>
            <NavLink to="/playlist" title="Create playlist" aria-label="Create playlist">
              <Plus size={16} />
            </NavLink>
          </div>
          {playlists.slice(0, 6).map((playlist) => (
            <NavLink
              key={playlist._id || playlist.name}
              to={`/playlist/${playlist._id}`}
              className="sw-sidebar-playlist"
              title={playlist.name || playlist.title || "Playlist"}
            >
              <span>{playlist.name || playlist.title || "Playlist"}</span>
            </NavLink>
          ))}
          {!playlists.length && (
            <span className="sw-sidebar-empty">Your playlists appear here.</span>
          )}
        </div>
      </nav>

      <NavLink to="/account" className="sw-sidebar-account">
        <span className="sw-sidebar-account-icon">
          <User size={16} />
        </span>
        <span>Account</span>
      </NavLink>
    </aside>
  );
};

export default Sidebar;
