# SoundWave V17 — Stability / One-Terminal Development

V17 is a reliability pass over V16.

## Main fixes

- Hosted Render API is the default in local development and production.
- A stale `.env.local` can no longer silently force the entire frontend to a dead localhost API.
- Local API mode requires `VITE_API_MODE=local` **and** `VITE_ALLOW_LOCAL_API=true`.
- Axios allows enough time for a sleeping Render free instance to wake and retries transient GET failures once.
- If explicitly-local Axios requests lose the local API, they retry once against the hosted API.
- `scripts/dev-all.sh` is now a one-Terminal hosted-API launcher.
- `scripts/dev-local.sh` runs the backend with `npm start` and stdin detached, avoiding macOS Bash suspending background nodemon with `[1]+ Stopped`.
- Added common route aliases and Social route recovery so legacy social links do not fall into the generic 404 page.
- Added root `package.json` commands: `npm run dev`, `npm run dev:local`, `npm run check`.
- `/api/health` now reports backend version `17.0.0`.

## Recommended local workflow

```bash
npm run dev
```

This runs the frontend against the deployed SoundWave API and needs only one terminal.

Use `npm run dev:local` only when intentionally testing backend changes before deployment.
