# SoundWave — Apple Music-inspired UI update

This build keeps the SoundWave brand and existing backend/music logic while rebuilding the user-facing shell around a clean Apple Music-inspired design language.

## Main UI changes
- New desktop sidebar with Home, New, Radio, Library, Favorites and Playlists.
- New compact top bar with history controls, search, notifications, theme control, battery saver and account access.
- New mobile bottom navigation using Bootstrap breakpoints.
- New persistent player bar with previous/play/next, shuffle, repeat, seek, volume and queue controls.
- New Up Next queue drawer.
- New Radio page with continuous stations generated from the existing song catalog.
- New Listen Now home hero using real catalog artwork instead of a remote hero background.
- Apple Music-inspired red/pink accent palette across the user-facing app.
- Light-first appearance with optional dark appearance.
- Battery Saver preference that disables costly blur/animation work.
- `/` keyboard shortcut opens search.
- Simplified launch screen for faster perceived startup.

## Responsiveness
- Bootstrap remains the responsive foundation.
- Desktop: full 258px music sidebar.
- Compact desktop/tablet landscape: icon-only 86px sidebar.
- Mobile/tablet portrait: sidebar disappears and bottom tabs take over.
- Player collapses to a compact mobile mini-player above the tab bar.

## Performance work
- Removed the old remote photographic hero background.
- Reduced general glass/blur usage.
- Reduced animated card transforms.
- Battery Saver forces nearly all decorative transitions/animations off.
- Heavy studio/DJ pages remain immersive so their controls do not compete with the main music shell.

## Bug fixes / hardening
- Fixed the case-sensitive SideBar stylesheet import (`Sidebar.css` -> `SideBar.css`).
- Kept all relative imports resolvable on case-sensitive deployment filesystems.
- Added mobile-web-app metadata and refreshed favicon/title.
- Updated app shell spacing so desktop sidebar/player and mobile tab/player do not overlap content.

## Validation performed
- All JS/JSX source files were parsed successfully with Babel parser.
- All CSS source files were parsed successfully with PostCSS.
- All modified React/UI files pass ESLint.
- All relative source imports were checked against a case-sensitive filesystem.

## Build note
The uploaded archive contains platform-specific `node_modules` from macOS. The Linux sandbox cannot execute its Rolldown native dependency, so the production Vite build cannot be verified in this container. On the iMac, remove/reinstall `node_modules` with `npm install` and then run `npm run build` or `npm run dev`.
