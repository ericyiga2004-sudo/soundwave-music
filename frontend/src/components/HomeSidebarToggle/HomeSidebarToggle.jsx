import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import {
  getSidebarHidden,
  setSidebarHidden,
} from "../../utils/uiPreferences";
import "./HomeSidebarToggle.css";

const HomeSidebarToggle = () => {
  const [hidden, setHidden] = useState(getSidebarHidden);

  useEffect(() => {
    const sync = (event) => {
      if (typeof event?.detail?.sidebarHidden === "boolean") {
        setHidden(event.detail.sidebarHidden);
        return;
      }
      setHidden(getSidebarHidden());
    };

    window.addEventListener("soundwave-preferences", sync);
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener("soundwave-preferences", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = () => {
    const next = !hidden;
    setHidden(next);
    setSidebarHidden(next);
  };

  return (
    <div className="sw23242-home-sidebar-toggle-wrap">
      <button
        type="button"
        className="sw23242-home-sidebar-toggle"
        onClick={toggle}
        aria-label={hidden ? "Show sidebar" : "Hide sidebar"}
        title={hidden ? "Show sidebar" : "Hide sidebar"}
      >
        {hidden ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
      </button>
    </div>
  );
};

export default HomeSidebarToggle;
