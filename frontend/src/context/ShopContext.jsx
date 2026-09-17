import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config/api";
import { getLowData } from "../utils/uiPreferences";

export const MusicContext = React.createContext(null);

const AUDIUS_CACHE_KEY = "soundwave_audius_catalog_v24";

const readAudiusCache = () => {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(AUDIUS_CACHE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeAudiusCache = (songs = []) => {
  try {
    sessionStorage.setItem(AUDIUS_CACHE_KEY, JSON.stringify((songs || []).slice(0, 100)));
  } catch {}
};

const shuffleCopy = (items = []) => {
  const output = [...items];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [output[index], output[target]] = [output[target], output[index]];
  }
  return output;
};

const mixCatalogs = (localSongs = [], externalSongs = []) => {
  const local = shuffleCopy(localSongs);
  const external = shuffleCopy(externalSongs);
  const combined = [];
  const seen = new Set();

  while (local.length || external.length) {
    const chooseExternal = external.length && (!local.length || Math.random() < 0.5);
    const song = chooseExternal ? external.shift() : local.shift();
    const key = String(song?._id || "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    combined.push(song);
  }

  return combined;
};

const isBadTokenValue = (value) => {
  if (!value) return true;

  const cleanValue = String(value).trim().toLowerCase();

  return (
    cleanValue === "" ||
    cleanValue === "false" ||
    cleanValue === "null" ||
    cleanValue === "undefined" ||
    cleanValue === "none" ||
    cleanValue === "nan"
  );
};

const getStoredToken = () => {
  const token = localStorage.getItem("token");

  if (isBadTokenValue(token)) {
    localStorage.removeItem("token");
    return "";
  }

  return token.trim();
};

const MusicContextProvider = ({ children }) => {
  const backendUrl = API_BASE_URL;

  // Keep `songs` as the original MongoDB/Cloudinary catalog so existing
  // playlists, social features, artist pages and history continue receiving
  // real MongoDB ObjectIds. Audius lives in a separate discovery catalog.
  const [songs, setSongs] = useState([]);
  const [audiusSongs, setAudiusSongs] = useState(readAudiusCache);
  const [catalogSongs, setCatalogSongs] = useState([]);
  const [catalogSource, setCatalogSource] = useState("soundwave");
  const [loading, setLoading] = useState(false);

  const [playlists, setPlaylists] = useState([]);
  const [receivedPlaylistShares, setReceivedPlaylistShares] = useState([]);

  const [token, setToken] = useState(getStoredToken);

  const getAuthToken = () => {
    const cleanToken = String(token || localStorage.getItem("token") || "").trim();

    if (isBadTokenValue(cleanToken)) {
      localStorage.removeItem("token");
      return "";
    }

    return cleanToken;
  };

  const fetchSongs = async () => {
    const localLimit = getLowData() ? 60 : 120;
    const audiusLimit = getLowData() ? 30 : 60;

    try {
      setLoading(true);

      // Fetch both independently. Audius is allowed to fail without taking
      // Soundwave down, and the legacy /api/songs catalog keeps its old role.
      const [localResult, audiusResult] = await Promise.allSettled([
        axios.get(`${backendUrl}/api/songs`, {
          params: { limit: localLimit, sort: "popular" },
        }),
        axios.get(`${backendUrl}/api/audius/catalog`, {
          params: { limit: audiusLimit, time: "week" },
          timeout: 20000,
        }),
      ]);

      const localResponse =
        localResult.status === "fulfilled" ? localResult.value : null;
      const audiusResponse =
        audiusResult.status === "fulfilled" ? audiusResult.value : null;

      const localSongs = localResponse?.data?.success
        ? localResponse.data.songs || []
        : [];

      // If Audius itself failed, the backend Audius route returns Soundwave
      // songs as a fallback. Use that only when the normal songs request also
      // failed, otherwise keep one clean local catalog.
      const audiusPayloadSongs = audiusResponse?.data?.success
        ? audiusResponse.data.songs || []
        : [];

      const audiusIsLive =
        audiusResponse?.data?.success &&
        audiusResponse.data.source === "audius" &&
        audiusResponse.data.fallback !== true;

      const freshExternalSongs = audiusIsLive
        ? audiusPayloadSongs.filter((song) => song?.isExternal)
        : [];

      // Do not make the UI flicker to local-only because one Audius request
      // failed. Keep the last healthy session catalog while the backend's
      // stale cache/retry layer recovers.
      const externalSongs = freshExternalSongs.length
        ? freshExternalSongs
        : (audiusSongs.length ? audiusSongs : readAudiusCache());

      if (freshExternalSongs.length) writeAudiusCache(freshExternalSongs);

      const localFallbackSongs =
        localSongs.length > 0
          ? localSongs
          : audiusResponse?.data?.source === "soundwave"
            ? audiusPayloadSongs
            : [];

      setSongs(localFallbackSongs);
      setAudiusSongs(externalSongs);

      const combined = mixCatalogs(localFallbackSongs, externalSongs);

      setCatalogSongs(combined);
      setCatalogSource(externalSongs.length && localFallbackSongs.length ? "mixed" : externalSongs.length ? "audius" : "soundwave");
    } catch (error) {
      // Promise.allSettled makes this unlikely, but keep a final safety net.
      console.log("Fetch songs error:", error);
      setAudiusSongs((current) => current.length ? current : readAudiusCache());
      setCatalogSongs((current) => (current.length ? current : mixCatalogs(songs, readAudiusCache())));
      setCatalogSource("soundwave");
    } finally {
      setLoading(false);
    }
  };

  const fetchPlaylists = async () => {
    try {
      const authToken = String(
        token || localStorage.getItem("token") || ""
      ).trim();
  
      if (
        !authToken ||
        authToken === "false" ||
        authToken === "null" ||
        authToken === "undefined"
      ) {
        setPlaylists([]);
        return [];
      }
  
      const res = await axios.get(`${backendUrl}/api/playlist/get`, {
        headers: {
          token: authToken,
        },
      });
  
      if (res.data?.success) {
        const fetchedPlaylists = res.data.playlists || [];
        setPlaylists(fetchedPlaylists);
        return fetchedPlaylists;
      }
  
      return [];
    } catch (error) {
      console.log("Fetch playlists error:", error);
      return [];
    }
  };

  const fetchReceivedPlaylistShares = async () => {
    try {
      const authToken = getAuthToken();

      if (!authToken) {
        setReceivedPlaylistShares([]);
        return;
      }

      const res = await axios.get(`${backendUrl}/api/playlist/share/received`, {
        headers: {
          token: authToken,
        },
      });

      if (res.data?.success) {
        setReceivedPlaylistShares(res.data.shares || []);
      } else {
        setReceivedPlaylistShares([]);
      }
    } catch (error) {
      console.log("Fetch received playlist shares error:", error);
      setReceivedPlaylistShares([]);
    }
  };

  useEffect(() => {
    if (!isBadTokenValue(token)) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
    }
  }, [token]);

  useEffect(() => {
    fetchSongs();
  }, []);

  useEffect(() => {
    fetchPlaylists();
    fetchReceivedPlaylistShares();
  }, [token]);

  const logout = () => {
    setToken("");
    localStorage.removeItem("token");
    setPlaylists([]);
    setReceivedPlaylistShares([]);
  };

  const value = {
    songs,
    setSongs,

    audiusSongs,
    setAudiusSongs,
    catalogSongs,
    setCatalogSongs,
    catalogSource,

    loading,
    setLoading,

    token,
    setToken,
    getAuthToken,

    logout,

    backendUrl,

    playlists,
    setPlaylists,
    fetchPlaylists,

    receivedPlaylistShares,
    setReceivedPlaylistShares,
    fetchReceivedPlaylistShares,
  };

  return (
    <MusicContext.Provider value={value}>{children}</MusicContext.Provider>
  );
};

export default MusicContextProvider;