# SoundWave Premium V5

This pass fixes the issues visible in the August 17 screenshots.

## Fixed
- Removed the duplicate player from `/song/:songId`. The global SoundWave player is now the only transport player.
- Rebuilt the song page as a premium Apple-like three-column layout on large screens: artwork/actions, large synchronized lyrics, and recommendations.
- Mobile song pages use the same responsive content layout rather than rendering a second full player.
- Removed the song-page blur/background-art treatment and other expensive decorative effects.
- Changed lyrics to high-contrast Apple-style typography with active, past and upcoming states.
- Rebuilt Explore so it no longer has thin left/right sidebars. Filters are now a responsive top bar and charts/content use the full width.
- Rebuilt Discover Music/FilterSongs so empty states are light and readable instead of a dark block.
- Added stronger contrast fallbacks to stop legacy white text from appearing on white surfaces.
- Removed rendered CSS gradients from the consumer shell and global player.
- Kept Battery Saver and Low Data modes as strict effect/animation reducers.

## Validation
- Changed JSX files parse successfully with Babel parser.
- Changed JSX files pass ESLint for normal syntax/unused-variable checks (React compiler advisory rules excluded as in previous pass).
- Changed CSS files parse successfully with PostCSS.

The Vite production build cannot be run in this Linux sandbox with the uploaded macOS Rolldown native dependency. A fresh `npm install` on the target iMac resolves the platform-specific dependency.
