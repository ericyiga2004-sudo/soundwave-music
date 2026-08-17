# SoundWave Social V15

V15 adds a lightweight social layer on top of the existing V14 player and personalized catalog.

## Social navigation
- `/social` — Social home, daily picks, activity, Circles, Pass the Aux, people discovery, Taste Match and Friend Mix.
- `/u/:userId` — public music profile.
- `/social/circles/:circleId` — private Sound Circle.
- `/social/rooms/:code` — lightweight shared queue / Pass the Aux room.
- Social is available in the desktop sidebar and mobile bottom navigation.

## Account limits
Visitors can keep listening to the public catalog and can read public comments/song moments. An authenticated account is required for follows, Taste Match, social feed, posting/liking/replying, Circles, daily picks, Friend Mix and live rooms. Backend routes enforce this in addition to the UI.

## New social systems
- Sound Circles: private groups with invite codes, member list and shared songs.
- Song Moments: timestamped reactions and replies attached to an exact point in a song.
- Taste Match: compares compact preference vectors already produced by V8.
- Pass the Aux: shared room code, song queue, votes and host-controlled advancing. Uses low-frequency REST polling instead of a permanent WebSocket to reduce data/RAM use.
- One Song Today: one upserted pick per user/day.
- Music profiles: bio, follower/following counts, top genres/languages/artists and optional recent listening.
- Friend Mix: combines preference rankings for the listener plus up to four friends.
- Discovery Trail: shows how followed listeners interacted with a song.
- Queue intelligence: Play Next and Add Later are separate actions.

## Music conversations
Comments now support one-level replies, likes, @mentions, optional playback timestamps and Recent/Top sorting. Song Moments provide a separate faster timestamped reaction layer.

## Notifications
- Numeric unread badge remains on the bell.
- New notifications appear as compact pop-up cards while the app is open.
- Comment replies show who replied.
- Comment likes show who liked the comment.
- Song moment replies/likes and Circle activity create notifications.
- Popups are polled every 25 seconds only while the page is visible; live rooms poll every 8 seconds only while visible.

## Privacy
Social home includes controls for:
- public music profile
- recent listening visibility
- Taste Match availability

## Performance choices
- No WebSocket is held open across the whole application.
- Social pages are lazy-routed.
- Social is not fetched at all for signed-out visitors.
- Existing global song catalog is reused for daily pick, Circle and room selectors instead of downloading a second catalog.
- Artwork remains lazy-loaded where applicable.
- No new animation framework, blur system or large media dependency was added.

## Backend deployment
V15 changes backend models, controllers and routes. Push the complete V15 source to GitHub/Render before testing the new social API on a hosted frontend. The ZIP contains no private backend `.env`.
