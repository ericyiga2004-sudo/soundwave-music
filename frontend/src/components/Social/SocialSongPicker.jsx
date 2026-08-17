import { useContext, useMemo, useState } from "react";
import { Check, Music2, Pause, Play, Search } from "lucide-react";
import { MusicPlayerContext } from "../../context/MainPlayerContext";
import { getArtistName, getSongCover } from "../../utils/catalog";

const text = (value) => String(value || "").trim().toLowerCase();

const SocialSongPicker = ({
  songs = [],
  value = "",
  onChange,
  label = "Choose a song",
  maxVisible = 12,
  compact = false,
}) => {
  const player = useContext(MusicPlayerContext);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(() => {
    const q = text(query);
    const source = (songs || []).filter((song) => song?._id);
    if (!q) return source;
    return source.filter((song) => {
      const album = typeof song.album === "object" ? song.album?.title : song.album;
      return [song.title, getArtistName(song), album, song.genre, song.language]
        .map(text)
        .some((item) => item.includes(q));
    });
  }, [songs, query]);

  const visible = expanded ? filtered.slice(0, 40) : filtered.slice(0, maxVisible);
  const selected = (songs || []).find((song) => String(song?._id) === String(value));
  const currentId = String(player?.currentSong?._id || "");
  const isPlaying = Boolean(player?.isPlaying);

  const preview = async (event, song) => {
    event.stopPropagation();
    if (!song?._id) return;
    if (currentId === String(song._id) && isPlaying) {
      player?.togglePlayPause?.();
      return;
    }
    try {
      await player?.playSong?.(song, filtered.length ? filtered : [song]);
    } catch {
      // The global player exposes playback errors. Keep the picker usable.
    }
  };

  return (
    <div className={`sw-social-song-picker ${compact ? "compact" : ""}`}>
      <div className="sw-social-picker-toolbar">
        <div>
          <span className="sw-social-kicker">Music selector</span>
          <strong>{label}</strong>
        </div>
        <label className="sw-social-picker-search">
          <Search size={14} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title or artist"
            aria-label="Search songs"
          />
        </label>
      </div>

      {selected ? (
        <div className="sw-social-selected-song">
          <img src={getSongCover(selected)} alt="" loading="lazy" decoding="async" />
          <span>
            <small>Selected</small>
            <strong>{selected.title}</strong>
            <em>{getArtistName(selected)}</em>
          </span>
          <button type="button" onClick={(event) => preview(event, selected)} aria-label={`Preview ${selected.title}`}>
            {currentId === String(selected._id) && isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
          </button>
        </div>
      ) : null}

      <div className="sw-social-picker-grid">
        {visible.map((song) => {
          const active = String(value) === String(song._id);
          const playing = currentId === String(song._id) && isPlaying;
          return (
            <article key={song._id} className={active ? "selected" : ""}>
              <button
                type="button"
                className="sw-social-song-select"
                onClick={() => onChange?.(String(song._id))}
                aria-pressed={active}
              >
                <span className="sw-social-picker-art">
                  <img src={getSongCover(song)} alt="" loading="lazy" decoding="async" />
                  {active ? <i><Check size={13} /></i> : null}
                </span>
                <span className="sw-social-picker-copy">
                  <strong>{song.title}</strong>
                  <small>{getArtistName(song)}</small>
                </span>
              </button>
              <button
                type="button"
                className="sw-social-preview-btn"
                onClick={(event) => preview(event, song)}
                aria-label={`${playing ? "Pause" : "Preview"} ${song.title}`}
                title={playing ? "Pause preview" : "Play preview"}
              >
                {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
              </button>
            </article>
          );
        })}
      </div>

      {!visible.length ? (
        <div className="sw-social-picker-empty"><Music2 size={18} /><span>No matching songs.</span></div>
      ) : null}

      {filtered.length > maxVisible ? (
        <button type="button" className="sw-social-picker-more" onClick={() => setExpanded((open) => !open)}>
          {expanded ? "Show fewer songs" : `Show more songs (${filtered.length})`}
        </button>
      ) : null}
    </div>
  );
};

export default SocialSongPicker;
