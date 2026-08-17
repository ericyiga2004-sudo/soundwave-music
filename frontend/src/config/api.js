const DEFAULT_BACKEND_URL = "https://soundwave-music.onrender.com";

const cleanBackendUrl = (value) => {
  return String(value || "")
    .replace(/\\n/g, "")
    .trim()
    .replace(/\/+$/, "");
};

// VITE_BACKEND_URL is optional for the downloadable/local build.
// If it is not bundled with the ZIP, SoundWave safely falls back to the
// production API that the rest of the app already uses.
export const API_BASE_URL =
  cleanBackendUrl(import.meta.env.VITE_BACKEND_URL) || DEFAULT_BACKEND_URL;

export const apiUrl = (path = "") => {
  const normalizedPath = String(path || "").startsWith("/")
    ? String(path || "")
    : `/${String(path || "")}`;

  return `${API_BASE_URL}${normalizedPath}`;
};
