import { createRoot } from "react-dom/client";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./index.css";
import App from "./App.jsx";
import "./apple-theme.css";
import "./v10-layout.css";
import "./v12-compact-media.css";
import { BrowserRouter } from "react-router-dom";
import MusicContextProvider from "./context/ShopContext";
import { MusicPlayerProvider } from "./context/MainPlayerContext.jsx";

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <MusicContextProvider>
      <MusicPlayerProvider>
        <App />
      </MusicPlayerProvider>
    </MusicContextProvider>
  </BrowserRouter>
);
