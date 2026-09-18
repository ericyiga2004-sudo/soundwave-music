import { NavLink } from "react-router-dom";
import { Home, Music2, RadioTower, Send, Sparkles, UsersRound, UserRoundSearch } from "lucide-react";

const items = [
  { to: "/social", label: "Overview", icon: Home, end: true },
  { to: "/social/share", label: "Share", icon: Send },
  { to: "/social/today", label: "Today", icon: Music2 },
  { to: "/social/circles", label: "Circles", icon: UsersRound },
  { to: "/social/rooms", label: "Rooms", icon: RadioTower },
  { to: "/social/mix", label: "Friend Mix", icon: Sparkles },
  { to: "/social/people", label: "People", icon: UserRoundSearch },
];

const SocialNav = () => (
  <nav className="sw-social-mode-nav flex w-full max-w-full items-center gap-2 overflow-x-auto overscroll-x-contain pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="SoundWave Social modes">
    {items.map(({ to, label, icon: Icon, end }) => (
      <NavLink key={to} to={to} end={end} className={({ isActive }) => `${isActive ? "active" : ""} flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-[var(--sw-border)] bg-[var(--sw-surface)] px-4 text-sm font-extrabold text-[var(--sw-text-secondary)] no-underline max-[380px]:h-11 max-[380px]:w-11 max-[380px]:px-0 ${isActive ? "!border-[var(--sw-accent)] !bg-[var(--sw-accent)] !text-white" : ""}`}>
        <Icon className="!h-5 !w-5 shrink-0" strokeWidth={2.3} />
        <span className="max-[380px]:hidden">{label}</span>
      </NavLink>
    ))}
  </nav>
);

export default SocialNav;
