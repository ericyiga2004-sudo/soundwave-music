const cleanUrl = (value) =>
  String(value || "")
    .replace(/\\n/g, "")
    .trim()
    .replace(/\/+$/, "");

const FALLBACK_HOSTED_URL = "https://soundwave-music.onrender.com";

const requestedMode = String(import.meta.env.VITE_API_MODE || "hosted")
  .trim()
  .toLowerCase();

const hostedUrl =
  cleanUrl(import.meta.env.VITE_HOSTED_BACKEND_URL || import.meta.env.VITE_BACKEND_URL) ||
  FALLBACK_HOSTED_URL;
const localUrl = cleanUrl(import.meta.env.VITE_LOCAL_BACKEND_URL);

// Local API use now requires TWO explicit switches. This prevents an old
// .env.local from silently sending the whole app to a dead local API.
const allowLocalApi =
  String(import.meta.env.VITE_ALLOW_LOCAL_API || "false").trim().toLowerCase() === "true";
const useLocalApi = requestedMode === "local" && allowLocalApi && Boolean(localUrl);

export const API_HOSTED_URL = hostedUrl;
export const API_LOCAL_URL = localUrl;
export const API_BASE_URL = useLocalApi ? localUrl : hostedUrl;
export const API_MODE = useLocalApi ? "local" : "hosted";

export const apiUrl = (path = "") => {
  const value = String(path || "");
  const normalizedPath = value.startsWith("/") ? value : `/${value}`;
  return `${API_BASE_URL}${normalizedPath}`;
};
