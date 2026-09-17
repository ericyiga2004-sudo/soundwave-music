import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Check, Heart, History, Music2, Search, Sparkles, ThumbsUp, X } from "lucide-react";
import { cachedGet, authHeaders } from "../../config/apiClient";
import { getArtistName, getSongCover } from "../../utils/catalog";

const idOf = (song) => String(song?._id || song?.id || "");
const text = (value) => String(value || "").trim().toLowerCase();

const normalizeHistory = (items = []) =>
  (items || [])
    .map((item) => (item?.song ? { ...item.song, playedAt: item.playedAt } : item))
    .filter((song) => idOf(song));

const uniqueSongs = (groups = []) => {
  const seen = new Set();
  const output = [];
  groups.flat().forEach((song) => {
    const id = idOf(song);
    if (!id || seen.has(id)) return;
    seen.add(id);
    output.push(song);
  });
  return output;
};

const RoomSongVoteModal = ({
  open,
  onClose,
  songs = [],
  authToken = "",
  viewerId = "",
  excludedIds = [],
  onSubmit,
  busy = false,
}) => {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [selectedIds, setSelectedIds] = useState([]);
  const [forYou, setForYou] = useState([]);
  const [recent, setRecent] = useState([]);
  const [liked, setLiked] = useState([]);
  const [learning, setLearning] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    setQuery("");
    setSelectedIds([]);
    setLoadError("");

    if (!authToken) return undefined;

    let cancelled = false;
    const headers = authHeaders(authToken);
    const scope = `room-song-picker:${viewerId || "viewer"}`;

    setLearning(true);
    Promise.allSettled([
      cachedGet("/api/recommend/for-you", {
        params: { limit: 48 }, headers, ttl: 90000, cacheScope: scope,
      }),
      cachedGet("/api/history/get", {
        headers, ttl: 30000, cacheScope: scope,
      }),
      cachedGet("/api/likes/songs", {
        headers, ttl: 45000, cacheScope: scope,
      }),
    ]).then(([personalizedResult, historyResult, likedResult]) => {
      if (cancelled) return;
      setForYou(personalizedResult.status === "fulfilled" ? personalizedResult.value?.songs || [] : []);
      setRecent(historyResult.status === "fulfilled" ? normalizeHistory(historyResult.value?.history || []) : []);
      setLiked(likedResult.status === "fulfilled" ? likedResult.value?.likedSongs || [] : []);
      if ([personalizedResult, historyResult, likedResult].every((result) => result.status === "rejected")) {
        setLoadError("Using the catalog while your taste profile reconnects.");
      }
    }).finally(() => {
      if (!cancelled) setLearning(false);
    });

    return () => { cancelled = true; };
  }, [authToken, open, viewerId]);

  const excluded = useMemo(() => new Set((excludedIds || []).map(String)), [excludedIds]);
  const likedIds = useMemo(() => new Set(liked.map(idOf)), [liked]);
  const recentRank = useMemo(() => new Map(recent.map((song, index) => [idOf(song), index])), [recent]);
  const forYouRank = useMemo(() => new Map(forYou.map((song, index) => [idOf(song), index])), [forYou]);

  const ranked = useMemo(() => {
    const catalogById = new Map((songs || []).filter((song) => idOf(song)).map((song) => [idOf(song), song]));
    const source = uniqueSongs([forYou, recent, liked, songs]).map((song) => ({ ...catalogById.get(idOf(song)), ...song }));

    return source
      .filter((song) => !excluded.has(idOf(song)))
      .map((song) => {
        const id = idOf(song);
        const personalizedIndex = forYouRank.get(id);
        const recentIndex = recentRank.get(id);
        const isLiked = likedIds.has(id);
        const likes = Math.max(0, Number(song.likes || 0));
        const plays = Math.max(0, Number(song.plays || song.playCount || 0));
        const learnedScore = Number(song.recommendationScore || 0);

        let score = learnedScore * 90 + Math.log1p(likes) * 13 + Math.log1p(plays) * 6;
        if (personalizedIndex !== undefined) score += Math.max(50, 420 - personalizedIndex * 6);
        if (recentIndex !== undefined) score += Math.max(40, 300 - recentIndex * 8);
        if (isLiked) score += 250;

        let reason = "Popular for you";
        let reasonType = "popular";
        if (recentIndex !== undefined && recentIndex < 12) {
          reason = recentIndex < 4 ? "Recently listened" : "From your recent plays";
          reasonType = "recent";
        } else if (isLiked) {
          reason = "Liked by you";
          reasonType = "liked";
        } else if (personalizedIndex !== undefined) {
          reason = "Picked from your taste";
          reasonType = "for-you";
        }

        return { song, score, reason, reasonType };
      })
      .sort((a, b) => b.score - a.score || Number(b.song?.likes || 0) - Number(a.song?.likes || 0))
      .slice(0, 64);
  }, [excluded, forYou, forYouRank, liked, likedIds, recent, recentRank, songs]);

  const filtered = useMemo(() => {
    const q = text(deferredQuery);
    if (!q) return ranked;
    return ranked.filter(({ song }) => {
      const album = typeof song?.album === "object" ? song.album?.title : song?.album;
      return [song?.title, getArtistName(song), album, song?.genre]
        .map(text)
        .some((value) => value.includes(q));
    });
  }, [deferredQuery, ranked]);

  const toggle = (songId) => {
    const id = String(songId || "");
    if (!id || busy) return;
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 5) return current;
      return [...current, id];
    });
  };

  const submit = async () => {
    if (busy || selectedIds.length < 2 || selectedIds.length > 5) return;
    await onSubmit?.(selectedIds);
  };

  if (!open) return null;

  return (
    <div className="sw2319-song-modal-shell" role="dialog" aria-modal="true" aria-label="Choose songs for room voting">
      <button type="button" className="sw2319-song-modal-backdrop" onClick={onClose} aria-label="Close song selector" />
      <section className="sw2319-song-modal">
        <header className="sw2319-song-modal-head">
          <div>
            <span className="sw-social-kicker">Smart room picks</span>
            <h2>Choose 2–5 songs</h2>
            <p>Ordered from your learned taste, recent listening and likes.</p>
          </div>
          <button type="button" className="sw2319-icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>

        <div className="sw2319-song-modal-tools sw-container-fluid w-full mx-auto px-3 !p-[0px]">
          <div className="row flex flex-wrap [--sw-gutter-x:1.5rem] [--sw-gutter-y:0px] -mx-[calc(var(--sw-gutter-x)/2)] -mt-[var(--sw-gutter-y)] [&>*]:px-[calc(var(--sw-gutter-x)/2)] [&>*]:mt-[var(--sw-gutter-y)] [&>*]:shrink-0 [&>*]:w-full [&>*]:max-w-full [--sw-gutter-x:0.5rem] [--sw-gutter-y:0.5rem] !items-center">
            <div className="col !w-[100%] flex-none col md:flex-[1_0_0%]">
              <label className="sw2319-song-search">
                <Search size={15} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search songs or artists" autoFocus />
              </label>
            </div>
            <div className="col !w-[100%] flex-none col md:!w-auto md:flex-none">
              <div className="sw2319-selection-count"><strong>{selectedIds.length}</strong><span>/ 5 selected</span></div>
            </div>
          </div>
        </div>

        <div className="sw2319-song-results sw-container-fluid w-full mx-auto px-3 !p-[0px]">
          <div className="row flex flex-wrap [--sw-gutter-x:1.5rem] [--sw-gutter-y:0px] -mx-[calc(var(--sw-gutter-x)/2)] -mt-[var(--sw-gutter-y)] [&>*]:px-[calc(var(--sw-gutter-x)/2)] [&>*]:mt-[var(--sw-gutter-y)] [&>*]:shrink-0 [&>*]:w-full [&>*]:max-w-full [--sw-gutter-x:0.5rem] [--sw-gutter-y:0.5rem]">
            {filtered.slice(0, 48).map(({ song, reason, reasonType }) => {
              const songId = idOf(song);
              const selected = selectedIds.includes(songId);
              return (
                <div className="col !w-[100%] flex-none col sm:!w-[50%] sm:flex-none" key={songId}>
                  <button
                    type="button"
                    className={`sw2319-song-option ${selected ? "is-selected" : ""}`}
                    onClick={() => toggle(songId)}
                    aria-pressed={selected}
                  >
                    <span className="sw2319-song-art">
                      <img src={getSongCover(song)} alt="" loading="lazy" decoding="async" />
                      <i>{selected ? <Check size={14} /> : null}</i>
                    </span>
                    <span className="sw2319-song-copy">
                      <strong>{song.title}</strong>
                      <small>{getArtistName(song)}</small>
                      <em className={`is-${reasonType}`}>
                        {reasonType === "recent" ? <History size={11} /> : reasonType === "liked" ? <Heart size={11} fill="currentColor" /> : reasonType === "for-you" ? <Sparkles size={11} /> : <ThumbsUp size={11} />}
                        {reason}
                      </em>
                    </span>
                  </button>
                </div>
              );
            })}
          </div>

          {!filtered.length ? <div className="sw2319-song-empty"><Music2 size={20} /><span>No matching songs.</span></div> : null}
        </div>

        <footer className="sw2319-song-modal-footer">
          <span>{learning ? "Learning your best room picks…" : loadError || (selectedIds.length < 2 ? "Select at least 2 songs." : "Ready to place these songs up for vote.")}</span>
          <div>
            <button type="button" className="sw2319-secondary-btn" onClick={onClose}>Cancel</button>
            <button type="button" className="sw-primary-btn" onClick={submit} disabled={busy || selectedIds.length < 2 || selectedIds.length > 5}>
              <ThumbsUp size={15} /> {busy ? "Adding…" : `Add ${selectedIds.length || ""} to vote`}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
};

export default RoomSongVoteModal;
