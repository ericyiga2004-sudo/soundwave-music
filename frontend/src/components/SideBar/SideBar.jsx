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
    <NavLink to={item.path} className="sw-sidebar-link mx-auto flex h-[45px] w-12 items-center justify-center gap-2.5 rounded-[13px] px-0 text-[.84rem] font-[570] text-[var(--sw-text-secondary)] no-underline transition-colors hover:bg-[color-mix(in_srgb,var(--sw-surface-3)_68%,transparent)] hover:text-[var(--sw-text)] [&.active]:bg-[color-mix(in_srgb,var(--sw-accent-soft)_76%,transparent)] [&.active]:text-[var(--sw-accent)] xl:mx-0 xl:h-auto xl:min-h-[37px] xl:w-auto xl:justify-start xl:rounded-lg xl:px-[9px] [&>span]:hidden xl:[&>span]:inline" title={item.label}>
      <Icon size={18} strokeWidth={2} />
      <span>{item.label}</span>
    </NavLink>
  );
};

const Sidebar = ({ hidden = false }) => {
  const { playlists = [] } = useContext(MusicContext);

  return (
    <aside id="soundwave-sidebar" aria-label="Main navigation" className={`${hidden ? "" : "lg:flex"} sw-sidebar fixed inset-y-0 left-0 z-[1040] hidden h-screen w-[86px] flex-col items-center border-r border-solid border-[var(--sw-border)] bg-[var(--sw-sidebar)] px-[11px] pt-[18px] pb-[132px] xl:w-[258px] xl:items-stretch xl:px-[14px]`}>
      <NavLink to="/" className="flex min-h-12 items-center gap-2.5 px-0 pt-1 pb-3.5 no-underline xl:px-2" aria-label="SoundWave home">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[var(--sw-accent)] text-white shadow-[0_9px_20px_rgba(250,35,59,0.2)]">
          <Music2 size={22} strokeWidth={2.4} />
        </div>
        <div className="hidden min-w-0 flex-col xl:flex [&>strong]:text-base [&>strong]:leading-[1.1] [&>strong]:tracking-[-.035em] [&>strong]:text-[var(--sw-text)] [&>small]:mt-0.5 [&>small]:text-[.66rem] [&>small]:text-[var(--sw-text-tertiary)]">
          <strong>SoundWave</strong>
          <small>Music</small>
        </div>
      </NavLink>

      <nav className="min-h-0 w-full flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="SoundWave">
        <div className="grid gap-[5px] xl:gap-0.5">
          {primaryLinks.map((item) => (
            <SidebarLink key={item.path} item={item} />
          ))}
        </div>

        <div className="mx-[9px] my-[13px] hidden h-px bg-[var(--sw-border)] xl:block" />

        <div className="grid gap-[5px] xl:gap-0.5">
          <span className="hidden px-[9px] pb-1.5 text-[.67rem] font-bold tracking-[.02em] text-[var(--sw-text-tertiary)] xl:block">Library</span>
          {libraryLinks.map((item) => (
            <SidebarLink key={item.path} item={item} />
          ))}
        </div>

        <div className="mx-[9px] my-[13px] hidden h-px bg-[var(--sw-border)] xl:block" />

        <div className="hidden xl:block">
          <div className="flex items-center justify-between pr-[7px] [&>a]:grid [&>a]:h-[25px] [&>a]:w-[25px] [&>a]:place-items-center [&>a]:rounded-[7px] [&>a]:text-[var(--sw-text-tertiary)] [&>a:hover]:bg-[var(--sw-surface-3)] [&>a:hover]:text-[var(--sw-accent)]">
            <span className="hidden px-[9px] pb-1.5 text-[.67rem] font-bold tracking-[.02em] text-[var(--sw-text-tertiary)] xl:block">Playlists</span>
            <NavLink to="/playlist" title="Create playlist" aria-label="Create playlist">
              <Plus size={16} />
            </NavLink>
          </div>
          {playlists.slice(0, 6).map((playlist) => (
            <NavLink
              key={playlist._id || playlist.name}
              to={`/playlist/${playlist._id}`}
              className="flex min-h-[29px] items-center px-[9px] text-[.77rem] text-[var(--sw-text-secondary)] no-underline hover:text-[var(--sw-text)] [&>span]:truncate"
              title={playlist.name || playlist.title || "Playlist"}
            >
              <span>{playlist.name || playlist.title || "Playlist"}</span>
            </NavLink>
          ))}
          {!playlists.length && (
            <span className="flex min-h-[29px] items-center px-[9px] text-[.72rem] leading-[1.35] text-[var(--sw-text-tertiary)]">Your playlists appear here.</span>
          )}
        </div>
      </nav>

      <NavLink to="/account" className="flex min-h-[38px] w-[46px] items-center justify-center gap-[9px] rounded-[9px] p-0 text-[.8rem] font-semibold text-[var(--sw-text-secondary)] no-underline hover:bg-[var(--sw-surface-3)] hover:text-[var(--sw-text)] [&.active]:bg-[var(--sw-surface-3)] xl:w-auto xl:justify-start xl:px-[9px] [&>span:last-child]:hidden xl:[&>span:last-child]:inline">
        <span className="grid h-[26px] w-[26px] place-items-center rounded-full border border-solid border-[var(--sw-border)] bg-[var(--sw-surface)] text-[var(--sw-text)]">
          <User size={16} />
        </span>
        <span>Account</span>
      </NavLink>
    </aside>
  );
};

export default Sidebar;
