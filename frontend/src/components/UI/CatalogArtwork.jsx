import { useEffect, useMemo, useState } from "react";
import { FaCompactDisc, FaMusic, FaUser } from "react-icons/fa6";
import "./CatalogArtwork.tailwind.css";

const FALLBACK_ASSETS = new Set(["/fallback-cover.svg", "/fallback-artist.svg"]);

const hasUsableSource = (value) => {
  const source = String(value || "").trim();
  return Boolean(source) && !FALLBACK_ASSETS.has(source);
};

const iconFor = (kind) => {
  if (kind === "artist" || kind === "person") return FaUser;
  if (kind === "album") return FaCompactDisc;
  return FaMusic;
};

const CatalogArtwork = ({
  src,
  kind = "song",
  alt = "",
  className = "",
  fallbackClassName = "",
  onError,
  ...imageProps
}) => {
  const normalizedSource = useMemo(() => String(src || "").trim(), [src]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [normalizedSource]);

  if (!hasUsableSource(normalizedSource) || failed) {
    const Icon = iconFor(kind);
    return (
      <span
        className={`${className} ${fallbackClassName} sw-artwork-fallback sw-artwork-fallback-${kind}`.trim()}
        role="img"
        aria-label={alt || (kind === "artist" ? "Artist without artwork" : "Music without artwork")}
      >
        <Icon aria-hidden="true" />
      </span>
    );
  }

  return (
    <img
      {...imageProps}
      src={normalizedSource}
      alt={alt}
      className={className}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
    />
  );
};

export const SongArtwork = (props) => <CatalogArtwork {...props} kind="song" />;
export const ArtistArtwork = (props) => <CatalogArtwork {...props} kind="artist" />;
export const AlbumArtwork = (props) => <CatalogArtwork {...props} kind="album" />;

export const MissingArtistName = ({ name, className = "" }) => {
  const value = String(name || "").trim();
  if (value && value.toLowerCase() !== "unknown artist") return value;
  return (
    <span className={`${className} sw-missing-artist-label`.trim()}>
      <FaUser aria-hidden="true" />
      <span>Unknown Artist</span>
    </span>
  );
};

export default CatalogArtwork;
