import { useContext, useEffect, useMemo, useState } from "react";
import { Check, Search, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MusicContext } from "../context/ShopContext";
import { apiClient, authHeaders, cachedGet, invalidateApiCache } from "../config/apiClient";
import { formatCompactNumber, optimizeArtworkUrl } from "../utils/catalog";
import CatalogSkeleton from "../components/UI/CatalogSkeleton";
import EmptyState from "../components/UI/EmptyState";
import "./CSS/CatalogPages.css";

const PAGE_SIZE = 24;

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
      const data = await cachedGet("/api/artists", {
        params: { page: targetPage, limit: PAGE_SIZE, search: query.trim(), sort },
        ttl: 30000,
      });
      if (!data?.success) throw new Error(data?.message || "Could not load artists");
      setArtists((current) => append ? [...current, ...(data.artists || [])] : (data.artists || []));
      setPage(Number(data.page || targetPage));
      setPages(Number(data.pages || 1));
      setTotal(Number(data.total ?? data.count ?? 0));
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
        <div style={{ position: "relative" }}><Search size={16} style={{ position: "absolute", left: 13, top: 14, color: "var(--sw-text-tertiary)" }} /><input id="artist-search" style={{ paddingLeft: 39 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search artists" /></div>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort artists"><option value="followers">Most followed</option><option value="newest">Newest</option><option value="name">A–Z</option></select>
        <button className="sw-secondary-btn" type="button" onClick={() => { setQuery(""); setSort("followers"); }}>Reset</button>
      </div>

      {loading && !artists.length ? <CatalogSkeleton count={10} round /> : error && !artists.length ? <EmptyState title="Artists could not load" message={error} onRetry={() => load({ targetPage: 1 })} /> : artists.length ? (
        <div className="sw-catalog-grid">
          {artists.map((artist) => {
            const isFollowing = following.has(String(artist._id));
            return <article className="sw-catalog-card artist" key={artist._id}>
              <div className="sw-catalog-card-art"><img src={optimizeArtworkUrl(artist.image || "/fallback-cover.svg", 480)} alt={artist.name || "Artist"} loading="lazy" decoding="async" /><button className="art-open" type="button" onClick={() => navigate(`/artist/${artist._id}`)} aria-label={`Open ${artist.name}`} /></div>
              <div className="sw-catalog-card-copy"><strong>{artist.name}</strong><span>{artist.country || "Artist"}</span><div className="sw-catalog-card-meta"><small>{formatCompactNumber(artist.followers)} followers</small><button type="button" className={`sw-follow-btn ${isFollowing ? "active" : ""}`} disabled={followBusy === artist._id} onClick={(e) => toggleFollow(e, artist)}>{isFollowing ? <><Check size={12} /> Following</> : <><UserPlus size={12} /> Follow</>}</button></div></div>
            </article>;
          })}
        </div>
      ) : <EmptyState title="No artists found" message="Try a different artist name." />}

      {hasMore && <div className="sw-load-more"><button className="sw-secondary-btn" type="button" disabled={loading} onClick={() => load({ append: true, targetPage: page + 1 })}>{loading ? "Loading…" : "Load more artists"}</button></div>}
    </div>
  );
};
export default ArtistsPage;
