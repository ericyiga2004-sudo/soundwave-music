# SoundWave V9 — Hosted API connection + catalog resilience

## Why V8 showed `localhost:4000` connection errors
The V8 installer created `frontend/.env.local` with `VITE_BACKEND_URL=http://localhost:4000`.
Vite gives `.env.local` higher priority than `.env`, so the browser kept calling a local backend even while the real API was live on Render.

## V9 connection model
Frontend and admin now have a public environment file containing only the hosted API origin:

- `VITE_API_MODE=hosted`
- `VITE_HOSTED_BACKEND_URL=https://soundwave-music.onrender.com`

The API configuration selects `VITE_HOSTED_BACKEND_URL` in hosted mode. A stale legacy `VITE_BACKEND_URL=http://localhost:4000` therefore cannot hijack requests.

Local backend development is explicit only:

- `VITE_API_MODE=local`
- `VITE_LOCAL_BACKEND_URL=http://localhost:4000`

The frontend/admin values are public URLs and contain no secret credentials. Backend secrets remain only in Render Environment Variables and are never packaged.

## Catalog resilience
Public catalog data is fetched independently from authenticated personalization. A stale JWT can no longer make artists, albums, new releases, yearly collections, search results, or discovery grids disappear. Personalization is additive and falls back to the public catalog when auth-specific requests fail.

## Installation requirement
Delete any old `frontend/.env.local` and `admin/.env.local` before starting V9 so Vite cannot retain an obsolete local override from a previous installation.
