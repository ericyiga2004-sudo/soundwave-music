import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useRealtime } from "../../context/RealtimeContext";
import SocialNav from "./SocialNav";
import "../../pages/CSS/SocialV20.css";

const SocialPageHero = ({ kicker = "SoundWave Social", title, description, image, children, live = false }) => {
  const { connected, mode } = useRealtime();
  const isLive = Boolean(live || connected);
  const isPolling = !isLive && mode === "polling";
  const label = isLive ? "Live" : isPolling ? "Updates on" : mode === "checking" ? "Checking" : "Offline";
  const Icon = isLive ? Wifi : isPolling ? RefreshCw : WifiOff;

  return (
    <>
      <SocialNav />
      <header className="sw20-social-hero">
        <div className="sw20-social-hero-copy">
          <div className="sw20-social-kicker-row">
            <span className="sw-social-kicker">{kicker}</span>
            <span className={isLive ? "sw20-live-state online" : isPolling ? "sw20-live-state fallback" : "sw20-live-state"}>
              <Icon size={13} />
              {label}
            </span>
          </div>
          <h1>{title}</h1>
          <p>{description}</p>
          {children ? <div className="sw20-hero-actions">{children}</div> : null}
        </div>
        <div className="sw20-social-hero-image">
          <img src={image?.src} alt={image?.alt || ""} loading="eager" decoding="async" />
        </div>
      </header>
    </>
  );
};

export default SocialPageHero;
