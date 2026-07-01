const fs = require("fs");
const path = require("path");

const cssPath = path.join(__dirname, "SongDetails.css");

let css = fs.readFileSync(cssPath, "utf8");

const renameMap = {
  "actions": "song-details-actions",
  "active": "is-active",
  "active-lyric-preview": "song-details-active-lyric-preview",
  "active-lyric-preview-label": "song-details-active-lyric-preview-label",
  "album": "song-details-album",
  "album-card": "song-details-album-card",
  "artist": "song-details-artist",
  "artist-card": "song-details-artist-card",
  "badge": "song-details-badge",
  "bass-warm": "is-bass-warm",
  "card": "song-details-card",
  "card-label": "song-details-card-label",
  "completed": "is-completed",
  "cover-equalizer": "song-details-cover-equalizer",
  "cover-wrap": "song-details-cover-wrap",
  "create-playlist-inline": "song-details-create-playlist-inline",
  "effects-btn": "song-details-effects-button",
  "effects-close-btn": "song-details-effects-close-button",
  "effects-controls": "song-details-effects-controls",
  "effects-kicker": "song-details-effects-kicker",
  "effects-modal": "song-details-effects-modal",
  "effects-modal-backdrop": "song-details-effects-backdrop",
  "effects-modal-header": "song-details-effects-header",
  "effects-modal-open": "song-details-modal-open",
  "effects-presets": "song-details-effects-presets",
  "empty-related": "song-details-empty-related",
  "focus-equalizer": "song-details-focus-equalizer",
  "icon-control": "song-details-icon-control",
  "info-grid": "song-details-info-grid",
  "kick-react": "is-kick-react",
  "like-btn": "song-details-like-button",
  "loader-orb": "song-details-loader-orb",
  "lyrics": "song-details-lyrics-section",
  "lyrics-btn": "song-details-lyrics-button",
  "lyrics-current-glow": "song-details-lyrics-current-glow",
  "lyrics-modal-backdrop": "song-details-lyrics-backdrop",
  "lyrics-modal-bg": "song-details-lyrics-bg",
  "lyrics-modal-card": "song-details-lyrics-card",
  "lyrics-modal-close": "song-details-lyrics-close-button",
  "lyrics-modal-header": "song-details-lyrics-header",
  "lyrics-modal-plain": "song-details-lyrics-plain",
  "lyrics-modal-scroll": "song-details-lyrics-scroll",
  "mini-equalizer": "song-details-mini-equalizer",
  "modal-line": "song-details-modal-line",
  "muted-text": "song-details-muted-text",
  "now-playing-label": "song-details-now-playing-label",
  "party-active-line": "song-details-party-active-line",
  "party-beam": "song-details-party-beam",
  "party-beam-one": "song-details-party-beam-one",
  "party-beam-three": "song-details-party-beam-three",
  "party-beam-two": "song-details-party-beam-two",
  "party-current-glow": "song-details-party-current-glow",
  "party-light": "song-details-party-light",
  "party-light-one": "song-details-party-light-one",
  "party-light-three": "song-details-party-light-three",
  "party-light-two": "song-details-party-light-two",
  "party-lyrics-backdrop": "song-details-party-lyrics-backdrop",
  "party-lyrics-bg": "song-details-party-lyrics-bg",
  "party-lyrics-card": "song-details-party-lyrics-card",
  "party-lyrics-scroll": "song-details-party-lyrics-scroll",
  "party-plain-lyrics": "song-details-party-plain-lyrics",
  "party-sparkles": "song-details-party-sparkles",
  "paused": "is-paused",
  "play-btner": "song-details-play-button",
  "player-controls": "song-details-player-controls",
  "playing": "is-playing",
  "playing-now": "is-playing-now",
  "playlist-message": "song-details-playlist-message",
  "playlist-select-row": "song-details-playlist-select-row",
  "playlist-toggle-btn": "song-details-playlist-toggle-button",
  "pulse": "has-pulse",
  "related-album": "song-details-related-album",
  "related-copy": "song-details-related-copy",
  "related-duration": "song-details-related-duration",
  "related-list": "song-details-related-list",
  "related-section": "song-details-related-section",
  "related-song": "song-details-related-song",
  "repeat-badge": "song-details-repeat-badge",
  "repeat-control": "song-details-repeat-control",
  "section-heading": "song-details-section-heading",
  "seek-bar": "song-details-seek-bar",
  "song-cover": "song-details-cover",
  "song-glass-panel": "song-details-panel",
  "song-hero": "song-details-hero",
  "song-hero-bg": "song-details-hero-bg",
  "song-hero-overlay": "song-details-hero-overlay",
  "song-loading": "song-details-loading",
  "song-meta": "song-details-meta",
  "song-modal-open": "song-details-modal-open",
  "song-page": "song-details-page",
  "song-playlist-box": "song-details-playlist-box",
  "stats": "song-details-stats",
  "synced-lyric-line": "song-details-synced-lyric-line",
  "synced-lyric-word": "song-details-synced-lyric-word",
  "synced-lyrics": "song-details-synced-lyrics",
  "time": "song-details-time",
  "top-controls": "song-details-top-controls",
  "track-number": "song-details-track-number",
  "view-album-btn": "song-details-view-album-button",
  "view-more-btn": "song-details-view-more-button"
};

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const sortedEntries = Object.entries(renameMap).sort(
  ([a], [b]) => b.length - a.length
);

for (const [oldClass, newClass] of sortedEntries) {
  const selectorRegex = new RegExp(
    "\\." + escapeRegex(oldClass) + "(?![\\w-])",
    "g"
  );

  css = css.re
  
  place(selectorRegex, "." + newClass);
}

fs.writeFileSync(cssPath, css, "utf8");

console.log("SongDetails.css class names updated successfully.");