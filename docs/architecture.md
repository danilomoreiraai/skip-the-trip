# System design

## Current release surface

Skip The Trip has a React SPA and a Fastify API backed by PostgreSQL. The web
app uses the reports HTTP interface through a validated API adapter.
The API validates votes, stores them idempotently, aggregates a configurable
freshness window, and exposes liveness/readiness probes and rate limiting.

## Module seams

```text
UI (components/pages)
        ↓
Application composition (App)
        ↓
Services (HTTP adapter) → Observability adapter
        ↓                         ↓
Domain rules              Sentry + OpenTelemetry/OTLP
```

- `domain/` owns invariants and has no inward dependencies.
- `services/` owns persistence and may use domain rules and shared libraries.
- `components/` and `pages/` render state but do not access storage directly.
- `lib/observability.ts` is the vendor seam. Callers do not import Sentry or OpenTelemetry.
- Dependency Cruiser enforces these rules in CI.

## Observability

The Sentry-compatible SDK sends uncaught exceptions and React rendering failures
to Sentry or GlitchTip. The API sends unexpected 5xx errors with request ID and
route metadata only. OpenTelemetry emits vendor-neutral browser spans through
OTLP. The collector can route traces to Datadog, New Relic, Grafana Tempo,
Honeycomb, or another compatible backend. Telemetry is disabled when its
environment variables are absent, default PII collection is disabled and report
payloads are never attached to error events.

Browser operations inject W3C `traceparent`/`tracestate` headers. Nginx forwards
them unchanged, Fastify continues the trace, and repository boundaries create
PostgreSQL child spans. HTTP spans contain only method, route template, status,
and request ID; database spans contain only the database system and a bounded
operation name. Query strings, SQL text/values, coordinates, bathroom choices,
cookies, identities, arbitrary headers, and bodies are never attached.

Both browser and server export are independently disabled when their OTLP
endpoint is absent. Fastify also emits structured logs and request IDs, exposes RED
and process metrics at `/metrics`, and checks database readiness. Prometheus and
Grafana are provisioned with API health, latency, error, database and privacy-safe
geolocation failure panels. Alert rules exist; production delivery and response
runbooks are tracked in
[#21](https://github.com/danilomoreiraai/skip-the-trip/issues/21). Server and
database trace propagation is implemented by
[#23](https://github.com/danilomoreiraai/skip-the-trip/issues/23).

## Backend module seams

```text
HTTP routes (thin controllers)
        ↓
Functions (create/get report)
        ↓
Reports repository interface
        ↓
Drizzle PostgreSQL adapter
```

- The HTTP interface is `GET /reports` and `POST /reports`.
- The reports repository is the persistence seam used by production and tests.
- An idempotency key prevents a network retry from counting the same vote twice.
- Only reports inside `REPORT_WINDOW_MINUTES` contribute to the returned status.
- Repeated votes from the same installation and bathroom are rejected for
  `VOTE_COOLDOWN_SECONDS` (300 seconds by default).
- The retention function coordinates the reports and location-authorization
  repository interfaces. It applies the configured report cutoff, deletes
  expired location authorizations, and returns privacy-safe counts by record
  type for scheduler logs.
- R2, links, slugs, redirects and CSV export are deliberately absent.

## Operational backlog

The anonymous identity and duplicate-vote policy, PostgreSQL integration suite,
containerized staging stack, dashboards and alert rules are implemented. The
remaining backend and operational work is intentionally issue-driven:

1. [#19](https://github.com/danilomoreiraai/skip-the-trip/issues/19) — verify encrypted production backups and restoration.
2. [#21](https://github.com/danilomoreiraai/skip-the-trip/issues/21) — configure alert delivery and incident runbooks.

## Quality gates

- TypeScript strict mode and Biome.
- Dependency Cruiser architecture contracts.
- Knip unused file/export/dependency detection.
- Vitest unit tests with 85% minimum business-layer coverage.
- Stryker mutation score with a 70% break threshold.
- Playwright desktop/mobile integration E2E tests.
- Codecov upload and GitHub Actions gates.
- Conventional Commit validation on pull requests.
