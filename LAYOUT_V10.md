# SoundWave V10 — Ordered Responsive Catalog

## UI fixes
- Bootstrap responsive columns for New Releases, Albums, Popular Artists, and Moods.
- Uniform square artwork for songs and albums regardless of source image dimensions.
- Popular Artists are forced into true 1:1 circular crops.
- Hero artwork is always square and fully filled; no empty grey lower half.
- Reduced hero and section typography at desktop/tablet/mobile sizes.
- Catalog sections are capped to a readable 1660px canvas on very wide displays.
- Removed artificial SongItem minimum heights that created blank card space.
- All card media use object-fit: cover and centered crops.
- Lightweight solid skeleton loaders only; no shimmer gradient.

## New Releases fix
- New Releases now attempts the dedicated endpoint first.
- If that endpoint is empty/unavailable, it automatically falls back to the main newest-song endpoints.
- Personalized ranking is optional and can never hide the public catalog.
- Backend New Releases also includes legacy songs whose status field predates the published/draft schema while still excluding explicit drafts.

## Validation
- 62/62 frontend JS/JSX files parsed successfully.
- 50/50 frontend CSS files parsed successfully.
- All backend JavaScript files pass `node --check`.
