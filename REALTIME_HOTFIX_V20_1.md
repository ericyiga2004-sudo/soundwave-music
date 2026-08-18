# SoundWave V20.1 realtime compatibility hotfix

This hotfix is layered on top of the existing working V20 project. It does not replace Social routes or redesign pages.

- Render remains the primary API.
- Legacy hosted backends no longer receive repeated `/api/realtime/stream` requests.
- Capability detection uses the existing API root, so old deployments return 200 instead of a missing-route 404.
- When SSE is unavailable, notifications poll every 8 seconds while the tab is visible and Social home/Circles refresh periodically.
- UI says `Updates on` instead of looping on `Connecting`.
- Once the matching backend is deployed, response headers advertise SSE and the frontend automatically uses the live stream.
