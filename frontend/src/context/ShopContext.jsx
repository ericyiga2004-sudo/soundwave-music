import React, { useEffect, useState } from "react";
import axios from "axios";

export const MusicContext = React.createContext(null);

const MusicContextProvider = ({ children }) => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [historySongs, setHistorySongs] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [token, setToken] = useState(localStorage.getItem("token") || "");

  const fetchSongs = async () => {
    try {
      setLoading(true);

      const res = await axios.get(`${backendUrl}/api/songs`);

      if (res.data?.success) {
        setSongs(res.data.songs || []);
      }
    } catch (error) {
      console.log("Fetch songs error:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      if (!token) {
        setHistorySongs([]);
        return;
      }

      const res = await axios.get(`${backendUrl}/api/history/get`, {
        headers: {
          token,
        },
      });

      if (res.data?.success) {
        setHistorySongs(res.data.history || []);
      }
    } catch (error) {
      console.log("Fetch history error:", error);
    }
  };

  const fetchPlaylists = async () => {
    try {
      if (!token) {
        setPlaylists([]);
        return;
      }

      const res = await axios.get(`${backendUrl}/api/playlist/get`, {
        headers: {
          token,
        },
      });

      if (res.data?.success) {
        setPlaylists(res.data.playlists || []);
      }
    } catch (error) {
      console.log("Fetch playlists error:", error);
    }
  };

  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
    }
  }, [token]);

  useEffect(() => {
    fetchSongs();
  }, []);

  useEffect(() => {
    if (token) {
      fetchHistory();
      fetchPlaylists();
    } else {
      setHistorySongs([]);
      setPlaylists([]);
    }
  }, [token]);

  const logout = () => {
    setToken("");
    localStorage.removeItem("token");
    setHistorySongs([]);
    setPlaylists([]);
  };

  const value = {
    songs,
    setSongs,
    loading,
    setLoading,

    token,
    setToken,
    logout,

    backendUrl,

    historySongs,
    setHistorySongs,
    fetchHistory,

    playlists,
    setPlaylists,
    fetchPlaylists,
  };

  return (
    <MusicContext.Provider value={value}>
      {children}
    </MusicContext.Provider>
  );
};

export default MusicContextProvider;