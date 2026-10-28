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
