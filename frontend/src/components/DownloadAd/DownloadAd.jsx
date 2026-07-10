import React, { useEffect, useState } from "react";
import { isWebsite } from "../../utils/platform";
import "./DownloadAd.css";

const ANDROID_APK_URL =
  "https://github.com/ericyiga2004-sudo/soundwave-music/releases/download/V2.0.0/SoundWave";

const WINDOWS_EXE_URL =
  "https://github.com/ericyiga2004-sudo/soundwave-music/releases/download/v1.0.1/SoundWave.Setup.1.0.0.exe";

const DownloadAd = () => {
  const [downloadStatus, setDownloadStatus] = useState("");

  useEffect(() => {
    if (!downloadStatus) return;

    const timer = setTimeout(() => {
      setDownloadStatus("");
    }, 8500);

    return () => clearTimeout(timer);
  }, [downloadStatus]);

  if (!isWebsite()) {
    return null;
  }

  const handleDownloadClick = (platform) => {
    setDownloadStatus(`${platform} download started`);
  };

  return (
    <section className="download-ad my-4">
      <div className="container-fluid px-3 px-sm-4 px-lg-5">
        <div className="download-ad-box row align-items-center g-4">
          <div className="col-12 col-lg-7">
            <div className="download-ad-content">
              <span className="download-ad-badge">
                SoundWave app available
              </span>

              <h2>Get SoundWave on your devices</h2>

              <p>
                Install SoundWave on Android or Windows and enjoy a smoother
                app-like music experience.
              </p>

              <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-3 mt-4">
                <a
                  href={ANDROID_APK_URL}
                  className="download-ad-btn"
                  onClick={() => handleDownloadClick("Android APK")}
                >
                  Android APK
                </a>

                <a
                  href={WINDOWS_EXE_URL}
                  className="download-ad-btn download-ad-btn-dark"
                  onClick={() => handleDownloadClick("Windows EXE")}
                >
                  Windows EXE
                </a>
              </div>

              <div className="download-ad-meta">
                <span>Android 10.3 MB</span>
                <span>Windows 84.5 MB</span>
              </div>

              <small className="download-ad-note">
                Android may ask you to allow installation from your browser.
              </small>

              {downloadStatus && (
                <div className="download-status" role="status">
                  <div className="download-status-top">
                    <span>{downloadStatus}</span>
                    <strong>SoundWave</strong>
                  </div>

                  <div className="download-status-bar">
                    <span></span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="col-12 col-lg-5">
            <div className="download-devices">
              <div className="download-laptop" aria-hidden="true">
                <div className="download-laptop-top">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>

                <div className="download-laptop-screen">
                  <div className="download-mini-sidebar"></div>

                  <div className="download-mini-content">
                    <div className="download-mini-title"></div>
                    <div className="download-mini-card"></div>

                    <div className="download-mini-bars">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>

                <div className="download-laptop-base"></div>
              </div>

              <div className="download-phone-mini" aria-hidden="true">
                <div className="download-phone-notch"></div>
                <div className="download-phone-logo">♪</div>
                <strong>SoundWave</strong>
                <span>Mobile</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DownloadAd;