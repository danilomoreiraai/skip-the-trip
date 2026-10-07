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

Returns active votes for one bathroom. Reading is public.

```text
/reports?building=HH5&floor=G&category=Male
```

### `POST /reports`

Records or replaces the anonymous browser's active vote. A valid HH5 location
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

Both endpoints return a summary with the latest vote, `yesCount`, `noCount`,
`reportedAt`, and `expiresAt`. An empty location has `available: null`.

Health probes are available at `/health/live` and `/health/ready`.

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
