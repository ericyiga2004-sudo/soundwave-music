# SoundWave V11 — Player & Song Page Sync Fix

## Fixed
- Song detail routes now follow the actual current track when Next, Previous, or Up Next changes playback.
- SongDetails immediately adopts the current player's song for the new route instead of leaving stale artwork/title on screen.
- Remote audio playback no longer requires anonymous CORS just to play a file.
- Removed the pause-on-buffer behavior that could deadlock remote audio on slow/mobile connections.
- Added playback request sequencing so an older async track load cannot overwrite a newer song selection.
- Added one controlled retry after a media-source error instead of repeated retry loops.
- Audio URLs are normalized and relative audio paths resolve against the configured SoundWave API.
- Player surfaces useful playback errors instead of silently failing.
- Added a mobile mute/unmute control so a previously saved zero volume cannot leave mobile playback permanently silent.
- Comments reset correctly when moving between song routes.

## API configuration
Frontend and admin continue to use the hosted Render API configuration. Backend secrets are not included.
