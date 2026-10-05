# Staging runbook

The staging stack contains PostgreSQL 17, a one-shot migration task, the
Fastify API, and the React SPA served by Nginx. Nginx proxies `/api/*` to the
API, so the browser uses a same-origin connection.

## Start

```sh
cp .env.staging.example .env.staging
# Replace POSTGRES_PASSWORD with a long URL-safe secret.
docker compose --env-file .env.staging -f compose.staging.yml up --build -d
docker compose --env-file .env.staging -f compose.staging.yml ps
```

The web app is available at `http://localhost:8080` by default. The API is not
published directly; use `http://localhost:8080/api/health/ready` through the
proxy.

## Verify

```sh
node scripts/smoke-staging.mjs
```

For a remote deployment:

```sh
SMOKE_BASE_URL=https://staging.example.com/api node scripts/smoke-staging.mjs
```

The smoke test checks database readiness, reads a location, creates a vote,
retries the same idempotency key, and verifies read-after-write consistency.

Run the PostgreSQL repository integration suite inside the stack:

```sh
docker compose --env-file .env.staging -f compose.staging.yml \
  --profile test run --rm integration
```

Prometheus-format process and RED metrics are available at `/api/metrics`.

## Monitoring

Start the provisioned Prometheus and Grafana services:

```sh
docker compose --env-file .env.staging -f compose.staging.yml \
  --profile monitoring up -d --wait
```

- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3000`
- Grafana login: `admin` and the `GRAFANA_ADMIN_PASSWORD` value

Grafana provisions the Prometheus data source and the **Skip The Trip API
Overview** dashboard automatically. Prometheus loads alerts for API
availability, 5xx rate, p95 latency, database readiness and missing metrics.
Notification delivery still requires a contact point such as email, Slack or
PagerDuty.

## GlitchTip error tracking and uptime

Create two GlitchTip projects, one using the React platform and one using the
Node.js platform. Add their DSNs to `.env.staging`:

```dotenv
GLITCHTIP_WEB_DSN=https://public-key@your-glitchtip.example/1
GLITCHTIP_SERVER_DSN=https://public-key@your-glitchtip.example/2
APP_RELEASE=your-release-id
```

Rebuild the application services so the browser DSN is embedded in the static
bundle and the server DSN is injected at runtime:

```sh
docker compose --env-file .env.staging -f compose.staging.yml \
  up --build -d --wait server web
```

The browser captures React rendering failures, rejected promises and explicitly
reported request failures. The server reports unexpected 5xx errors with only
the request ID and route template as context. Default PII collection and
GlitchTip-incompatible session tracking are disabled.

For uptime monitoring, create a GlitchTip GET monitor for the externally
reachable `https://your-host/api/health/ready` URL, expect HTTP 200 and associate
it with a project that has email or webhook alerts enabled. A hosted GlitchTip
instance cannot reach this stack through `localhost`; use the deployed public
URL or a GlitchTip instance on a network that can reach the application.

## Retention

Run the retention job manually with:

```sh
docker compose --env-file .env.staging -f compose.staging.yml \
  --profile operations run --rm retention
```

In a hosted environment, schedule that command daily. Reports older than
`REPORT_RETENTION_DAYS` are removed; the default is 30 days.

## Operate

```sh
docker compose --env-file .env.staging -f compose.staging.yml logs -f server web
docker compose --env-file .env.staging -f compose.staging.yml restart server web
docker compose --env-file .env.staging -f compose.staging.yml down
```

Do not add `-v` to `down` unless deleting the staging database is intentional.
Backups, TLS, managed secrets, alert notification delivery and automated
retention scheduling remain required before this topology is used as
production.
