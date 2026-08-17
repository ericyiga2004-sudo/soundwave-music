# SoundWave Catalog Fix V6

- Added one shared frontend API configuration with a safe hosted-backend fallback.
- VITE_BACKEND_URL is now optional for local/downloaded builds.
- Cleaned accidental literal `\\n` / trailing slash characters from custom API URLs.
- Rewired Popular Artists, Discover Music, yearly collections, albums, search, recommendations, likes, and related songs to the same API base URL.
- Removed misleading "Backend URL is missing" states.
- Added retry states for catalog requests so connection problems are not presented as an empty music library.
- Added `.env.example` without credentials.
