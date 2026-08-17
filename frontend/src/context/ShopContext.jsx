import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config/api";
import { getLowData } from "../utils/uiPreferences";

export const MusicContext = React.createContext(null);

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

  const [songs, setSongs] = useState([]);
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
    try {
      setLoading(true);

      const res = await axios.get(`${backendUrl}/api/songs`, {
        params: { limit: getLowData() ? 60 : 120, sort: "popular" },
      });

      if (res.data?.success) {
        setSongs(res.data.songs || []);
      }
    } catch (error) {
      console.log("Fetch songs error:", error);
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