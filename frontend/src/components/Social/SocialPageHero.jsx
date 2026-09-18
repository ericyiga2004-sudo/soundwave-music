import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useRealtime } from "../../context/RealtimeContext";
import SocialNav from "./SocialNav";
import "../../pages/CSS/SocialV20.tailwind.css";

const SocialPageHero = ({ kicker = "SoundWave Social", title, description, image, children, live = false }) => {
  const { connected, mode } = useRealtime();
  const isLive = Boolean(live || connected);
  const isPolling = !isLive && mode === "polling";
  const label = isLive ? "Live" : isPolling ? "Updates on" : mode === "checking" ? "Checking" : "Offline";
  const Icon = isLive ? Wifi : isPolling ? RefreshCw : WifiOff;

  return (
    <>
      <SocialNav />
      <header className="sw20-social-hero !grid min-w-0 !grid-cols-1 !gap-4 !border-b !border-[var(--sw-border)] !pb-5 lg:!grid-cols-[minmax(0,1.08fr)_minmax(320px,.92fr)] lg:!gap-6">
        <div className="sw20-social-hero-copy min-w-0 !p-0 sm:!py-2 lg:!py-[18px]">
          <div className="sw20-social-kicker-row">
            <span className="sw-social-kicker">{kicker}</span>
            <span className={isLive ? "sw20-live-state online" : isPolling ? "sw20-live-state fallback" : "sw20-live-state"}>
              <Icon size={13} />
              {label}
            </span>
          </div>
          <h1 className="!max-w-full !text-[clamp(1.85rem,9vw,2.5rem)] !leading-[1.02] break-words sm:!text-[clamp(2rem,6vw,3.5rem)] lg:!text-[clamp(2rem,4vw,4.2rem)]">{title}</h1>
          <p className="!max-w-full !text-sm sm:!text-[0.95rem]">{description}</p>
          {children ? <div className="sw20-hero-actions">{children}</div> : null}
        </div>
        <div className="sw20-social-hero-image min-w-0 !min-h-0 !w-full !aspect-[16/9] !rounded-[20px] sm:!aspect-[16/8] lg:!aspect-auto lg:!min-h-[320px] lg:!rounded-[26px]">
          <img src={image?.src} alt={image?.alt || ""} loading="eager" decoding="async" />
        </div>
      </header>
    </>
  );
};

export default SocialPageHero;
