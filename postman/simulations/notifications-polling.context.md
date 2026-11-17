# Notification polling audit

2026-10-28: fixtures reuse the backend notification JSON contract (latest 50,
string IDs, readAt, before cursor, POST read/read-all). No live credentials.
The success member also serves the task-list fixture needed by the real frontend.
The two failure members model HTTP 503 and a 20-second notification GET,
respectively. Unmodeled endpoints return 501. OPTIONS must remain fast and carry
CORS headers; simulation-wide latency/error conditions would affect OPTIONS too
and test a preflight failure instead of the intended GET.

Start:
`postman simulation run postman/simulations/notifications-polling.sim.yaml --port 4947 --output ndjson --no-history`

Build three separate production bundles (development StrictMode mounts effects
twice and aborts the first request; it is not a production request-rate measure):

```sh
VITE_API_URL=http://127.0.0.1:4947/api/v1 npm run build -- --outDir /tmp/compira-poll-success
VITE_API_URL=http://127.0.0.1:4947/api-error/v1 npm run build -- --outDir /tmp/compira-poll-error
VITE_API_URL=http://127.0.0.1:4947/api-slow/v1 npm run build -- --outDir /tmp/compira-poll-slow
```

Serve each bundle in a separate terminal:

```sh
npm exec vite preview -- --host 127.0.0.1 --port 5185 --strictPort --outDir /tmp/compira-poll-success
npm exec vite preview -- --host 127.0.0.1 --port 5186 --strictPort --outDir /tmp/compira-poll-error
npm exec vite preview -- --host 127.0.0.1 --port 5187 --strictPort --outDir /tmp/compira-poll-slow
```

Run `PLAYWRIGHT_MODULE=/path/to/playwright node scripts/notifications-polling-audit.cjs`.
Uses installed Chrome and real HTTP, without intercepting/stubbing fetch.
Results/screenshots: `/tmp/compira-notifications-polling-audit`.
Restart the simulation before rerunning: marking read persists in mock state.
This proves browser transport/timing/recovery, not AWS deployment, Cognito
verification, database correctness, alert generation, or total cloud costs.

Verified 2026-10-28 with this audit: all three scenarios passed. Success GET
start gaps were 30.003s and 30.041s (three HTTP 200 responses); read-all remained
read after the next poll. The two error responses were HTTP 503, 30.028s apart.
The slow browser request was cancelled after 14.979s, with the next request at
44.995s from the first start. No notification stream request was made.
Local Vitest coverage run: 339 tests passed across 30 files; notification API
100% lines/branches and notification feature 98.52% lines. Build passed; lint
reported no errors and nine pre-existing warnings outside notification changes.
