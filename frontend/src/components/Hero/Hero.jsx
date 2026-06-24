import React from 'react'

import "./Hero.css";

const Hero = () => {
  return (
    <section className="hero">
      <div className="hero-overlay">
        <h1>Feel Every Beat</h1>
        <p>
          Discover music, create playlists, and share your sound with the world.
        </p>

        <div className="hero-buttons">
          <button className="primary-btn">Start Listening</button>
          <button className="secondary-btn">Browse Music</button>
        </div>
      </div>
    </section>
  );
};

export default Hero;