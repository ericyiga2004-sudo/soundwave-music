const cleanUrl = (value) =>
  String(value || "")
    .replace(/\\n/g, "")
    .trim()
    .replace(/\/+$/, "");

const FALLBACK_HOSTED_URL = "https://soundwave-music.onrender.com";
const requestedMode = String(import.meta.env.VITE_API_MODE || "hosted").trim().toLowerCase();
const hostedUrl =
  cleanUrl(import.meta.env.VITE_HOSTED_BACKEND_URL || import.meta.env.VITE_BACKEND_URL) ||
  FALLBACK_HOSTED_URL;
const localUrl = cleanUrl(import.meta.env.VITE_LOCAL_BACKEND_URL);
const allowLocalApi =
  String(import.meta.env.VITE_ALLOW_LOCAL_API || "false").trim().toLowerCase() === "true";
const useLocalApi = requestedMode === "local" && allowLocalApi && Boolean(localUrl);

export const ADMIN_API_BASE_URL = useLocalApi ? localUrl : hostedUrl;
export const ADMIN_API_MODE = useLocalApi ? "local" : "hosted";
