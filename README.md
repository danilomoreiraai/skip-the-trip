# Skip The Trip

Mobile-first bathroom availability application using the Signal Core design system. Built with React 19, Vite, strict TypeScript, TailwindCSS v4, React Router 7, TanStack Query 5, Zod and Motion.

## Run the web app

```sh
cd web
npm install
npm run dev
```

The API must be running on `http://localhost:3333` by default. Set
`VITE_API_URL` to use another endpoint; `web/.env.example` documents the
environment convention.

## Run the API

The Fastify API lives in `server/` and persists shared bathroom votes in
PostgreSQL. The web app reads and writes reports through this API.

```sh
cd server
cp .env.example .env
npm install
npm run db:migrate
npm run dev
```

See [`server/README.md`](server/README.md) for the HTTP contract.

## Checks

```sh
cd web
npm run lint
npm run build
npm test
npm run test:coverage
npm run arch:test
npm run deadcode
npm run test:mutation
npx playwright install chromium
npm run test:e2e
```

## Behavior

HH5 is currently available for interaction; HH1–HH4 are visible as `Available soon` while their bathroom layouts are cataloged. For HH5, choose G/1/2/3 and Male/Accessible/Female. Viewing is public; the first contribution requires server-approved proximity to HH5 and grants a fixed four-hour authorization. Each anonymous browser contributes at most one active vote per bathroom. Updating that vote after the five-minute cooldown restarts its 30-minute lifetime. No report means unknown, never assumed available.

Reports are validated with Zod and stored by the API in PostgreSQL. An anonymous
identifier is issued in an `HttpOnly` cookie; it is not an account. Exact
coordinates are discarded after proximity verification. The selected bathroom
remains in session storage. There are no remote
fonts. Optional Google Analytics visit counting is loaded only after explicit
consent and is disabled when `VITE_GOOGLE_ANALYTICS_ID` is absent. Optional
Sentry error reporting and OpenTelemetry tracing are disabled unless explicitly
configured. `/privacy` describes the site and lets visitors change their
analytics preference; unknown routes display a 404.

`web/src/domain` owns freshness and location rules, `web/src/services` owns API
access, and `web/src/components` contains reusable controls. Reports refresh
every 5 seconds while a bathroom is selected and when the page regains focus
or connectivity. Vite deployments must rewrite SPA routes to `index.html`.

## Architecture and operations

See [`docs/architecture.md`](docs/architecture.md) for module seams, dependency contracts, observability decisions and the backend roadmap. CI runs strict typing, Biome, Dependency Cruiser, Knip, Vitest coverage, Stryker mutation tests, Playwright desktop/mobile tests and Codecov upload.

See [`docs/staging.md`](docs/staging.md) for the containerized staging stack,
migration procedure and post-deploy smoke test.

## Tracked follow-up work

The current release includes PostgreSQL persistence and integration tests,
anonymous per-browser voting, per-bathroom cooldowns, HH5 geolocation
authorization, privacy-safe geolocation failure metrics, a provisioned Grafana
dashboard, Prometheus alert rules and staging smoke tests.

Remaining work is tracked in GitHub: production Analytics configuration
([#1](https://github.com/danilomoreiraai/skip-the-trip/issues/1)), database
backups ([#19](https://github.com/danilomoreiraai/skip-the-trip/issues/19)),
retention scheduling
([#20](https://github.com/danilomoreiraai/skip-the-trip/issues/20)), alert
delivery and incident runbooks
([#21](https://github.com/danilomoreiraai/skip-the-trip/issues/21)), production
privacy ownership
([#22](https://github.com/danilomoreiraai/skip-the-trip/issues/22)) and
server-side trace propagation
([#23](https://github.com/danilomoreiraai/skip-the-trip/issues/23)). Session
replay and advertising remain outside the approved scope.
