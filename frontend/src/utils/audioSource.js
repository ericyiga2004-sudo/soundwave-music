import { API_BASE_URL } from "../config/api";

const cleanAudioValue = (value) =>
  String(value || "")
    .replace(/\\n/g, "")
    .replace(/\r?\n/g, "")
    .trim();

export const getSongAudioUrl = (song) => {
  const raw =
    song?.audioUrl ||
    song?.audioURL ||
    song?.streamUrl ||
    song?.audio?.url ||
    "";

  const value = cleanAudioValue(raw);
  if (!value) return "";

  if (/^(blob:|data:|https?:\/\/)/i.test(value)) return value;
  if (value.startsWith("//")) return `https:${value}`;

  try {
    return new URL(value, `${API_BASE_URL}/`).toString();
  } catch {
    return value;
  }
};

export default getSongAudioUrl;
