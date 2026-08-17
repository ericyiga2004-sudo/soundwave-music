const cleanUrl = (value) =>
  String(value || "")
    .replace(/\\n/g, "")
    .trim()
    .replace(/\/+$/, "");

const mode = String(import.meta.env.VITE_API_MODE || "hosted")
  .trim()
  .toLowerCase();

// The normal SoundWave app always uses the hosted Render API. A local API is
// opt-in, so an old/stale VITE_BACKEND_URL=http://localhost:4000 override can
// no longer silently break the catalog.
const hostedUrl = cleanUrl(
  import.meta.env.VITE_HOSTED_BACKEND_URL || import.meta.env.VITE_BACKEND_URL
);
const localUrl = cleanUrl(import.meta.env.VITE_LOCAL_BACKEND_URL);

const selectedUrl = mode === "local" ? localUrl : hostedUrl;

if (!selectedUrl) {
  throw new Error(
    mode === "local"
      ? "Local API mode is enabled but VITE_LOCAL_BACKEND_URL is missing."
      : "Hosted API URL is missing. Set VITE_HOSTED_BACKEND_URL in frontend/.env."
  );
}

export const API_BASE_URL = selectedUrl;
export const API_MODE = mode;

export const apiUrl = (path = "") => {
  const value = String(path || "");
  const normalizedPath = value.startsWith("/") ? value : `/${value}`;
  return `${API_BASE_URL}${normalizedPath}`;
};
