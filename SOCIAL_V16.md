# SoundWave Social V16

## Social UI
- Rich social hero made from the user's real SoundWave catalog artwork (web-hosted cover art), with compact play buttons.
- Quick Social shortcuts for One Song Today, Circles, Pass the Aux, and Friend Mix.
- Permanent Social icon in the top navigation in addition to desktop sidebar and mobile bottom navigation.
- Responsive layouts and smaller mobile typography/cards.

## Real song selectors
- Reusable searchable SocialSongPicker with real cover art, title, artist, selection state and in-place audio preview.
- Used by One Song Today, Sound Circles, and Pass the Aux queue selection.
- Uses existing catalog data and global player, so it adds no duplicate song catalog request.

## Reliability
- Social, Social Profile, Circle and Live Room routes are eagerly bundled instead of dynamically imported. This prevents the LiveRoom dynamic-module error that can happen when the Vite dev server briefly reconnects.
- Added a route error boundary so a page error cannot take down the whole music shell.
- Social home detects a temporary 404 from a backend deployment mismatch and keeps the page usable with a clear retry notice.
