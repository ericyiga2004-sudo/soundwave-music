# SoundWave Apple-flat Performance V4

This pass focuses on a clean Apple Music-inspired consumer UI while keeping SoundWave branding and existing backend behavior.

## Visual system
- No rendered gradients in the normal consumer app.
- Opaque white/grey surfaces with clear dark text; dark mode uses solid dark surfaces.
- Red is reserved for direct actions, playback state, and small emphasis instead of red metadata on grey cards.
- Glass blur, glow effects, large shadows, hover movement, and decorative motion are removed from the consumer app.
- Consumer layouts use Bootstrap containers/grid where practical plus lightweight CSS media queries.

## Performance
- Battery Saver can be toggled from the top Settings menu or Account > Playback & data settings.
- Low Data Mode can be toggled from the same locations and defaults on when the browser reports Data Saver/2G.
- Lower Home sections are deferred with IntersectionObserver instead of loading all cards immediately.
- Low Data Mode waits longer before mounting below-fold sections.
- Nonessential promo content is hidden in Low Data Mode.
- Reusable catalog artwork uses lazy loading / async decoding where applicable.
- CSS uses content-visibility for large below-fold catalog sections.
- Skeletons use a low-cost solid opacity pulse, not moving gradient shimmer. Battery Saver / Low Data can disable the pulse.

## Home fixes
- Flat neutral feature area instead of the large red gradient panel.
- Moods are image cards with text below rather than translucent text overlays.
- Popular Artists uses responsive compact cards and no clipped oversized Follow buttons.
- Year collections use a compact artwork + content header and neutral metadata instead of bright red year/country text.

## Playlists
- Responsive Apple-like split layout on desktop and stacked layout on phones/tablets.
- Create playlist, add/remove songs, play, share, received shares, filters, and song search are preserved.
- Added a Delete playlist action using the existing `/api/playlist/delete` backend route.

## Song details / lyrics
- Removed blurred album-art backgrounds and visualizer decoration from the consumer song page.
- Desktop is a focused artwork/details + scrolling lyric layout.
- Mobile uses a clean Now Playing layout.
- Time-synced lyrics remain interactive: the active line follows playback and lyric lines can seek when synchronized timing is available.
- Apple Music's web experience similarly presents time-synced lyrics and lets users select a lyric line to jump to that point; SoundWave follows that interaction pattern without copying Apple branding/assets.

## Validation
- All source JS/JSX files parse successfully.
- All source CSS files parse successfully.
- Relative imports were checked on a case-sensitive filesystem.
- Changed user-facing JS/JSX files pass ESLint when pre-existing React Compiler advisory rules are disabled.

A production Vite build could not be run in the Linux editing environment because the uploaded dependency tree contains a macOS-specific Rolldown native binding. Install dependencies fresh on the target Mac before running/building.
