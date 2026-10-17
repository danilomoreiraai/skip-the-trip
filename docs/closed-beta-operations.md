# Closed-beta operations playbook

Use this checklist for a short, supervised Skip The Trip beta session. Danilo
Moreira is both the session operator and the incident decision owner: he starts
and ends the session, monitors it, acknowledges alerts, and decides whether to
pause, roll back, or resume. Do not start a session without him available for
the full window. Record the session window in Europe/Dublin time and evidence
timestamps in UTC.

The existing [incident response](incident-response.md),
[deployment and release verification](easypanel.md#5-verification),
[backup and recovery](backup-recovery.md), and
[privacy governance](privacy-governance.md) runbooks remain authoritative for
their respective actions. This playbook joins those actions into one session
procedure; it does not change alert thresholds, backup schedules, retention
jobs, or production configuration.

## 1. Before inviting participants

1. Set the start and end time, participant group, operator, and a reachable
   private escalation route. Prefer Monday–Friday, 06:00–18:00 Europe/Dublin,
   when Alertmanager and backup-monitor deliver Telegram notifications. If the
   session must run outside that window, Danilo must inspect EasyPanel service
   status, public probes, Prometheus alerts, backup-monitor status, and both
   mailboxes at the start and at least every 10 minutes. Stop immediately if
   he cannot maintain that watch: detection continues but Telegram delivery is
   deferred until the next delivery window.
2. In EasyPanel, confirm the approved source SHA and successful deployment,
   completed `migrate` task, healthy web/API/PostgreSQL/Prometheus/Alertmanager/
   backup-monitor/retention-scheduler services, and no unresolved critical
   alert. Check the latest completed backup in the Backups Log and private remote
   storage, its age against the 24-hour RPO, and the most recent isolated
   restore-drill record. A started backup is not a completed backup. Do not
   restore or run a destructive drill in production for this preflight.
3. Set `APP_REVISION` in the operator shell to the approved deployed SHA and run
   `VERIFY_BASE_URL=https://skipthetrip.info node scripts/verify-release.mjs`.
   Confirm `/privacy` opens on the public site and links to the current live
   notice. Make one representative read-only app check. Check that production
   location settings match the approved beta venue before inviting anyone;
   do not publish exact coordinates in evidence.
4. Record the deployed SHA and a **previously deployed, verified, migration-
   compatible** rollback SHA with its EasyPanel history entry. Inspect the
   saved Compose environment for that release privately. The last verified
   candidate at the 17 October 2026 tabletop was
   `0a969bae112aa648d0c5a00605443c7fcb7d73db` (issue #39). Do not use it
   blindly after later migrations or configuration changes. If no compatible
   rollback is available, do not start the beta.
5. Open and monitor `support@skipthetrip.info` and
   `privacy@skipthetrip.info`. Check inbound access and notifications before
   starting; do not send a test containing participant data. Record only a
   pass/fail and timestamp in the session log. Privacy requests follow the
   [rights workflow](privacy-governance.md#rights-request-workflow).
6. Send the participant wording below with the session window, then record
   start time and release in the private session log. Keep participant contact
   details out of GitHub.

> This is a short, supervised test of Skip The Trip, not an emergency service.
> If something fails, stop using it and email support@skipthetrip.info with
> what you tried, device/OS/browser, approximate time, and what happened. Do
> not send your exact location, cookies, identifiers, credentials, or raw logs.
> For privacy questions or deletion requests, email privacy@skipthetrip.info.
> Read the live privacy notice at https://skipthetrip.info/privacy before
> participating. We may stop the test while we investigate or recover.

## 2. During the session

- Danilo watches the operations Telegram chat, Prometheus/Grafana health and
  alerts, EasyPanel service state, public health/readiness, and both mailboxes.
  Check at start, after a release or configuration change, after any alert or
  participant report, and at least every 30 minutes during the staffed
  delivery window. Apply the 10-minute direct-watch interval outside it.
- Acknowledge a critical alert within 10 minutes and a warning within 30
  minutes using the [incident response procedure](incident-response.md#first-response).
  Danilo owns the stop/continue decision for every alert. If he cannot
  acknowledge within the required window or determine safe operation, stop
  the beta; do not wait for a deferred notification. A missing alert feed is
  itself a stop condition. Do not silence an alert just to continue a session.
- Read support and privacy mail during each monitoring pass and at shutdown.
  Acknowledge a participant report during the staffed session when practical,
  give a safe workaround only after confirming it, and tell affected
  participants when a session is paused or ended. Route privacy requests
  privately to the rights workflow; do not copy them into an issue.
- Capture only release SHA, approximate UTC time, task attempted, device/OS/
  browser, expected and observed behavior, severity, owner, and retest need.
  Request a screenshot only if it can be cropped or redacted safely. Do not put
  exact coordinates, cookies, anonymous IDs, credentials, private contact
  details, raw logs, or backup contents in Telegram, issues, or PRs. Use the
  feedback and triage workflow in [issue #34](https://github.com/danilomoreiraai/skip-the-trip/issues/34)
  when available; until then, use the monitored support mailbox and create a
  sanitized GitHub issue for each accepted code or configuration change.

## 3. Stop, recover, and decide whether to resume

Stop inviting participants and announce a pause for any suspected privacy or
security exposure, data corruption or unexpected deletion, unavailable public
app/API/readiness, failed location authorization at the approved venue, missing
monitoring or mailbox coverage, backup older than the 24-hour RPO, or a critical
journey blocked on a supported device. A critical alert or P0/P1 participant
report also stops the beta pending investigation. For a warning or recoverable
P2/P3 issue, Danilo records the evidence, checks scope and trend, and makes an
explicit stop/continue decision. A continue decision never overrides the stop
conditions above.

1. Record UTC time, release, symptom, affected scope, and decision. Tell
   participants the beta is paused through the agreed contact route. Follow
   the relevant [incident procedure](incident-response.md); contain a privacy
   or database event before considering an application rollback.
2. If a newly deployed application revision caused the failure, confirm the
   recorded known-good SHA, its deployment/image provenance and migration
   compatibility. In EasyPanel, select that source revision and its recorded
   Compose environment, set `APP_REVISION` to the same SHA, and deploy. Check
   the completed migration task and healthy containers in deployment history.
   Do not select an unverified Git parent merely because it is older.
3. Run the public release verifier against the rollback SHA. Then require two
   successful public `/api/health/ready` checks, healthy Prometheus target and
   resolved alert, plus a representative read-only app flow. Verify the
   affected behavior with an approved device if the incident involved
   geolocation or accessibility. Record the EasyPanel entry and public result
   without sensitive payloads.
4. If data loss or a failed migration is suspected, stop writes and use the
   [backup and recovery runbook](backup-recovery.md#production-recovery). An
   application rollback is not a database restore. Restore in isolation first;
   any production data switch is a separate incident decision.
5. Danilo resumes only after the root cause or safe containment is understood,
   the stop condition is cleared, monitoring and mailboxes are working, and
   the affected flow is retested. Otherwise end the session and track the
   defect. Record the decision and notify participants.

## 4. End the session and clear beta material

1. Stop invitations, check unresolved alerts and both mailboxes, and tell
   participants the session is over. Record end time, release, counts of
   reports by severity, decisions, and links to sanitized follow-up issues.
2. Confirm public health/readiness, monitoring, backup recency, and the
   retention-scheduler's latest privacy-safe success event. Hand any open
   incident to the [incident response runbook](incident-response.md) with a
   named owner; a session ending does not close an incident.
3. Keep raw feedback in the monitored mailbox only while needed to answer and
   investigate it. Within 30 days after closing the beta, review and delete
   resolved beta feedback and participant contact lists, unless an active
   rights request, incident, or legal obligation requires a documented hold.
   Keep sanitized issue summaries and operational decisions without contact
   details. Application reports, authorization rows, metrics, backups, and
   email rights requests follow their existing
   [retention rules](privacy-governance.md#processing-inventory); do not
   manually purge the production database as beta cleanup.

## Promotion boundary and session record

[Issue #1](https://github.com/danilomoreiraai/skip-the-trip/issues/1) remains
open for Analytics completion and production evidence. A supervised beta may run
without relying on visit counts; analytics must remain consent-gated. [Issue
#22](https://github.com/danilomoreiraai/skip-the-trip/issues/22) tracks the
remaining privacy/legal review. The published notice and monitored privacy
mailbox are required even for this beta. Resolve #22 and the final beta gates
before wider public promotion; do not present the legal review as complete.

Keep the session log privately. A GitHub closure note may contain only the
redacted fields below, with links to CI and provider history rather than
credentials or screenshots containing participant data:

| Field | Record |
| --- | --- |
| Window, operator, incident decision owner | Europe/Dublin start/end; Danilo Moreira; Danilo Moreira |
| Approved release and rollback | Full SHA of each; rollback compatibility and history checked |
| Preflight | Public verifier; services/alerts; latest completed backup and restore-drill record; both mailboxes; live `/privacy` |
| Monitoring | UTC check times; alert name/severity; acknowledgement; stop/continue decision |
| Recovery | Pause time; deployed SHA; migration/container state; two readiness checks; alert resolution; affected-flow retest |
| Shutdown | End time; unresolved incidents and owners; privacy-safe retention/backup status; feedback deletion review date |

## Tabletop dry run — 17 October 2026

This rehearsal did not invite participants, send an alert, restore data, change
production configuration, or deploy a rollback.

- **Observed:** `main` and the public web/API release endpoints reported
  `c69c26a1e39f0faa1965a8d48d2c51e929ff2ebf`. Its merge-commit
  [Quality run](https://github.com/danilomoreiraai/skip-the-trip/actions/runs/38992257679)
  passed. The read-only release verifier passed web/API revision, web/API
  liveness, and API readiness; public `/privacy` returned HTTP 200.
- **Rollback candidate:** `0a969bae112aa648d0c5a00605443c7fcb7d73db`
  had a successful [Quality run](https://github.com/danilomoreiraai/skip-the-trip/actions/runs/38633882774)
  and a previously verified production deployment recorded in
  [issue #39](https://github.com/danilomoreiraai/skip-the-trip/issues/39).
  EasyPanel history, saved environment, and migration compatibility must be
  checked again at the actual session preflight.
- **Simulated decision:** a critical API alert at session start means Danilo
  acknowledges within 10 minutes, pauses the beta, checks the incident
  runbook, and selects rollback only if a release is implicated. The session
  does not resume until the public verifier, two readiness checks, alert
  resolution, and affected-flow retest pass.
- **Still required before a real session:** inspect current EasyPanel service
  and backup status plus the last isolated restore record, verify both mailbox
  notifications, confirm the venue configuration, and record the actual
  rollback revision. No claim of a live alert-delivery or rollback drill is
  made by this tabletop.
