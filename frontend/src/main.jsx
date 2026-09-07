import "./tailwind.css";
import { createRoot } from "react-dom/client";
import "./index.tailwind.css";
import App from "./App.jsx";
import "./apple-theme.tailwind.css";
import "./v10-layout.tailwind.css";
import "./v12-compact-media.tailwind.css";
import { BrowserRouter } from "react-router-dom";
import MusicContextProvider from "./context/ShopContext";
import { MusicPlayerProvider } from "./context/MainPlayerContext.jsx";
import { RealtimeProvider } from "./context/RealtimeContext.jsx";
import LiveRoomQuickNavigator from "./components/Social/LiveRoomQuickNavigator.jsx";

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <MusicContextProvider>
      <RealtimeProvider>
        <MusicPlayerProvider>
          <App />
          <LiveRoomQuickNavigator />
        </MusicPlayerProvider>
      </RealtimeProvider>
    </MusicContextProvider>
  </BrowserRouter>
);

import "./mobile-layout.tailwind.css";
