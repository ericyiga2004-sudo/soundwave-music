import React from "react";
import { Link } from "react-router-dom";
import "./CSS/DjStudio.css";

const DjStudio = () => {
  const studioModes = [
    {
      title: "Drum Sequencer",
      badge: "Start Here",
      text: "Build beats with kick, snare, clap, hi-hat, and percussion on a time grid.",
      link: "/drumsequence",
      buttonText: "Open Drum Grid",
      active: true,
    },
    {
      title: "Piano Roll",
      badge: "Melodies",
      text: "Create simple melodies by placing notes on a grid and adjusting the BPM.",
      link: "",
      buttonText: "Coming Soon",
      active: false,
    },
    {
      title: "Live Pads",
      badge: "Performance",
      text: "Trigger sounds like lazer, crowd, rewind, airhorn, and impacts while playing.",
      link: "",
      buttonText: "Coming Soon",
      active: false,
    },
  ];

  const features = [
    "Adjust BPM",
    "Make drum loops",
    "Play piano notes",
    "Place sounds on grid",
    "Build melodies",
    "Save projects later",
  ];

  return (
    <main className="dj-studio-page text-white">
      <section className="dj-studio-hero container-fluid">
        <div className="row align-items-center g-4">
          <div className="col-12 col-lg-6">
            <span className="studio-kicker">Soundwave Advanced</span>

            <h1>Build beats, melodies, and loops inside Soundwave Studio.</h1>

            <p className="studio-hero-text">
              Start with a simple beat grid, add drums, control BPM, and later
              create piano melodies like a real music production workspace.
            </p>

            <div className="studio-hero-actions">
              <Link to="/drumsequence" className="studio-main-btn">
                Start New Beat
              </Link>

              <Link to="/dj" className="studio-outline-btn">
                Open Beginner DJ
              </Link>
            </div>

            <div className="studio-mini-stats">
              <div>
                <strong>16</strong>
                <span>Step Grid</span>
              </div>

              <div>
                <strong>4</strong>
                <span>Drum Rows</span>
              </div>

              <div>
                <strong>80-160</strong>
                <span>BPM Range</span>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-6">
            <div className="studio-preview">
              <div className="studio-preview-top">
                <div>
                  <span>Studio Preview</span>
                  <h2>Beat Grid</h2>
                </div>

                <span className="studio-bpm-badge">120 BPM</span>
              </div>

              <div className="studio-grid-demo">
                {["Kick", "Snare", "Clap", "Hi Hat", "Piano"].map(
                  (row, rowIndex) => (
                    <div className="studio-demo-row" key={row}>
                      <span>{row}</span>

                      <div className="studio-demo-cells">
                        {Array.from({ length: 16 }).map((_, index) => {
                          const active =
                            (rowIndex === 0 &&
                              [0, 4, 8, 12].includes(index)) ||
                            (rowIndex === 1 && [4, 12].includes(index)) ||
                            (rowIndex === 2 && [6, 14].includes(index)) ||
                            (rowIndex === 3 && index % 2 === 0) ||
                            (rowIndex === 4 && [2, 5, 9, 13].includes(index));

                          return (
                            <span
                              key={`${row}-${index}`}
                              className={active ? "active" : ""}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )
                )}
              </div>

              <div className="studio-preview-footer">
                <span>Loop ready</span>
                <span>4 bars</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="studio-section container-fluid">
        <div className="studio-section-header">
          <span>Choose Your Workflow</span>
          <h2>What do you want to create?</h2>
        </div>

        <div className="row g-3 g-lg-4">
          {studioModes.map((mode) => (
            <div className="col-12 col-md-4" key={mode.title}>
              <article className="studio-mode-card h-100">
                <span>{mode.badge}</span>
                <h3>{mode.title}</h3>
                <p>{mode.text}</p>

                {mode.active ? (
                  <Link to={mode.link} className="studio-card-link">
                    {mode.buttonText}
                  </Link>
                ) : (
                  <button type="button" disabled>
                    {mode.buttonText}
                  </button>
                )}
              </article>
            </div>
          ))}
        </div>
      </section>

      <section className="studio-section container-fluid">
        <div className="row g-3 g-lg-4 align-items-stretch">
          <div className="col-12 col-lg-5">
            <div className="studio-panel h-100">
              <span className="studio-panel-label">Studio Plan</span>
              <h2>First version should stay simple.</h2>
              <p>
                The first advanced page should focus on a clean beat maker:
                drums, piano notes, BPM, play, stop, and clear.
              </p>

              <div className="studio-roadmap">
                <div>
                  <strong>01</strong>
                  <span>Drum grid</span>
                </div>

                <div>
                  <strong>02</strong>
                  <span>Piano roll</span>
                </div>

                <div>
                  <strong>03</strong>
                  <span>Save beats</span>
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-7">
            <div className="studio-panel h-100">
              <span className="studio-panel-label">Core Features</span>

              <div className="studio-feature-list">
                {features.map((feature) => (
                  <div className="studio-feature-item" key={feature}>
                    <span />
                    <p>{feature}</p>
                  </div>
                ))}
              </div>

              <div className="studio-bottom-note">
                Next build: real clickable drum grid with Kick, Snare, Clap, and
                Hi Hat.
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default DjStudio;