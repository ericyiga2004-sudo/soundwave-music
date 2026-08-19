import { lazy, Suspense, useEffect, useState } from "react";
import Hero from "../components/Hero/Hero";
import "./CSS/Home.css";
import DeferredSection from "../components/DeferredSection/DeferredSection";
import HomeSidebarToggle from "../components/HomeSidebarToggle/HomeSidebarToggle";

const MadeForYou = lazy(() => import("../components/MadeForYou/MadeForYou"));
const ContinueListening = lazy(() => import("../components/ContinueListening/ContinueListening"));
const YouLiked = lazy(() => import("../components/YouLiked/YouLiked"));
const Mood = lazy(() => import("../components/Mood/Mood"));
const Country = lazy(() => import("../components/Country/Country"));
const ShareWithMe = lazy(() => import("../components/ShareWithMe/ShareWithMe"));
const FollowedArtists = lazy(() => import("../components/FollowedArtists/FollowedArtists"));
const NewRelease = lazy(() => import("../components/NewRelease/NewRelease"));
const PopularArtist = lazy(() => import("../components/PopularArtist/PopularArtist"));
const Albums = lazy(() => import("../components/Albums/Albums"));
const FilterSongs = lazy(() => import("../components/FilterSongs/FilterSongs"));
const Yearly = lazy(() => import("../components/Nineteen/Yearly"));
const DownloadAd = lazy(() => import("../components/DownloadAd/DownloadAd"));

const LazySection = ({ children }) => (
  <Suspense fallback={<div className="home-section-lazy-fallback" aria-hidden="true" />}>
    {children}
  </Suspense>
);

const Home = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleRetry = () => {
    setIsOffline(!navigator.onLine);
  };

  if (isOffline) {
    return (
      <div className="home-network-error">
        <div className="home-offline-bg">
          <span></span>
          <span></span>
          <span></span>
        </div>

        <div className="home-note note-one">♪</div>
        <div className="home-note note-two">♫</div>
        <div className="home-note note-three">♬</div>
        <div className="home-note note-four">♪</div>

        <div className="home-offline-card">
          <div className="home-offline-character">
            <div className="home-antenna">
              <span></span>
            </div>

            <div className="home-robot-head">
              <div className="home-robot-ear left"></div>
              <div className="home-robot-ear right"></div>

              <div className="home-robot-face">
                <div className="home-robot-eye left"></div>
                <div className="home-robot-eye right"></div>
                <div className="home-robot-mouth"></div>
              </div>
            </div>

            <div className="home-robot-body">
              <div className="home-robot-arm left"></div>
              <div className="home-robot-arm right"></div>

              <div className="home-wifi-icon">
                <span></span>
                <span></span>
                <span></span>
                <div className="home-wifi-slash"></div>
              </div>
            </div>

            <div className="home-robot-feet">
              <span></span>
              <span></span>
            </div>

            <div className="home-robot-shadow"></div>
          </div>

          <div className="home-offline-content">
            <span className="home-offline-badge">Network Error</span>
            <h1>No internet connection</h1>
            <p>
              Your music world is taking a quick nap. Connect to the internet
              and your homepage will come back with songs, artists, albums, and
              playlists.
            </p>

            <button onClick={handleRetry} className="home-retry-btn">
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Hero />
      <DeferredSection minHeight={260}><LazySection><MadeForYou /></LazySection></DeferredSection>
      <DeferredSection minHeight={250}><LazySection><ContinueListening /></LazySection></DeferredSection>
      <DeferredSection minHeight={260}><LazySection><YouLiked /></LazySection></DeferredSection>
      <DeferredSection minHeight={360}><LazySection><Mood /></LazySection></DeferredSection>
      <DeferredSection minHeight={260}><LazySection><Country /></LazySection></DeferredSection>
      <DeferredSection minHeight={240}><LazySection><ShareWithMe /></LazySection></DeferredSection>
      <DeferredSection minHeight={300}><LazySection><FollowedArtists /></LazySection></DeferredSection>
      <DeferredSection minHeight={260}><LazySection><NewRelease /></LazySection></DeferredSection>
      <DeferredSection minHeight={300}><LazySection><PopularArtist /></LazySection></DeferredSection>
      <DeferredSection minHeight={280}><LazySection><Albums /></LazySection></DeferredSection>
      <DeferredSection minHeight={300}><LazySection><FilterSongs /></LazySection></DeferredSection>
      <DeferredSection minHeight={420}><LazySection><Yearly /></LazySection></DeferredSection>
      <DeferredSection minHeight={220}><LazySection><DownloadAd /></LazySection></DeferredSection>
      <HomeSidebarToggle />

    </div>
  );
};

export default Home;
