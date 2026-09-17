# Soundwave v23.23 — Audius Discovery + Safe Fallback

This update was rebuilt specifically from the uploaded source of the real project at:

`~/Desktop/soundwave-music`

It does **not** replace, delete, copy, or edit `backend/.env`.

## Add these manually to `backend/.env`

```env
AUDIUS_API_KEY=PASTE_YOUR_REAL_API_KEY_HERE
AUDIUS_BEARER_TOKEN=PASTE_YOUR_REAL_BEARER_TOKEN_HERE
```

Optional defaults (you normally do not need to add them):

```env
AUDIUS_API_BASE_URL=https://api.audius.co/v1
AUDIUS_TIMEOUT_MS=15000
```

## What changed

- Adds backend Audius routes:
  - `GET /api/audius/status`
  - `GET /api/audius/catalog?limit=60&time=week`
  - `GET /api/audius/search?q=...&limit=30`
  - `GET /api/audius/stream/:trackId`
- Uses Audius artwork URLs and playable stream metadata.
- Proxies Audius audio through the Soundwave backend so the Bearer token never reaches the browser.
- Preserves HTTP Range headers for seeking/mobile playback.
- Adds an Audius discovery section to Home.
- Adds Audius results to Search while keeping normal Soundwave songs/artists/albums alive if Audius fails.
- Keeps `MusicContext.songs` as the existing MongoDB/Cloudinary catalog.
- Stores Audius tracks separately as `audiusSongs` / `catalogSongs` so MongoDB-only features do not receive Audius IDs.
- Prevents Audius tracks from being sent to MongoDB history/personalization calls.
- Audius cards play in the persistent player instead of opening MongoDB-backed Song Details.
- No dependency changes.

## Fallback behavior

Audius and the existing Soundwave catalog are isolated from each other. If Audius times out, returns an error, is not configured, or returns no playable tracks, the Audius backend route returns normal Soundwave songs. The frontend also fetches `/api/songs` independently, so your existing catalog remains usable even if the Audius route itself is unavailable.

## Safety

`apply-update.sh` checks SHA-256 fingerprints of every existing file it plans to modify. If your local real project changed after the uploaded ZIP was created, the installer stops before changing anything instead of overwriting newer work.

Before applying, it creates a timestamped backup next to your project containing every existing file that will be changed, plus any pre-existing versions of the new Audius files.
