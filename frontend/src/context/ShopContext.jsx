import React, { useEffect, useState } from "react";
import axios from "axios";

export const MusicContext = React.createContext(null);

const MusicContextProvider = ({ children }) => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(false);
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
      } else {
        setPlaylists([]);
      }
    } catch (error) {
      console.log("Fetch playlists error:", error);
      setPlaylists([]);
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
    fetchPlaylists();
  }, [token]);

  const logout = () => {
    setToken("");
    localStorage.removeItem("token");
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