import React, { useEffect, useState } from "react";
import Hero from "../components/Hero/Hero";
import Trending from "../components/Trending/Trending";
import NewRelease from "../components/NewRelease/NewRelease";
import PopularArtist from "../components/PopularArtist/PopularArtist";
import Albums from "../components/Albums/Albums";
import FilterSongs from "../components/FilterSongs/FilterSongs";
import Yearly from "../components/Nineteen/Yearly";
import MadeForYou from "../components/MadeForYou/MadeForYou";
import ContinueListening from "../components/ContinueListening/ContinueListening";
import YouLiked from "../components/YouLiked/YouLiked";
import Country from "../components/Country/Country";
import FollowedArtists from "../components/FollowedArtists/FollowedArtists";
import "./CSS/Home.css";
import DownloadAd from "../components/DownloadAd/DownloadAd";
import ShareWithMe from "../components/ShareWithMe/ShareWithMe";
import Mood from "../components/Mood/Mood";

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
      {/* <Trending /> */}
      <MadeForYou />
      <ContinueListening />
      <YouLiked />
      <Mood/>
      <Country />
      <ShareWithMe/>
      <FollowedArtists />
      <DownloadAd/>
      <NewRelease />
      <PopularArtist />
      <Albums />
      <FilterSongs />
      <Yearly />

    </div>
  );
};

export default Home;