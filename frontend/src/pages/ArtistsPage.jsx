import PremiumSelect from "../components/UI/PremiumSelect";
import { useContext, useEffect, useMemo, useState } from "react";
import { Check, Search, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MusicContext } from "../context/ShopContext";
import { apiClient, authHeaders, cachedGet, invalidateApiCache } from "../config/apiClient";
import { formatCompactNumber, optimizeArtworkUrl } from "../utils/catalog";
import CatalogSkeleton from "../components/UI/CatalogSkeleton";
import EmptyState from "../components/UI/EmptyState";
import "./CSS/CatalogPages.tailwind.css";

const PAGE_SIZE = 24;
const hasMongoId = (value) => /^[a-f0-9]{24}$/i.test(String(value || ""));

const artistKey = (artist) => String(artist?._id || artist?.externalId || "");

const mixArtists = (local = [], external = []) => {
  const left = [...local];
  const right = [...external];
  // Shuffle each source independently so Audius artists do not always occupy
  // the same slots while still keeping a healthy local/external balance.
  for (const list of [left, right]) {
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  }
  const mixed = [];
  while (left.length || right.length) {
    if (right.length && Math.random() < 0.58) mixed.push(right.shift());
    if (left.length) mixed.push(left.shift());
    if (right.length && Math.random() < 0.72) mixed.push(right.shift());
  }
  const seen = new Set();
  return mixed.filter((artist) => {
    const key = artistKey(artist);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const ArtistsPage = () => {
  const navigate = useNavigate();
  const { getAuthToken } = useContext(MusicContext);
  const token = getAuthToken?.() || "";
  const [artists, setArtists] = useState([]);
  const [following, setFollowing] = useState(new Set());
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("followers");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [followBusy, setFollowBusy] = useState("");

  const load = async ({ append = false, targetPage = page } = {}) => {
    setLoading(true);
    setError("");
    try {
      const params = { page: targetPage, limit: PAGE_SIZE, search: query.trim(), sort };
      const audiusParams = {
        limit: PAGE_SIZE,
        offset: (targetPage - 1) * PAGE_SIZE,
        q: query.trim(),
        sort: sort === "name" ? "name" : "followers",
      };

      const [localResult, audiusResult] = await Promise.allSettled([
        cachedGet("/api/artists", { params, ttl: 30000 }),
        cachedGet("/api/audius/artists", { params: audiusParams, ttl: 90000 }),
      ]);

      const localData = localResult.status === "fulfilled" ? localResult.value : null;
      const audiusData = audiusResult.status === "fulfilled" ? audiusResult.value : null;
      const localArtists = localData?.success ? (localData.artists || []) : [];
      const externalArtists = audiusData?.success ? (audiusData.artists || []) : [];

      if (!localArtists.length && !externalArtists.length && localResult.status === "rejected" && audiusResult.status === "rejected") {
        throw localResult.reason || audiusResult.reason || new Error("Could not load artists");
      }

      const batch = mixArtists(localArtists, externalArtists);
      setArtists((current) => {
        if (!append) return batch;
        const combined = [...current, ...batch];
        const seen = new Set();
        return combined.filter((artist) => {
          const key = artistKey(artist);
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      });

      const localPages = Number(localData?.pages || 1);
      const externalHasMore = Boolean(audiusData?.hasMore);
      setPage(targetPage);
      setPages(Math.max(localPages, externalHasMore ? targetPage + 1 : targetPage));
      setTotal(Number(localData?.total ?? localData?.count ?? 0) + Number(audiusData?.total || 0));
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Could not load artists");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => load({ targetPage: 1 }), 220);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, sort]);

  useEffect(() => {
    if (!token) { setFollowing(new Set()); return; }
    let active = true;
    cachedGet("/api/artists/following", {
      headers: authHeaders(token), cacheScope: `follow:${token.slice(-8)}`, ttl: 20000,
    }).then((data) => {
      if (!active || !data?.success) return;
      setFollowing(new Set((data.artists || []).map((artist) => String(artist._id))));
    }).catch(() => {});
    return () => { active = false; };
  }, [token]);

  const toggleFollow = async (event, artist) => {
    event.stopPropagation();
    if (!hasMongoId(artist?._id)) { navigate(`/artist/${artist._id}`); return; }
    if (!token) { navigate("/account"); return; }
    if (!artist?._id || followBusy) return;
    setFollowBusy(artist._id);
    try {
      const { data } = await apiClient.post(`/api/artists/follow/${artist._id}`, {}, { headers: authHeaders(token) });
      if (data?.success) {
        setFollowing((current) => {
          const next = new Set(current);
          data.following ? next.add(String(artist._id)) : next.delete(String(artist._id));
          return next;
        });
        setArtists((current) => current.map((item) => item._id === artist._id ? { ...item, followers: data.followers } : item));
        invalidateApiCache("/api/artists");
      }
    } finally { setFollowBusy(""); }
  };

  const hasMore = page < pages;
  const subtitle = useMemo(() => total ? `${formatCompactNumber(total)} artists in SoundWave` : "Artists from across the SoundWave catalog.", [total]);

  return (
    <div className="sw-catalog-page">
      <header className="sw-catalog-hero">
        <div><span className="sw-catalog-eyebrow">Artists</span><h1>All artists.</h1><p>{subtitle}</p></div>
        <span className="sw-catalog-count">{total ? `${total} total` : ""}</span>
      </header>

      <div className="sw-catalog-toolbar">
        <label className="visually-hidden" htmlFor="artist-search">Search artists</label>
        <div className="![position:relative]"><Search size={16} className="![position:absolute] ![left:13px] ![top:14px] ![color:var(--sw-text-tertiary)]" /><input id="artist-search" className="![padding-left:39px]" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search artists" /></div>
        <PremiumSelect value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort artists"><option value="followers">Most followed</option><option value="newest">Newest</option><option value="name">A–Z</option></PremiumSelect>
        <button className="sw-secondary-btn" type="button" onClick={() => { setQuery(""); setSort("followers"); }}>Reset</button>
      </div>

      {loading && !artists.length ? <CatalogSkeleton count={10} round /> : error && !artists.length ? <EmptyState title="Artists could not load" message={error} onRetry={() => load({ targetPage: 1 })} /> : artists.length ? (
        <div className="sw-catalog-grid">
          {artists.map((artist) => {
            const isFollowing = following.has(String(artist._id));
            return <article className="sw-catalog-card artist" key={artist._id}>
              <div className="sw-catalog-card-art"><img src={optimizeArtworkUrl(artist.image || artist.imageUrl || "/fallback-artist.svg", 480)} alt={artist.name || "Artist"} loading="lazy" decoding="async" /><button className="art-open" type="button" onClick={() => navigate(`/artist/${artist._id}`)} aria-label={`Open ${artist.name}`} /></div>
              <div className="sw-catalog-card-copy"><strong>{artist.name}</strong><span>{artist.country || "Artist"}</span><div className="sw-catalog-card-meta"><small>{formatCompactNumber(artist.followers)} followers</small><button type="button" className={`sw-follow-btn ${isFollowing ? "active" : ""}`} disabled={followBusy === artist._id} onClick={(e) => toggleFollow(e, artist)}>{!hasMongoId(artist._id) ? <>View</> : isFollowing ? <><Check size={12} /> Following</> : <><UserPlus size={12} /> Follow</>}</button></div></div>
            </article>;
          })}
        </div>
      ) : <EmptyState title="No artists found" message="Try a different artist name." />}

      {hasMore && <div className="sw-load-more"><button className="sw-secondary-btn" type="button" disabled={loading} onClick={() => load({ append: true, targetPage: page + 1 })}>{loading ? "Loading…" : "Load more artists"}</button></div>}
    </div>
  );
};
export default ArtistsPage;
