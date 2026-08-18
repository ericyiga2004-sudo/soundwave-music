# SoundWave Social Everything Live V22

V22 is an additive live-social update built on the working V20.1 Render-primary realtime compatibility layer. Existing Social routes and page structure are preserved.

## Live update model

- Render remains the primary API.
- When the deployed backend advertises SSE, `/api/realtime/stream` pushes social invalidation events immediately.
- If SSE is not available yet, the frontend automatically falls back to quiet visible-tab polling. No manual browser reload is required.
- Local mutations dispatch a browser-level `soundwave-social-mutated` event so other Social screens in the same session refresh immediately.

## Live surfaces

- People discovery, Follow and Unfollow, persistent Following network
- Public profiles, follower counts and Taste Match refresh
- Direct song sharing and notification badge/toasts
- Shared-song notification opens the global player and replaces the current song
- One Song Today
- Sound Circles: membership and shared songs
- Pass the Aux: members, queue, voting and current song
- Song Moments: posts, reactions and replies
- Music conversations: comments, replies and likes
- Friend Mix: group-balanced recommendations, diversity controls, reasons/scores, taste-triggered rebuilds

## Friend Mix V22

Friend Mix accepts up to four followed listeners plus the current listener. It scores a candidate catalog against every participant, balances average affinity with weakest-listener affinity and coverage, mildly penalizes recently heard songs, rewards shared genre/language preferences, and then applies artist/album/genre diversity limits. The UI exposes group-fit scores and reasons instead of returning an opaque playlist.

## Compatibility

The backend advertises `X-SoundWave-Realtime: sse` and `X-SoundWave-Version: 22.0.0`. Older hosted backends are detected without hammering a missing realtime route with 404 requests.
