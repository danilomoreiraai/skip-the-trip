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

HH5 is currently available for interaction; HH1–HH4 are visible as `Available soon` while their bathroom layouts are cataloged. For HH5, choose G/1/2/3 and Male/Accessible/Female. The latest Yes/No report wins and expires after 30 minutes, including while the page remains open. No report means unknown, never assumed available. Votes are shared through the API; session storage preserves the selection across reloads. Changing a building or floor resets downstream selections. A device must wait five minutes before voting on the same bathroom again.

Reports are validated with Zod and stored by the API in PostgreSQL. An anonymous
installation ID is stored under `skip-the-trip:client-id:v1`; it is not an
account. The selected location remains in session storage. There are no remote
fonts. Optional Google Analytics visit counting is loaded only after explicit
consent and is disabled when `VITE_GOOGLE_ANALYTICS_ID` is absent. Optional
Sentry error reporting and OpenTelemetry tracing are disabled unless explicitly
configured. `/privacy` describes the site and lets visitors change their
analytics preference; unknown routes display a 404.

`web/src/domain` owns freshness and location rules, `web/src/services` owns API
access, and `web/src/components` contains reusable controls. Reports refresh
every 15 seconds while a bathroom is selected and when the page regains focus
or connectivity. Vite deployments must rewrite SPA routes to `index.html`.

## Architecture and operations

See [`docs/architecture.md`](docs/architecture.md) for module seams, dependency contracts, observability decisions and the backend roadmap. CI runs strict typing, Biome, Dependency Cruiser, Knip, Vitest coverage, Stryker mutation tests, Playwright desktop/mobile tests and Codecov upload.

See [`docs/staging.md`](docs/staging.md) for the containerized staging stack,
migration procedure and post-deploy smoke test.

## Next phase

Before a functional release: confirm the real catalog, user identity and
duplicate-vote policy, add PostgreSQL integration tests, server-side
OpenTelemetry, dashboards and alerts, and confirm organization/contact
information and privacy requirements. Session replay and advertising require a
separately agreed consent design.
