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
  <nav className="sw-social-mode-nav" aria-label="SoundWave Social modes">
    {items.map(({ to, label, icon: Icon, end }) => (
      <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? "active" : ""}>
        <Icon size={16} />
        <span>{label}</span>
      </NavLink>
    ))}
  </nav>
);

export default SocialNav;
