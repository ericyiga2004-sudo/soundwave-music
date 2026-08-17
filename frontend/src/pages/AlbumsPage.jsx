import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cachedGet } from "../config/apiClient";
import { getAlbumCover, getArtistName } from "../utils/catalog";
import CatalogSkeleton from "../components/UI/CatalogSkeleton";
import EmptyState from "../components/UI/EmptyState";
import "./CSS/CatalogPages.css";

const PAGE_SIZE = 24;
const AlbumsPage = () => {
  const navigate = useNavigate();
  const [albums, setAlbums] = useState([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async ({ append = false, targetPage = 1 } = {}) => {
    setLoading(true); setError("");
    try {
      const data = await cachedGet("/api/albums", { params: { page: targetPage, limit: PAGE_SIZE, search: query.trim(), sort }, ttl: 30000 });
      if (!data?.success) throw new Error(data?.message || "Could not load albums");
      setAlbums((current) => append ? [...current, ...(data.albums || [])] : (data.albums || []));
      setPage(Number(data.page || targetPage)); setPages(Number(data.pages || 1)); setTotal(Number(data.total ?? data.count ?? 0));
    } catch (err) { setError(err?.response?.data?.message || err.message || "Could not load albums"); }
    finally { setLoading(false); }
  };

  useEffect(() => { const timer = window.setTimeout(() => load({ targetPage: 1 }), 220); return () => clearTimeout(timer); }, [query, sort]);

  return <div className="sw-catalog-page">
    <header className="sw-catalog-hero"><div><span className="sw-catalog-eyebrow">Albums</span><h1>Albums worth keeping close.</h1><p>Browse complete releases without loading the entire catalog at once.</p></div><span className="sw-catalog-count">{total ? `${total} albums` : ""}</span></header>
    <div className="sw-catalog-toolbar"><div style={{position:"relative"}}><Search size={16} style={{position:"absolute",left:13,top:14,color:"var(--sw-text-tertiary)"}}/><input style={{paddingLeft:39}} value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search albums" /></div><select value={sort} onChange={(e)=>setSort(e.target.value)}><option value="newest">Newest</option><option value="popular">Most played</option><option value="name">A–Z</option></select><button className="sw-secondary-btn" type="button" onClick={()=>{setQuery("");setSort("newest")}}>Reset</button></div>
    {loading && !albums.length ? <CatalogSkeleton count={10}/> : error && !albums.length ? <EmptyState title="Albums could not load" message={error} onRetry={()=>load({targetPage:1})}/> : albums.length ? <div className="sw-catalog-grid">{albums.map((album)=><article className="sw-catalog-card" key={album._id}><div className="sw-catalog-card-art"><img src={getAlbumCover(album)} alt={album.title||"Album"} loading="lazy" decoding="async"/><button className="art-open" type="button" onClick={()=>navigate(`/album/${album._id}`,{state:{album}})} aria-label={`Open ${album.title}`}/></div><div className="sw-catalog-card-copy"><strong>{album.title}</strong><span>{getArtistName(album)}</span><div className="sw-catalog-card-meta"><small>{album.songs?.length || 0} songs</small><small>{album.releaseDate ? new Date(album.releaseDate).getFullYear() : ""}</small></div></div></article>)}</div> : <EmptyState title="No albums found" message="Try another album title."/>}
    {page < pages && <div className="sw-load-more"><button className="sw-secondary-btn" type="button" disabled={loading} onClick={()=>load({append:true,targetPage:page+1})}>{loading?"Loading…":"Load more albums"}</button></div>}
  </div>;
};
export default AlbumsPage;
