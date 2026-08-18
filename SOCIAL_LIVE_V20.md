# SoundWave Social Live V20

## Social architecture

The previous all-in-one Social screen is split into focused routes:

- `/social` — overview and recent activity
- `/social/share` — direct real-song sharing
- `/social/today` — One Song Today
- `/social/circles` — private Sound Circles
- `/social/rooms` — Pass the Aux rooms
- `/social/mix` — Friend Mix
- `/social/people` — Taste Match / people discovery
- `/social/circles/:circleId` — Circle detail
- `/social/rooms/:code` — live room detail

Every Social route has a shared responsive mode navigation and a web-hosted lifestyle image hero. Song selectors still use the actual SoundWave catalog and global player for previews.

## Live notifications

V20 uses an authenticated Server-Sent Events stream at `/api/realtime/stream`.

When the receiving user has SoundWave open, the server can push `notification:new` immediately. The bell badge, notification list, and popup toast update without a page reload. A conservative polling fallback is retained only when the live stream is disconnected.

Direct song sharing uses `POST /api/social/share-song`. A share creates a `song_shared` social activity and a notification that links directly to the shared song.

Existing notification-producing actions (playlist shares, comment replies/likes/mentions, follows, daily picks, Circle activity, song-moment interactions) also benefit from the same live notification transport.

## Live social state

- `social:refresh` refreshes Social pages after meaningful social activity.
- `circle:update` refreshes open Circle pages for member/song changes.
- `room:update` refreshes Pass the Aux room members for joins, queue changes, votes, and host advances.
- Live rooms retain a fallback refresh when the stream is disconnected.

## Performance

V20 intentionally avoids a new realtime client library. It uses native browser streaming fetch and a lightweight in-process SSE hub, which keeps frontend bundle size and runtime overhead low. Remote lifestyle imagery is lazy-loaded where appropriate and catalog audio is reused through the existing global player.

## Deployment note

Frontend and backend must both be deployed from V20 for live features to work in hosted mode. The backend health endpoint reports `version: 20.0.0` and `realtime: sse`.
