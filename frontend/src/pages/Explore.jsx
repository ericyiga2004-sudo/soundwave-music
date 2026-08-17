import { useContext, useEffect, useMemo, useState } from "react";
import { ChevronRight, Play, Search, SlidersHorizontal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MusicContext } from "../context/ShopContext";
import { MusicPlayerContext } from "../context/MainPlayerContext";
import { authHeaders, cachedGet } from "../config/apiClient";
import { getArtistName, getSongCover } from "../utils/catalog";
import CatalogSkeleton from "../components/UI/CatalogSkeleton";
import EmptyState from "../components/UI/EmptyState";
import "./CSS/Explore.css";

const Explore = () => {
  const navigate = useNavigate();
  const { getAuthToken } = useContext(MusicContext);
  const { playSong } = useContext(MusicPlayerContext);
  const token = getAuthToken?.() || "";

  const [songs, setSongs] = useState([]);
  const [filters, setFilters] = useState({ genres: [], countries: [], moods: [] });
  const [country, setCountry] = useState("All");
  const [genre, setGenre] = useState("All");
  const [mood, setMood] = useState("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("popular");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    cachedGet("/api/songs/filter-options", { ttl: 120000 })
      .then((data) => { if (active && data?.success) setFilters(data.filters || {}); })
      .catch(() => {});

    if (token) {
      cachedGet("/api/recommend/preferences", {
        headers: authHeaders(token),
        cacheScope: `prefs:${token.slice(-8)}`,
        ttl: 60000,
      }).then((data) => {
        if (!active || !data?.success) return;
        const preferred = data?.preferences?.countries?.[0]?.name;
        if (preferred) setCountry((current) => current === "All" ? preferred : current);
      }).catch(() => {});
    }
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const data = await cachedGet("/api/songs/filter", {
          params: {
            limit: 42,
            sort,
            search: search.trim(),
            country: country === "All" ? "" : country,
            genre: genre === "All" ? "" : genre,
            mood: mood === "All" ? "" : mood,
          },
          ttl: 22000,
          signal: controller.signal,
        });
        if (!data?.success) throw new Error(data?.message || "Could not load music");
        setSongs(data.songs || []);
      } catch (err) {
        if (err?.name !== "CanceledError" && err?.name !== "AbortError") {
          setError(err?.response?.data?.message || err.message || "Could not load music");
        }
      } finally { setLoading(false); }
    }, 220);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [country, genre, mood, search, sort]);

  const featured = songs[0] || null;
  const topTen = songs.slice(0, 10);
  const moodGroups = useMemo(() => {
    const map = new Map();
    songs.forEach((song) => {
      const key = song.mood && song.mood !== "Unknown" ? song.mood : "More to explore";
      if (!map.has(key)) map.set(key, []);
      if (map.get(key).length < 6) map.get(key).push(song);
    });
    return [...map.entries()].slice(0, 4).map(([name, items]) => ({ name, items }));
  }, [songs]);

  const reset = () => { setCountry("All"); setGenre("All"); setMood("All"); setSearch(""); setSort("popular"); };
  const openSong = (song, queue = songs) => navigate(`/song/${song._id}`, { state: { song, playlist: queue } });

  return (
    <div className="explore-page-v7 container-fluid">
      <section className="explore-v7-head row g-4 align-items-end">
        <div className="col-12 col-xl-7">
          <span className="explore-v7-kicker">Explore SoundWave</span>
          <h1>Find something that feels right.</h1>
          <p>Browse by country, genre, mood, or search. SoundWave loads only a compact page of results to keep phones fast.</p>
        </div>
        {featured ? (
          <div className="col-12 col-xl-5">
            <article className="explore-feature-card">
              <img src={getSongCover(featured)} alt="" />
              <div><small>Featured now</small><strong>{featured.title}</strong><span>{getArtistName(featured)}</span></div>
              <button type="button" onClick={() => playSong?.(featured, songs)} aria-label={`Play ${featured.title}`}><Play size={17} fill="currentColor" /></button>
            </article>
          </div>
        ) : null}
      </section>

      <section className="explore-filter-shell" aria-label="Explore filters">
        <div className="explore-filter-title"><SlidersHorizontal size={16}/><span>Filter music</span><button type="button" onClick={reset}>Reset</button></div>
        <div className="row g-2">
          <div className="col-12 col-md-5 col-xl-4"><div className="explore-search-wrap"><Search size={16}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Songs, artists, moods…" aria-label="Search music"/></div></div>
          <div className="col-6 col-md"><select value={country} onChange={(e)=>setCountry(e.target.value)} aria-label="Country"><option>All</option>{(filters.countries||[]).map((item)=><option key={item}>{item}</option>)}</select></div>
          <div className="col-6 col-md"><select value={genre} onChange={(e)=>setGenre(e.target.value)} aria-label="Genre"><option>All</option>{(filters.genres||[]).map((item)=><option key={item}>{item}</option>)}</select></div>
          <div className="col-6 col-md"><select value={mood} onChange={(e)=>setMood(e.target.value)} aria-label="Mood"><option>All</option>{(filters.moods||[]).map((item)=><option key={item}>{item}</option>)}</select></div>
          <div className="col-6 col-md"><select value={sort} onChange={(e)=>setSort(e.target.value)} aria-label="Sort"><option value="popular">Popular</option><option value="newest">Newest</option><option value="liked">Most liked</option><option value="az">A–Z</option></select></div>
        </div>
      </section>

      {loading && !songs.length ? <section className="explore-results"><CatalogSkeleton count={10} rows/></section> : error && !songs.length ? <section className="explore-results"><EmptyState title="Explore could not load" message={error}/></section> : songs.length ? <>
        <section className="explore-results">
          <div className="explore-section-heading"><div><span className="explore-v7-kicker">Top picks</span><h2>{country === "All" ? "Popular right now" : `Top in ${country}`}</h2></div><button type="button" onClick={()=>navigate("/songs")}>View all <ChevronRight size={15}/></button></div>
          <div className="explore-top-list">{topTen.map((song,index)=><article key={song._id} className="explore-top-row"><span className="explore-rank">{String(index+1).padStart(2,"0")}</span><img src={getSongCover(song)} alt="" loading="lazy" decoding="async"/><button type="button" className="explore-title-btn" onClick={()=>openSong(song,topTen)}><strong>{song.title}</strong><small>{getArtistName(song)}</small></button><span className="explore-row-meta d-none d-md-block">{song.genre||"Music"}</span><button type="button" className="explore-play-btn" onClick={()=>playSong?.(song,topTen)} aria-label={`Play ${song.title}`}><Play size={15} fill="currentColor"/></button></article>)}</div>
        </section>
        {moodGroups.map((group)=><section className="explore-mood-v7" key={group.name}><div className="explore-section-heading"><div><span className="explore-v7-kicker">Mood</span><h2>{group.name}</h2></div><button type="button" onClick={()=>navigate(`/songs?mood=${encodeURIComponent(group.name)}`)}>See all <ChevronRight size={15}/></button></div><div className="explore-art-grid">{group.items.map((song)=><article key={song._id}><button type="button" className="explore-art-button" onClick={()=>openSong(song,group.items)}><img src={getSongCover(song)} alt={song.title} loading="lazy" decoding="async"/></button><strong>{song.title}</strong><span>{getArtistName(song)}</span></article>)}</div></section>)}
      </> : <section className="explore-results"><EmptyState title="No songs found" message="Change one of the filters or reset Explore."/></section>}
    </div>
  );
};

export default Explore;
