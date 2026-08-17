const DEFAULT_BACKEND_URL = "https://soundwave-music.onrender.com";

const cleanBackendUrl = (value) =>
  String(value || "")
    .replace(/\\n/g, "")
    .trim()
    .replace(/\/+$/, "");

export const ADMIN_API_BASE_URL =
  cleanBackendUrl(import.meta.env.VITE_BACKEND_URL) || DEFAULT_BACKEND_URL;
