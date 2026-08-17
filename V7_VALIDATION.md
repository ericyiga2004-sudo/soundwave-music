# SoundWave V7 validation

- Frontend JS/JSX parser audit: 61 files, 0 syntax errors.
- Frontend CSS parser audit: 49 files, 0 syntax errors.
- Backend Node syntax audit: passed for all backend JavaScript files.
- App route audit includes Home, Explore/New, Radio, Library, Favorites, Playlists, playlist detail, Artists, Albums, Songs, Song detail, Album detail, Artist detail, Mood, Yearly collections, Account, DJ/Studio/Visualizer and 404.
- Comment API supports list/create/edit/delete/like with pagination and authentication.
- Playlist API supports create/get/detail/update/add/remove/delete/play/share/received/sent/revoke.
- Catalog API supports paginated/searchable songs, artists and albums.
- Responsive guardrails cover desktop/iMac, laptop, tablet, phone and <=360px screens, plus mobile safe areas.
- Battery Saver and Low Data modes disable expensive effects and defer lower-priority work.

A full Vite production build could not be executed in the Linux packaging sandbox because the uploaded dependency tree contains a platform-specific Rolldown native binding. Run `npm install` on the target Mac before `npm run build`/`npm run dev`.

Private environment files and `frontend/android/app/google-services.json` are intentionally not included in the distributable ZIP. Restore private configuration locally from your original working copy when needed.
