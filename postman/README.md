# Local responsive/interaction audit

Fixtures are based on the existing TaskHandler, TeamHandler, user and organization
response contracts. They use fictitious users and do not authenticate against AWS.
The simulation is **not** backend permission or database evidence; those are covered
by Java use-case/security tests and PostgreSQL Testcontainers tests.

1. Start `postman simulation run postman/simulations/ui-audit.sim.yaml --port 4946 --output ndjson --no-history`.
2. Start Vite with `VITE_API_URL=http://127.0.0.1:4946/api/v1 npm run dev -- --host 127.0.0.1`.
3. Run `node scripts/responsive-audit.cjs` with Playwright available externally
   (`PLAYWRIGHT_MODULE=/absolute/path/to/playwright` if not resolvable) and Chrome installed.
   No runtime dependency was added to the application.
4. Screenshots/results go to `/tmp/compira-responsive-audit` (`QA_OUTPUT_DIR` overrides).

The audit checks 1440, 768, 390 and 320px: task lists/actions/detail/create,
team selection, dashboard, reports, user list/edit/register, organization settings,
notifications, navigation, login, password recovery/change and six-digit OTP; it also submits an observation,
reloads it and reassigns a task to a selected team collaborator through real HTTP
to the simulation, and verifies the obsolete
teamless-task action is absent.
Restart the simulation before each run to reset its state. Unmodeled endpoints
return 501. Nothing is published or deployed.

## Notifications: finite JSON polling

The frontend now uses authenticated `GET /notifications` immediately and waits
30 seconds after each completed request before the next one. This also bounds
transient-error retries, avoids overlapping polls, and no longer calls `/stream`.
A 15-second timeout bounds hung requests; unmount cancels the request and timer.
401 ends the session; 403 clears notices and stops until manual retry. Older
pages and POST read/read-all retain their existing API contracts. Existing notices
remain visible through a transient failure. The UI says “Actualizadas cada 30
segundos”, not real-time delivery. Browser background throttling/network latency
can delay updates further; each open tab has its own polling loop.

See `simulations/notifications-polling.context.md` for the real-browser success,
503 and timeout audit, including production builds and setup commands.
The API mock is not evidence that AWS authentication or alert generation works.
No backend, AWS resource, database migration or environment variable change is
needed for this frontend adjustment. Publication still requires the normal
review/promotion workflow; changing source alone does not fix the deployed site.

### Indicative request cost

At a 30-second interval: approximately 120 GETs per hour per continuously open
signed-in tab, plus an initial fetch, pagination, read actions and possible CORS
preflights. For 8 hours/day, 22 days/month and one tab per user:

| Users | Poll GETs/month | HTTP API request charge, approximately |
| ---: | ---: | ---: |
| 10 | 211,200 | USD 0.21 |
| 100 | 2,112,000 | USD 2.11 |
| 1,000 | 21,120,000 | USD 21.12 |

Calculation uses the published HTTP API rate of USD 1 per million requests in
us-east-1 in the first pricing tier, checked 2026-10-28:
https://aws.amazon.com/api-gateway/pricing/

These are estimates of GET request charges only, not a total bill or a guarantee.
They exclude OPTIONS/other requests, data transfer, logs, taxes and any additional
ECS/Aurora/ALB/network usage. No free-tier allowance or credits are assumed.
Multiple tabs/devices and longer sessions increase traffic; slow responses and
browser throttling reduce the polling frequency. Actual database/compute impact
requires measuring real usage; it cannot be priced from request count alone.


## Coordinator activity workflows

`simulations/coordinator-workflows.sim.yaml` reuses the task/notification/user
contracts with fictional identities; its `.context.yaml` states the scope and
remaining real-provider verification. Start it on port4951, build with
`VITE_API_URL=http://127.0.0.1:4951/api/v1 npm run build -- --outDir /tmp/compira-coordinator-ui-build`,
and preview on5188. Run `scripts/coordinator-workflows-audit.cjs` with the external
Playwright module available. The audit completes a task as collaborator, records
an observation as coordinator, checks notification labels, historical authors,
automatic system actor, administrator team names and390px layout over actual HTTP.
Restart simulation before each run. Results/PNGs are in
`/tmp/compira-coordinator-workflows-audit`.

`TASK_COMPLETED` and `OBSERVATION_ADDED` are new coordinator notification types.
`DUE_SOON` now also reaches the coordinator. Deploy this compatible frontend
before the backend starts emitting new types; old tabs need to reload.

## Evolución a WebSocket

Con VITE_NOTIFICATIONS_REALTIME_ENABLED=true, la consulta30s sólo se usa cuando
el canal no está conectado. El cliente solicita ticket de un solo uso y recupera
la lista al conectar y recibir invalidación; no envía el JWT por la URL WebSocket.
Ver el runbook backend docs/notificaciones_tiempo_real_qa.md y las pruebas de
notificationRealtime para sesión vencida, fallos, latidos y reconexión.

Auditoría reproducible de cliente en tiempo real:

```bash
postman simulation run postman/simulations/realtime-workflows.sim.yaml --port 4954 --no-history
# En otra terminal: build/preview con VITE_NOTIFICATIONS_REALTIME_ENABLED=true
# y VITE_API_URL=http://127.0.0.1:4954/api/v1, puerto5189.
node scripts/realtime-notifications-audit.cjs
```

El script abre WebSocket local4953, emite invalidaciones y comprueba que no haya
GETperiódicos en31s, recuperación y presentación móvil. Son fixtures, no AWS.
