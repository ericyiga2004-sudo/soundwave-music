# SoundWave V12 — Lyrics / Radio / Compact Media

- Live lyrics no longer use `scrollIntoView()`, which could scroll the entire page.
- Lyric sync now scrolls only `.song-lyrics-scroll` and only when that panel is visibly on screen.
- Radio station cards are compact horizontal cards with small square artwork.
- Radio uses Bootstrap `col-12 col-sm-6 col-xl-4` responsiveness.
- Radio gradients were removed in favor of solid low-power surfaces.
- Year collection grids use denser Bootstrap columns to avoid enlarging low-resolution artwork.
- Common catalog cards are capped to modest artwork sizes while preserving responsive columns.
- Mobile lyrics and typography are smaller and contained.
