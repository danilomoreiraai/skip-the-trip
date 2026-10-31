# Skip the Trip API

Fastify API that stores anonymous bathroom availability votes in PostgreSQL.

## Local setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL`.
2. Run `npm install`.
3. Run `npm run db:migrate`.
4. Run `npm run dev`.

The default address is `http://localhost:3333`.

## HTTP interface

### `GET /reports`

Returns the current status of one bathroom. Reading is public.

```text
/reports?building=HH5&floor=G&category=Male
```

### `POST /reports`

Records an anonymous report (YES or NO) for one bathroom. A valid HH5 location
authorization cookie is required. `idempotencyKey` must be reused when retrying
the same voting intent.

```json
{
  "building": "HH5",
  "floor": "G",
  "category": "Male",
  "available": true,
  "idempotencyKey": "550e8400-e29b-41d4-a716-446655440001"
}
```

### `POST /locations/HH5/verify-location`

Accepts `latitude`, `longitude`, and `accuracy`. When the server approves the
reading it discards the coordinates, stores a fixed four-hour authorization,
and sets an `HttpOnly` anonymous identity cookie. Revalidating early does not
extend an existing authorization.

Both endpoints return a summary with `available`, `reportedAt`, `expiresAt`,
`yesCount` and `noCount`. Bathrooms are **available by default**. A YES report
keeps (or returns) the bathroom to available and never expires. A NO report
(closed for cleaning or maintenance) marks it unavailable for
`REPORT_WINDOW_MINUTES` (30 by default); `expiresAt` is then the end of the
closure, and it is `null` while the bathroom is available. `reportedAt` is the
time of the last report, or `null` when nobody reported yet. `yesCount` and
`noCount` count the reports accepted today and reset at local midnight in
the building's time zone, defined per building in `BUILDING_TIME_ZONES`
(`server/src/domain/locations.ts`). Add an entry there when a new building is
cataloged.

Health probes are available at `/health/live` and `/health/ready`.
`GET /release` returns only the public full Git revision as
`{"revision":"<sha>"}`; it does not alter the health response contract.

## Commands

```sh
npm run typecheck
npm run lint
npm run test:coverage
npm run test:integration # requires TEST_DATABASE_URL
npm run build
npm run db:generate
npm run db:migrate
npm run db:migrate:prod # after npm run build, for release environments
```
