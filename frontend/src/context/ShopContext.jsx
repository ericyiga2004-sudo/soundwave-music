import React, { useEffect, useState } from "react";
import axios from "axios";

export const MusicContext = React.createContext();

const MusicContextProvider = ({ children }) => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(false);

  const [historySongs, setHistorySongs] = useState([]);

  const [playlists, setPlaylists] = useState([]);

  const [token, setToken] = useState(
    localStorage.getItem("token") || ""
  );

  const fetchSongs = async () => {
    try {
      setLoading(true);

      const res = await axios.get(
        `${backendUrl}/api/songs`
      );

      if (res.data.success) {
        setSongs(res.data.songs);
      }
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
  try {
    if (!token) return;

    const res = await axios.get(
      `${backendUrl}/api/history/get`,
      {
        headers: {
          token,
        },
      }
    );

    console.log(res.data);
    

    if (res.data.success) {
      setHistorySongs(res.data.history);
    }
  } catch (error) {
    console.log(error);
  }
};

const fetchPlaylists = async () => {
  try {
    if (!token) {
      setPlaylists([]);
      return;
    }

    const res = await axios.get(
      `${backendUrl}/api/playlist/get`,
      {
        headers: {
          token,
        },
      }
    );

    if (res.data.success) {
      setPlaylists(res.data.playlists || []);
    }
  } catch (error) {
    console.log(error);
  }
};

useEffect(() => {
  if (token) {
    fetchPlaylists();
  } else {
    setPlaylists([]);
  }
}, [token]);

  // Save token everywhere automatically
  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
    }
  }, [token]);

  useEffect(() => {
  if (token) {
    fetchHistory();
  }
}, [token]);

  useEffect(() => {
    fetchSongs();
  }, []);

  const logout = () => {
    setToken("");
    localStorage.removeItem("token");
  };

  const value = {
    songs,
    loading,

    token,
    setToken,
    logout,

    backendUrl,

    historySongs,
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