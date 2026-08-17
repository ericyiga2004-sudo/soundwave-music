const cleanUrl = (value) =>
  String(value || "")
    .replace(/\\n/g, "")
    .trim()
    .replace(/\/+$/, "");

const mode = String(import.meta.env.VITE_API_MODE || "hosted")
  .trim()
  .toLowerCase();

const hostedUrl = cleanUrl(
  import.meta.env.VITE_HOSTED_BACKEND_URL || import.meta.env.VITE_BACKEND_URL
);
const localUrl = cleanUrl(import.meta.env.VITE_LOCAL_BACKEND_URL);
const selectedUrl = mode === "local" ? localUrl : hostedUrl;

if (!selectedUrl) {
  throw new Error(
    mode === "local"
      ? "Local API mode is enabled but VITE_LOCAL_BACKEND_URL is missing."
      : "Hosted API URL is missing. Set VITE_HOSTED_BACKEND_URL in admin/.env."
  );
}

export const ADMIN_API_BASE_URL = selectedUrl;
export const ADMIN_API_MODE = mode;
