import React, { useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { FaLocationDot } from "react-icons/fa6";
import SongItem from "../SongItem/SongItem";
import { MusicContext } from "../../context/ShopContext";
import "./Country.css";

const MAX_COUNTRY_SONGS = 20;

const normalizeCountry = (value = "") => {
  const country = value.toLowerCase().trim();

  const aliases = {
    uganda: "uganda",
    ug: "uganda",
    "united states": "united states",
    usa: "united states",
    us: "united states",
    america: "united states",
    "united kingdom": "united kingdom",
    uk: "united kingdom",
    england: "united kingdom",
    britain: "united kingdom",
  };

  return aliases[country] || country;
};

const getBrowserLocation = () => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      () => resolve(null),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
};

const getCountryFromCoords = async (location) => {
  if (!location?.latitude || !location?.longitude) return "";

  const res = await axios.get(
    "https://api.bigdatacloud.net/data/reverse-geocode-client",
    {
      params: {
        latitude: location.latitude,
        longitude: location.longitude,
        localityLanguage: "en",
      },
    }
  );

  return res.data?.countryName || "";
};

const Country = () => {
  const { songs, backendUrl } = useContext(MusicContext);

  const [detectedCountry, setDetectedCountry] = useState("");
  const [loading, setLoading] = useState(true);

  const saveLocation = async (location) => {
    const token = localStorage.getItem("token");

    if (!token || !location) return;

    try {
      await axios.post(`${backendUrl}/api/user/location`, location, {
        headers: {
          token,
        },
      });
    } catch (error) {
      console.log("Save country location error:", error);
    }
  };

  const detectCountry = async () => {
    try {
      setLoading(true);

      const location = await getBrowserLocation();

      if (!location) {
        setDetectedCountry("");
        return;
      }

      await saveLocation(location);

      const country = await getCountryFromCoords(location);
      setDetectedCountry(country);
    } catch (error) {
      console.log("Detect country error:", error);
      setDetectedCountry("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    detectCountry();
  }, []);

  const countrySongs = useMemo(() => {
    if (!detectedCountry) return [];

    const userCountry = normalizeCountry(detectedCountry);

    return (songs || [])
      .filter((song) => {
        const songCountry = normalizeCountry(song?.country);
        const artistCountry = normalizeCountry(song?.artist?.country);

        return songCountry === userCountry || artistCountry === userCountry;
      })
      .slice(0, MAX_COUNTRY_SONGS);
  }, [songs, detectedCountry]);

  if (!loading && countrySongs.length === 0) {
    return null;
  }

  return (
    <section className="country-section">
      <div className="country-glow"></div>

      <div className="country-header">
        <div>
          <span className="country-badge">
            <FaLocationDot />
            Local Picks
          </span>

          <h2 className="country-title">
            {detectedCountry
              ? `Trending in ${detectedCountry}`
              : "Trending Near You"}
          </h2>

          <p className="country-subtitle">
            Music matched from your current location.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="country-slider">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div className="country-skeleton-card" key={item}>
              <div className="country-skeleton-cover"></div>
              <div className="country-skeleton-line country-skeleton-title"></div>
              <div className="country-skeleton-line country-skeleton-text"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="country-slider">
          {countrySongs.map((song) => (
            <div className="country-slide-item" key={song._id}>
              <SongItem song={song} queue={countrySongs} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default Country;