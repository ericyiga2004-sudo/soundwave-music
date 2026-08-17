# SoundWave V13 — Mobile Lyrics + Detail Transport

## Song Details changes

- Mobile lyrics default to a compact collapsed preview so the page has a single natural vertical scroll.
- Added a mobile expand/collapse chevron for lyrics.
- The lyrics auto-follow routine runs only while lyrics are expanded and sufficiently visible.
- Expanded mobile lyrics are capped to a smaller viewport and the collapse control remains sticky within the lyrics section.
- Added a dedicated Song Details seek slider with 0.01-second seek steps.
- Added 30-second rewind and 30-second forward controls using the existing shared audio engine.
- Added a compact play/pause control next to the seek controls.
- The detail transport uses the same MainPlayerContext as the global player, so there is still only one audio source/player.
- No new network requests, audio streams, animation libraries, blur effects, or large assets were added.

## Validation

- All frontend JS/JSX files parse successfully.
- All frontend CSS files parse successfully.
- Existing shared `skipForward`, `skipBackward`, and `seekTo` audio controls are reused.
