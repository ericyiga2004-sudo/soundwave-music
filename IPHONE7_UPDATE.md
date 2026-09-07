# iPhone 7 layout update

This patch updates the existing SoundWave checkout after commit 626f2e2.

The earlier production build minified mobile breakpoints into range media queries
such as `(width<=767.98px)`. Safari on iOS 15 cannot interpret that syntax, so
mobile overrides did not apply. This explains the desktop columns, tiny song
cards, crowded header, and mini-player positioned off the right of the phone.

Changes:
- Explicit Safari 15 JavaScript and CSS build targets in frontend and admin.
- A production CSS check runs after each frontend build and rejects incompatible
  media-query range syntax or uncompiled Tailwind directives.
- Tailwind mobile overrides for a readable header, stacked hero, two-column New
  song cards, larger icons and touch controls, and a mini-player above bottom nav.
- Comments and Up Next stack vertically, with recommendations using separate
  title/artwork and action rows. SongDetails colors and desktop design remain.
- Card menus stay anchored to their cards; compact chart rows reserve space for
  both Play and More controls.
- Navigation resets scroll to the page heading, including returning to Home.
  Intentional direct song/room links remain valid; links are not redirected away.
- Pinch zoom is enabled by removing the maximum-scale restriction.

Validation:
- Both production builds pass.
- All 32 frontend CSS assets pass the Safari 15 media-query check. The same check
  rejects the previous production bundle, confirming it detects this regression.
- Production browser checks at 320, 375, 414, and 1440 pixels cover header bounds,
  card widths, comment/recommendation stacking, icon size, player/nav positioning,
  audio playback across navigation, and scroll reset.
- Tests use Chromium with mobile viewports and a mocked catalog plus a local MP3.
  They are not tests on a physical iPhone 7 or its actual Safari engine.

After deployment completes, reload the website on the phone. Check Home, New,
comments/Up Next, and the mini-player while audio plays. Use the live root URL
when testing startup. An old saved link to /explore will still open New on purpose.
