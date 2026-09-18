import PremiumSelect from "../components/UI/PremiumSelect";
import SongActionMenu from "../components/SongActions/SongActionMenu";
import { MissingArtistName, SongArtwork } from "../components/UI/CatalogArtwork";
import { useContext, useEffect, useMemo, useState } from "react";
import { ChevronRight, Play, Search, SlidersHorizontal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MusicContext } from "../context/ShopContext";
import { MusicPlayerContext } from "../context/MainPlayerContext";
import { authHeaders, cachedGet } from "../config/apiClient";
import { getArtistName, getSongCover } from "../utils/catalog";
import CatalogSkeleton from "../components/UI/CatalogSkeleton";
import EmptyState from "../components/UI/EmptyState";
import "./CSS/Explore.tailwind.css";

const shuffleMix = (items = []) => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  const seen = new Set();
  return out.filter((song) => {
    const id = String(song?._id || "");
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

const Explore = () => {
  const navigate = useNavigate();
  const { getAuthToken, catalogSongs = [] } = useContext(MusicContext);
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
        const localSongs = data.songs || [];
        const needle = search.trim().toLowerCase();
        const externalMatches = country === "All"
          ? catalogSongs.filter((song) => {
              if (!song?.isExternal) return false;
              if (genre !== "All" && String(song.genre || "").toLowerCase() !== genre.toLowerCase()) return false;
              if (mood !== "All" && String(song.mood || "").toLowerCase() !== mood.toLowerCase()) return false;
              if (!needle) return true;
              const haystack = `${song.title || ""} ${song.artist?.name || ""} ${song.genre || ""} ${song.mood || ""}`.toLowerCase();
              return haystack.includes(needle);
            })
          : [];
        setSongs(shuffleMix([...localSongs, ...externalMatches]).slice(0, 60));
      } catch (err) {
        if (err?.name !== "CanceledError" && err?.name !== "AbortError") {
          setError(err?.response?.data?.message || err.message || "Could not load music");
        }
      } finally { setLoading(false); }
    }, 220);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [country, genre, mood, search, sort, catalogSongs]);

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
  const openSong = (song, queue = songs) => {
    if (song?.isExternal) {
      playSong?.(song, queue);
      return;
    }
    navigate(`/song/${song._id}`, { state: { song, playlist: queue } });
  };

  return (
    <div className="explore-page-v7 sw-container-fluid mx-auto w-full min-w-0 max-w-full overflow-x-hidden px-4 sm:px-6 lg:px-8">
      <section className="explore-v7-head !grid min-w-0 !grid-cols-1 !gap-5 xl:!grid-cols-12 xl:!items-end xl:!gap-6">
        <div className="min-w-0 xl:col-span-7">
          <span className="explore-v7-kicker">Explore SoundWave</span>
          <h1>Find something that feels right.</h1>
          <p>Browse by country, genre, mood, or search. SoundWave loads only a compact page of results to keep phones fast.</p>
        </div>
        {featured ? (
          <div className="min-w-0 xl:col-span-5">
            <article className="explore-feature-card !grid-cols-[88px_minmax(0,1fr)_44px] !gap-3 sm:!grid-cols-[120px_minmax(0,1fr)_44px]">
              <SongArtwork src={getSongCover(featured)} alt={featured?.title || "Song cover"} />
              <div><small>Featured now</small><strong>{featured.title}</strong><span><MissingArtistName name={getArtistName(featured)} /></span></div>
              <button type="button" className="!grid !h-11 !w-11 shrink-0 place-items-center" onClick={() => playSong?.(featured, songs)} aria-label={`Play ${featured.title}`}><Play className="!h-5 !w-5" fill="currentColor" /></button>
              <SongActionMenu song={featured} queue={songs} triggerClassName="sw2324-overlay-more" triggerLabel={`More options for ${featured.title}`} />
            </article>
          </div>
        ) : null}
      </section>

      <section className="explore-filter-shell" aria-label="Explore filters">
        <div className="explore-filter-title"><SlidersHorizontal size={16}/><span>Filter music</span><button type="button" onClick={reset}>Reset</button></div>
        <div className="grid min-w-0 grid-cols-2 gap-2 md:grid-cols-6">
          <div className="col-span-2 min-w-0 md:col-span-2"><div className="explore-search-wrap"><Search size={16}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Songs, artists, moods…" aria-label="Search music"/></div></div>
          <div className="min-w-0"><PremiumSelect value={country} onChange={(e)=>setCountry(e.target.value)} aria-label="Country"><option>All</option>{(filters.countries||[]).map((item)=><option key={item}>{item}</option>)}</PremiumSelect></div>
          <div className="min-w-0"><PremiumSelect value={genre} onChange={(e)=>setGenre(e.target.value)} aria-label="Genre"><option>All</option>{(filters.genres||[]).map((item)=><option key={item}>{item}</option>)}</PremiumSelect></div>
          <div className="min-w-0"><PremiumSelect value={mood} onChange={(e)=>setMood(e.target.value)} aria-label="Mood"><option>All</option>{(filters.moods||[]).map((item)=><option key={item}>{item}</option>)}</PremiumSelect></div>
          <div className="min-w-0"><PremiumSelect value={sort} onChange={(e)=>setSort(e.target.value)} aria-label="Sort"><option value="popular">Popular</option><option value="newest">Newest</option><option value="liked">Most liked</option><option value="az">A–Z</option></PremiumSelect></div>
        </div>
      </section>

      {loading && !songs.length ? <section className="explore-results"><CatalogSkeleton count={10} rows/></section> : error && !songs.length ? <section className="explore-results"><EmptyState title="Explore could not load" message={error}/></section> : songs.length ? <>
        <section className="explore-results">
          <div className="explore-section-heading"><div><span className="explore-v7-kicker">Top picks</span><h2>{country === "All" ? "Popular right now" : `Top in ${country}`}</h2></div><button type="button" onClick={()=>navigate("/songs")}>View all <ChevronRight size={15}/></button></div>
          <div className="explore-top-list">{topTen.map((song,index)=><article key={song._id} className="explore-top-row !min-h-[76px] !grid-cols-[26px_54px_minmax(0,1fr)_44px] !gap-2 sm:!grid-cols-[30px_58px_minmax(0,1fr)_44px] md:!grid-cols-[34px_58px_minmax(0,1fr)_minmax(100px,.35fr)_44px]"><span className="explore-rank">{String(index+1).padStart(2,"0")}</span><SongArtwork className="!h-[54px] !w-[54px] !rounded-xl sm:!h-[58px] sm:!w-[58px]" src={getSongCover(song)} alt={song?.title || "Song cover"} loading="lazy" decoding="async"/><button type="button" className="explore-title-btn [&>strong]:!text-[0.9rem] [&>small]:!text-[0.76rem]" onClick={()=>openSong(song,topTen)}><strong>{song.title}</strong><small><MissingArtistName name={getArtistName(song)} /></small></button><span className="explore-row-meta !hidden md:!block">{song.genre||"Music"}</span><button type="button" className="explore-play-btn !grid !h-11 !w-11 shrink-0 place-items-center" onClick={()=>playSong?.(song,topTen)} aria-label={`Play ${song.title}`}><Play className="!h-5 !w-5" fill="currentColor"/></button><SongActionMenu song={song} queue={topTen} triggerLabel={`More options for ${song.title}`} /></article>)}</div>
        </section>
        {moodGroups.map((group)=><section className="explore-mood-v7" key={group.name}><div className="explore-section-heading"><div><span className="explore-v7-kicker">Mood</span><h2>{group.name}</h2></div><button type="button" onClick={()=>navigate(`/songs?mood=${encodeURIComponent(group.name)}`)}>See all <ChevronRight size={17}/></button></div><div className="explore-art-grid !grid !grid-cols-2 !gap-x-3 !gap-y-6 sm:!grid-cols-3 lg:!grid-cols-6">{group.items.map((song)=><article className="relative min-w-0" key={song._id}><button type="button" className="explore-art-button !block !w-full !rounded-xl" onClick={()=>openSong(song,group.items)}><SongArtwork className="!h-full !w-full" src={getSongCover(song)} alt={song.title || "Song cover"} loading="lazy" decoding="async"/></button><strong className="!mt-2 !text-[0.9rem]">{song.title}</strong><span className="!mt-1 !text-[0.76rem]"><MissingArtistName name={getArtistName(song)} /></span><SongActionMenu song={song} queue={group.items} triggerClassName="sw2324-overlay-more" triggerLabel={`More options for ${song.title}`} /></article>)}</div></section>)}
      </> : <section className="explore-results"><EmptyState title="No songs found" message="Change one of the filters or reset Explore."/></section>}
    </div>
  );
};

export default Explore;
