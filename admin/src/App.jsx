import { useState } from "react";
import AddArtist from "./components/AddArtist";
import AddAlbum from "./components/AddAlbum";
import AddSong from "./components/AddSong";
import ListSongs from "./components/ListSongs";
import { ADMIN_API_BASE_URL } from "./config/api";
import "./App.css";

export const backendUrl = ADMIN_API_BASE_URL;

const tabs = [
  ["song", "Add song"],
  ["artist", "Add artist"],
  ["album", "Add album"],
  ["manage", "Manage songs"],
];

const App = () => {
  const [tab, setTab] = useState("song");

  return (
    <main className="admin-app">
      <header className="admin-header">
        <div>
          <span className="admin-mark">♪</span>
          <div><strong>SoundWave</strong><small>Catalog Admin</small></div>
        </div>
        <nav aria-label="Admin sections">
          {tabs.map(([id, label]) => (
            <button key={id} type="button" className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>
          ))}
        </nav>
      </header>

      <div className="admin-content">
        {tab === "song" ? <AddSong /> : null}
        {tab === "artist" ? <AddArtist /> : null}
        {tab === "album" ? <AddAlbum /> : null}
        {tab === "manage" ? <ListSongs /> : null}
      </div>
    </main>
  );
};

export default App;
