# Closed-beta operations playbook

## Scope and owner

As agreed on 18 October 2026 in [#45](https://github.com/danilomoreiraai/skip-the-trip/issues/45),
Danilo Moreira shares the application link in a group. People choose whether to
participate spontaneously. There is no registration, participant roster, minimum
headcount, supervised session, or mandatory device/OS/browser collection. This is
an experimental portfolio application; functional quality and privacy remain
required. HH5 contribution restrictions remain unchanged. Sharing in a group is
a distribution choice, not an access-control boundary: the public link can be forwarded.

Danilo owns feedback review and pause/resume decisions. Record the distribution
date and a next review date in Europe/Dublin time in #35; use UTC for technical
evidence. No review date is assumed until recorded. This does not promise continuous
staffing or an immediate support response. Existing service monitoring, alerts,
backup, retention and incident controls remain in place.

The [incident response](incident-response.md), [release verification](easypanel.md#5-verification),
[backup and recovery](backup-recovery.md), and [privacy governance](privacy-governance.md)
runbooks remain authoritative for their controls.

## 1. Before sharing the link

- Record the approved deployed SHA, green CI, successful provider deployment and
  migration/container health. Run `APP_REVISION=<approved-full-sha> VERIFY_BASE_URL=https://skipthetrip.info node scripts/verify-release.mjs`.
- Check public lookup, consent accept/decline and persistence, privacy/support
  links, and core loading/error/retry behavior. Use existing automated coverage
  and focused manual checks. Record the method and revision for each result.
- Check existing geolocation authorization, cooldown, freshness, idempotency and
  persistence coverage. Record real GPS/permission and assistive-technology
  checks only if performed. Untested platforms remain **not verified**, without
  requiring a participant/device matrix or task-completion percentages.
- Check current alerts, backup recency against the existing 24-hour RPO,
  retention status, mailbox access and a known-good migration-compatible rollback
  revision in provider history. No destructive production drill is required.
- Record known limitations and the decision in #35. Any known P0/P1 or material
  privacy/data-integrity concern blocks sharing. Missing device evidence alone
  is an explicit coverage limitation, not a passed test or automatic blocker.
- Share the short notice below through the group when the owner decides to open
  the beta. Procedure preparation does not prove that the notice was sent.

> Skip The Trip is an experimental portfolio app. Participation is optional:
> you can try it without registering or telling me who you are or which device
> you use. Contributions require being within the permitted HH5 area. If a
> feature fails, you can optionally email support@skipthetrip.info with what
> you tried and what happened. Device details are optional. Please do not send
> exact location, cookies, identifiers, credentials or raw logs. Support is
> reviewed periodically. Privacy information: https://skipthetrip.info/privacy;
> privacy requests: privacy@skipthetrip.info. The experiment may be paused.

## 2. Feedback and review

Use [the feedback template and triage rubric](beta-feedback.md). Keep support
feedback in `support@skipthetrip.info`; do not require reports in the group or
identify silent participants. Privacy requests stay in `privacy@skipthetrip.info`
and follow the existing rights workflow. Email is voluntary and can reveal the
sender's address; never promise anonymous email feedback.

Review both mailboxes and existing monitoring at each recorded review, after a
release, and when an alert or serious report is received. Existing incident alert
acknowledgement targets remain unchanged. Telegram notifications currently use
Monday–Friday, 06:00–18:00 Europe/Dublin; alerts outside that window may be
notified later. Do not promise real-time supervision. Check public health and
current alerts before further sharing after an unreviewed interval.

Track accepted defects with release, severity, owner, expected/observed behavior
and retest requirement. Device context is optional and may be recorded as unknown.
No feedback is not evidence of successful use, zero defects or participant counts.

## 3. Pause, recover and resume

P0/P1 findings, suspected coordinate exposure, vote loss/duplication,
cross-bathroom cooldown contamination, recurring 5xx/readiness failure or missing
recovery controls require pausing the experiment pending investigation. Stop
inviting use and post a pause notice in the same group. This does not revoke
existing links or disable writes; if technical containment is needed, follow the
incident runbook and record the action. Do not claim a pause notice stops access.

- Record UTC time, release, symptom, scope and decision without participant data.
- Follow the incident runbook; contain a privacy/database event before considering
  application rollback. Use only a previously deployed, verified, migration-compatible
  revision and its saved environment. Check provider deployment, migration and
  container health, then run the public release verifier for that SHA.
- Require two successful readiness checks, resolved relevant alerts, and a focused
  retest of the failure before resuming. An application rollback is not a database
  restore; use the backup runbook for data recovery.
- Record the outcome and announce resumption or termination in the same group.
  P2/P3 may remain with an owner, mitigation and planned retest/review date.

## 4. Review, end and retention

At the recorded review date, inspect functionality, optional feedback, open
defects and existing operational health. Record continue/pause/end with evidence
in #35. Do not invent participation totals, device coverage or completion rates.
If ending, post a notice in the group and hand unresolved incidents to their owner.

Keep raw feedback only while needed to respond and investigate. Within 30 days
after closing the beta, review and delete resolved beta feedback, unless an active
rights request, incident or legal obligation requires a documented hold. Do not
create participant contact lists. Retain sanitized issue summaries without contact
details. Application data, backups and rights requests follow their existing
[retention rules](privacy-governance.md#processing-inventory).

## Promotion boundary and evidence

#1 remains open for consented analytics collection evidence; analytics is not a
required measure of participation. #22 retains its privacy/legal review scope.
This experimental beta does not certify commercial, broad public-launch, legal
or complete accessibility readiness. The live notice and privacy contact remain
required. A concrete privacy concern blocks the experiment regardless of its size.

Record revision, CI/provider/public checks, manual/automated results, known
unverified coverage, defect links, owner and next review date. Repository procedures
are not proof of mailbox checks, real-device tests, group notification or actual
participation. The record below describes the earlier supervised-session plan;
it is historical evidence, not the current beta procedure.

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
