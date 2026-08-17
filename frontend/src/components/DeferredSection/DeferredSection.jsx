import { useEffect, useRef, useState } from "react";
import { getLowData, UI_PREFERENCES_EVENT } from "../../utils/uiPreferences";
import "./DeferredSection.css";

const DeferredSection = ({ children, minHeight = 280, label = "Loading music" }) => {
  const hostRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [lowData, setLowDataState] = useState(getLowData);

  useEffect(() => {
    const sync = () => setLowDataState(getLowData());
    window.addEventListener(UI_PREFERENCES_EVENT, sync);
    return () => window.removeEventListener(UI_PREFERENCES_EVENT, sync);
  }, []);

  useEffect(() => {
    if (visible) return undefined;
    if (!hostRef.current || !("IntersectionObserver" in window)) {
      setVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: lowData ? "120px 0px" : "650px 0px" }
    );

    observer.observe(hostRef.current);
    return () => observer.disconnect();
  }, [lowData, visible]);

  return (
    <div ref={hostRef} className="sw-deferred-section" style={{ minHeight: visible ? undefined : minHeight }}>
      {visible ? children : (
        <div className="sw-section-skeleton" role="status" aria-label={label}>
          <div className="sw-skeleton-heading" />
          <div className="sw-skeleton-row">
            {Array.from({ length: 5 }).map((_, index) => (
              <div className="sw-skeleton-card" key={index}>
                <span className="sw-skeleton-art" />
                <span className="sw-skeleton-line wide" />
                <span className="sw-skeleton-line" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DeferredSection;
