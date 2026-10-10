# Production alerting and incident response

This runbook covers the production Prometheus alerts routed by Alertmanager to
the Skip The Trip operations Telegram chat. The operations owner is the primary
responder. Critical alerts require acknowledgement within 10 minutes; warning
alerts within 30 minutes. If the primary responder does not acknowledge in that
window, contact the project owner directly and treat the incident as escalated.

Do not paste database URLs, tokens, exact user locations, client identifiers or
report records into Telegram, issues or incident notes.

## First response

1. Acknowledge the alert in the operations chat with the alert name, UTC time
   and responder name.
2. Open the EasyPanel service and inspect recent deployment state and
   privacy-safe logs. Correlate the alert start time with releases or
   configuration changes.
3. For a critical alert, pause non-incident deployments until recovery is
   verified. For a warning, investigate before it becomes user-visible.
4. Record the diagnosis, action, recovery evidence and follow-up issue. Never
   include secrets or personal data.

## API or metrics unavailable

Applies to `SkipTheTripApiDown` and `SkipTheTripMetricsMissing`.

- Check `https://skipthetrip.info/api/health/live`, then `/api/health/ready`.
- Inspect `server`, `prometheus` and reverse-proxy health and logs. A healthy
  public API with missing metrics indicates scrape networking or Prometheus,
  not necessarily an application outage.
- Roll back the latest application or monitoring deployment if its timing
  matches the failure. Otherwise restart only the unhealthy service after
  preserving relevant logs.
- Recovery requires two successful public health requests, a healthy Prometheus
  target, a resolved alert and one representative API read.

Expected false positives: a deliberate restart can breach the two-minute API
threshold; Prometheus maintenance longer than five minutes can trigger missing
metrics. Announce planned maintenance and use only bounded silences.

## Database unavailable

Applies to `SkipTheTripDatabaseUnavailable`.

- Check native PostgreSQL health, storage, connection count and readiness logs.
  Do not expose `DATABASE_URL` in incident notes.
- If a migration immediately preceded the alert, stop further deployments and
  use its documented backward path. For suspected data loss or corruption,
  follow [the backup and recovery runbook](backup-recovery.md) and restore to an
  isolated database before changing production.
- Recovery requires `/api/health/ready` to return HTTP 200 twice, the database
  metric to remain `1`, the alert to resolve and a representative read to work.

Expected false positives: a short managed PostgreSQL restart should not fire
because the rule waits two minutes. Longer planned maintenance will fire unless
covered by a bounded maintenance silence.

## High error rate

Applies to `SkipTheTripHighErrorRate`: more than 2% 5xx responses over five
minutes, sustained for five minutes.

- Break down `skip_the_trip_http_requests_total` by route and status code, then
  inspect matching server errors and the current release in EasyPanel.
- Roll back when errors started with a release. If one dependency is failing,
  contain the dependency or disable only the affected path when safe.
- Recovery requires the five-minute ratio below 2%, a resolved alert, healthy
  probes and a successful affected user flow.

Expected false positives: at very low traffic a small number of 5xx responses
can exceed 2%; validate absolute request and error counts before escalation.

## High latency

Applies to `SkipTheTripHighLatency`: p95 exceeds 500 ms over five minutes,
sustained for five minutes.

- Compare latency with request volume, database health, resource saturation and
  the current release. Identify the affected route before changing capacity.
- Roll back a correlated release. For capacity pressure, scale the constrained
  service conservatively and preserve logs for follow-up analysis.
- Recovery requires p95 below 500 ms for ten minutes, a resolved alert and a
  successful representative read and vote from staging or an approved test.

Expected false positives: sparse traffic makes percentiles noisy and batch
operations can create brief spikes; the five-minute hold reduces both cases.

## Geolocation failure anomaly

Applies to `SkipTheTripGeolocationFailureAnomaly`: more than 20 privacy-safe
failure events in 15 minutes, sustained for 10 minutes.

- Compare failures by the closed `category` and `context` labels. Never request
  or record coordinates to diagnose this alert.
- Check browser/platform release notes, the public HTTPS origin, permission UX
  and the latest web release. A single category spike can narrow the cause.
- Roll back a correlated web release. Do not widen the location radius or relax
  accuracy requirements as an incident shortcut.
- Recovery requires the 15-minute count below 20, a resolved alert and a
  successful approved-device authorization check near the configured venue.

Expected false positives: events, demos or repeated permission denial can
create a traffic-driven spike without a defect. Check traffic and category
distribution before rollback. Revisit the threshold after four weeks of data.

## Controlled delivery test

CI sends only the synthetic `SkipTheTripNotificationTest` alert to an isolated
webhook receiver and verifies its HTTP acknowledgement. It does not page
production.

After deploying notification configuration, test the owned Telegram contact
point during a pre-announced maintenance window:

1. Post a synthetic `SkipTheTripNotificationTest` alert to the internal
   Alertmanager `/api/v2/alerts` endpoint with `severity=info`,
   `owner=operations`, and an end time five minutes in the future.
2. The operations owner acknowledges receipt in Telegram. Record time sent,
   time received and responder in the deployment record; do not record tokens.
3. Confirm a resolved notification arrives after the alert end time. If either
   notification fails, keep the issue open and inspect Alertmanager before retry.

Run this test after contact-point changes and at least quarterly. Do not stop an
application or database service to test delivery.

## Rollback and post-incident

Prefer EasyPanel's last known-good application image/configuration. Monitoring
rollback means restoring the last known-good Prometheus rules and Alertmanager
configuration together, then confirming routing with a controlled test. Never
overwrite production with a database backup; restore in isolation first.

After recovery, capture a UTC timeline, impact, trigger, contributing factors,
detection quality, actions and durable follow-ups. Create a GitHub issue for
every code or configuration change. Document reasons and before/after values
for threshold changes.
