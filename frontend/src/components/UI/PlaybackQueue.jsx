import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Play } from "lucide-react";

export default function PlaybackQueue({ player, onClose }) {
  const closeRef = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const key = event => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const buttons = [...closeRef.current.closest('[role="dialog"]').querySelectorAll('button:not(:disabled)')];
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", key);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", key); previous?.focus(); };
  }, []);
  return createPortal(<div className="sw-visible-queue-overlay" onClick={onClose}>
    <section className="sw-visible-queue" role="dialog" aria-modal="true" aria-label="Playback queue" onClick={e=>e.stopPropagation()}>
      <header><div><h2>Playback queue</h2><p>{player?.shuffle ? "Shuffled order" : "Playing in this order"}{player?.repeat === "one" ? " · Repeating current song" : player?.repeat === "all" ? " · Repeating queue" : " · Recommendations continue after your picks"}</p></div><button ref={closeRef} type="button" onClick={onClose} aria-label="Close playback queue"><X/></button></header>
      <div className="sw-visible-queue-list">{(player?.playlist || []).map((song,index)=><button key={`${song._id}-${index}`} type="button" aria-current={index===player.currentIndex ? "true" : undefined} onClick={async()=>{await player.playByIndex(index);onClose();}}><span>{index===player.currentIndex ? <Play size={18}/> : index+1}</span><span><strong>{song.title}</strong><small>{song.artist?.name || song.artistName || (typeof song.artist==='string' ? song.artist : 'Unknown artist')}{index===player.currentIndex ? " · Now playing" : index<player.currentIndex ? " · Played" : ""}</small></span></button>)}{!player?.playlist?.length && <p>Play a song to start your queue.</p>}</div>
    </section>
  </div>,document.body);
}
