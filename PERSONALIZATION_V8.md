# SoundWave V8 — Adaptive Personalization

V8 upgrades SoundWave's recommendation system from simple history/likes weighting to a compact interaction-based taste model.

## Signals learned

- Real listening time: 20-second and 60-second milestones
- Song completion
- Repeats
- Early skips (negative signal)
- Likes / unlikes
- Playlist saves / removals
- Search-to-play intent
- Song detail views
- Artist views and follows / unfollows
- Album views

Each song signal updates related song, artist, album, genre, language, mood, country and release-era preference vectors.

## Performance / privacy design

- No large raw interaction log is stored.
- Each user keeps bounded aggregate preference vectors only.
- Interaction events are batched on the client (up to 12 at a time) instead of one request per action.
- Low Data Mode delays batches and suppresses automatic recommendation-section refreshes.
- Recommendation refresh events are throttled to at most once every two minutes.
- Preference scores decay over time (45-day half-life) so current taste gradually matters more.
- Large global play counts use logarithmic weighting and cannot overpower personal taste.
- Results are diversified to reduce repeated artists/albums in the same recommendation run.
- Users can disable Personalized recommendations in Account settings.

## Recommendation dimensions

The ranking engine now scores:

1. exact song affinity
2. artist affinity
3. album affinity
4. language affinity
5. genre affinity
6. mood affinity
7. country affinity
8. release-era affinity
9. explicit likes
10. lightweight popularity and freshness signals

The API also returns up to three `recommendationReasons` per recommended song for future UI use.

## API

`POST /api/personalization/interactions`

Authenticated batched interaction endpoint. Maximum 30 events per request. Unknown event types are ignored.

## Compatibility

Existing users do not need a migration. New `albums`, `songs`, `updatedAt`, and algorithm metadata fields are optional/defaulted by Mongoose and are learned progressively as users interact.
