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

Browser tracing is useful for user-visible operations, but it is not a substitute
for server telemetry. Fastify emits structured logs and request IDs, exposes RED
and process metrics at `/metrics`, and checks database readiness. Database spans,
dashboards and SLO alerts remain future work.

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
- R2, links, slugs, redirects and CSV export are deliberately absent.

## Next backend increment

1. Confirm the anonymous-client and duplicate-vote policy with the product owner.
2. Add PostgreSQL integration tests and run the full stack in staging.
3. Propagate W3C trace context from browser to server.
4. Add dashboards, alerts, rollback and incident runbooks.
5. Schedule the implemented retention job in the hosting platform.

## Quality gates

- TypeScript strict mode and Biome.
- Dependency Cruiser architecture contracts.
- Knip unused file/export/dependency detection.
- Vitest unit tests with 85% minimum business-layer coverage.
- Stryker mutation score with a 70% break threshold.
- Playwright desktop/mobile integration E2E tests.
- Codecov upload and GitHub Actions gates.
- Conventional Commit validation on pull requests.
