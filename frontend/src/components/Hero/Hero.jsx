import React from "react";
import { useNavigate } from "react-router-dom";

import "./Hero.css";

const Hero = () => {
  const navigate = useNavigate();

  return (
    <section className="hero">
      <div className="container-fluid px-3 px-sm-4 px-lg-5">
        <div className="hero-overlay row">
          <div className="col-12 col-md-10 col-lg-7 col-xl-6">
            <span className="hero-badge">Music Streaming</span>

            <h1>Feel Every Beat</h1>

            <p>
              Discover music, create playlists, and share your sound with the
              world.
            </p>

            <div className="hero-buttons d-flex flex-column flex-sm-row gap-2 gap-sm-3">
              <button
                type="button"
                className="primary-btn"
                onClick={() => navigate("/explore")}
              >
                Start Listening
              </button>

              <button
                type="button"
                className="secondary-btn"
                onClick={() => navigate("/explore")}
              >
                Browse Music
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;