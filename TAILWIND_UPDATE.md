# SoundWave Tailwind update

## Run the website

Use Node.js 22.12 or newer (Node 24 is also supported). This update applies to your existing local project. A backup of affected files is saved outside the project.

From your existing project folder:

```bash
cd frontend
npm ci
npm run dev -- --host 0.0.0.0
```

Open the Local URL on your Mac. To test on your phone, connect it to the same Wi-Fi and open the Network URL printed by Vite. The hosted backend remains the default, as in your original project.

For a production build:

```bash
npm run build
```

The result is in `frontend/dist`. Deploy this new build through your usual hosting workflow. This download does not change the currently hosted website.

For the admin app, run `npm ci` and `npm run dev` inside `admin`.
For the local backend, retain your existing private environment files and configuration. Your uploaded ZIP did not include them. Copy them from your original project if needed; do not replace them with blank files.

## What changed

- Configured Tailwind CSS 3.4.19 and PostCSS in the frontend and admin app. Tailwind 3.4 avoids Tailwind 4's Safari 16.4 browser requirement.
- Removed Bootstrap, React Bootstrap, and Bootstrap Icons dependencies and stylesheet imports. Existing React/Lucide icons remain.
- Replaced Bootstrap grid, spacing, display, and responsive classes with Tailwind utilities. Retained `row` and `col` only as existing component selector hooks; Tailwind now supplies their layout utilities.
- Migrated component styles to Tailwind `@apply` in `*.tailwind.css`. Exact values use arbitrary utilities; theme variables, animation keyframes, and dynamic runtime values remain where needed. Responsive component rules use the screens in `tailwind.config.js`.
- Rebuilt sidebar layout and collapse with JSX utilities: hidden below 992px, an 86px icon rail on smaller desktops, and a 258px sidebar on wider desktops. The existing bottom navigation remains on phones. Sidebar controls include accessible labels and expanded state; the player expands with the workspace when the sidebar is hidden.
- Preserved existing theme colors. Kept all four original SongDetails stylesheets byte-for-byte unchanged. Replaced its Bootstrap utility classes while retaining its CSS.

## Audio fixes

A fresh browser previously passed a missing storage value into `Number(null)`, producing zero volume and muting the player. New sessions now start at 82% volume. Explicit saved volume settings are retained.

Online playback now resolves the source synchronously and calls `audio.play()` directly before awaiting its result, preserving the Play tap for mobile playback permission. The asynchronous offline-cache path remains available. Permission rejections clear the buffering state and require an explicit retry rather than an automatic retry loop.

The existing mobile mute button remains. A mobile SongDetails unmute control appears if a previous session saved zero volume, so you can recover without returning to the main player. SongDetails CSS is unchanged.

## Verification

- Frontend and admin production builds pass.
- No Bootstrap packages or imports remain in either app.
- All four SongDetails CSS files match the uploaded originals exactly.
- Chromium checks at 375, 768, 1024, and 1440 pixels: Home and SongDetails fit without horizontal overflow; desktop sidebar collapse passes.
- Explore, Songs, Library, Liked, Account, and Playlists checked at phone and desktop widths without page errors or document overflow.
- Actual local MP3 playback advances after a Play tap, starts unmuted in a fresh browser, and is invoked during user activation.
- Saved zero-volume recovery through the mobile SongDetails unmute control passes.

Browser checks used a local sample MP3 and a mocked catalog. They do not verify your physical phone, live catalog URLs, production server headers, or authenticated social-room synchronization. Test a real song on your phone after running or deploying this version; if a specific track still fails, its audio URL and the browser error will help identify a separate source issue.

## Deploy-checkout merge

This updater is based on the supplied soundwave-deploy-current.zip. Its notification reconciliation, artist-follow events, sharing compatibility, current live-room design, and light default theme were preserved. Previously removed components stay removed. The backend and SongDetails stylesheets are unchanged. Both builds and browser playback/layout checks passed again on this merged version.
