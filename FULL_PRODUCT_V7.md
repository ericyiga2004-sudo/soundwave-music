# SoundWave Full Product V7

This release treats SoundWave as a complete music product rather than a visual-only redesign.

## Consumer experience
- Apple-inspired solid-surface layout with SoundWave branding.
- No rendered glass blur or UI gradients in the normal consumer shell.
- Responsive typography and layouts for iMac, laptop, tablet, phone, and very small phones.
- One global player across the consumer app.
- Battery Saver and Low Data modes.
- Lazy artwork, deferred home sections, compact paginated catalog requests, request caching, and duplicate-request sharing.
- Lightweight skeleton states without GPU-heavy shimmer gradients.

## Catalog navigation
- Working All Artists, All Albums, and All Songs pages.
- Working artist, album, song, mood, year, playlist, Explore, Library, Favorites, Radio, Account, and Home routes.
- View/See All controls route to real destination pages or filtered song results.
- Search and sorting use paginated backend queries instead of downloading the entire catalog.

## Song page
- Premium single-player song detail page; no duplicate audio player.
- Large synchronized lyrics that follow global playback and can seek by line.
- Favorites, playlist add, offline save/remove, share, metadata, recommendations.
- Full comments: read, post, edit own comment, delete own comment, like/unlike, pagination.

## Playlists
- Create, rename/describe, add/remove songs, play, delete, share, received shares, and playlist detail routes.
- Playlist statistics continue to use the existing backend model.

## Backend additions and fixes
- Comments model, controller, and routes.
- Optional-auth comment reads and authenticated comment writes.
- Notification-token registration endpoints.
- Paginated/searchable artist and album listing.
- Paginated/filterable published-song catalog.
- Artist/album-aware text search.
- Playlist detail/update/play endpoints.
- API health and API 404 JSON routes.
- Correct playlist user-model reference.

## Local configuration
The frontend and admin fall back to the hosted SoundWave API if `VITE_BACKEND_URL` is omitted.
To run the updated backend locally, preserve/copy your private `backend/.env` from your working installation. Never commit or share it.

Useful scripts:
- `./scripts/install-local.sh`
- `./scripts/dev-all.sh`
