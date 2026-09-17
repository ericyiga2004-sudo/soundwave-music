# SoundWave Audius v24.1 — Artist Discovery

- Mixes Audius artists into existing Popular Artists and /artists pages.
- Search on /artists queries both SoundWave and Audius.
- Audius artist cards reuse /artist/:artistId and existing Artist page.
- Audius artist profiles/tracks remain fetched live and cached.
- Native artist following remains MongoDB-backed; Audius cards open the artist instead of sending external IDs to MongoDB follow endpoints.
- No UI redesign.
