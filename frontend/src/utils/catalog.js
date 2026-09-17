const lowDataActive = () => {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem("soundwave_low_data");
  if (stored === "true") return true;
  if (stored === "false") return false;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return Boolean(connection?.saveData || ["slow-2g", "2g"].includes(connection?.effectiveType));
};

export const optimizeArtworkUrl = (url = "", preferredWidth = 640) => {
  const source = String(url || "").trim();
  if (!source) return "/fallback-cover.svg";
  if (!source.includes("res.cloudinary.com") || !source.includes("/image/upload/")) return source;
  if (/\/image\/upload\/[a-z_]+,[^/]+\//i.test(source)) return source;

  const width = lowDataActive() ? Math.min(320, preferredWidth) : preferredWidth;
  const quality = lowDataActive() ? "q_auto:eco" : "q_auto:good";
  return source.replace("/image/upload/", `/image/upload/f_auto,${quality},w_${width},c_limit/`);
};

export const getArtistName = (songOrAlbum) =>
  songOrAlbum?.artist?.name ||
  songOrAlbum?.artistName ||
  (typeof songOrAlbum?.artist === "string" ? songOrAlbum.artist : "") ||
  "Unknown Artist";

export const getSongCover = (song) =>
  optimizeArtworkUrl(
    song?.imageUrl || song?.image || song?.coverImage || song?.album?.coverImage || "/fallback-cover.svg",
    640
  );

export const getAlbumCover = (album) =>
  optimizeArtworkUrl(album?.coverImage || album?.imageUrl || album?.image || "/fallback-cover.svg", 640);

export const formatCompactNumber = (value = 0) => {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "0";
  return new Intl.NumberFormat(undefined, {
    notation: number >= 1000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(number);
};

export const formatDuration = (seconds = 0) => {
  const value = Number(seconds || 0);
  if (!Number.isFinite(value) || value <= 0) return "0:00";
  const normalized = value > 10000 ? value / 1000 : value;
  const mins = Math.floor(normalized / 60);
  const secs = Math.floor(normalized % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
};
