# Privacy governance

This record supports the public privacy notice for Skip The Trip. The project is
a personal educational and portfolio demonstration operated by Danilo Moreira
in Ireland. Danilo Moreira is the data controller and monitors
`privacy@skipthetrip.info`; `support@skipthetrip.info` is the general support
channel.

The privacy mailbox became operational on 11 October 2026. Inbound and outbound
delivery, SPF, DKIM and DMARC were verified with independent Gmail accounts.
Mailbox notifications are enabled. The address configuration and non-sensitive
evidence are tracked in GitHub issue #25.

## Processing inventory

| Activity | Data | Purpose and basis | Recipients | Retention and deletion |
| --- | --- | --- | --- | --- |
| Anonymous browser identity | Random UUID in an HttpOnly, SameSite=Lax cookie | Voting continuity, cooldown enforcement and duplicate-vote resistance; legitimate interests in operating and securing the demonstration | Application API and PostgreSQL | Cookie expires after 30 days; linked records follow the applicable table retention |
| Vote submission | Building, floor, bathroom category, Yes/No value, anonymous UUID, idempotency key and timestamps | Display recent aggregated availability and preserve vote integrity; legitimate interests | Application API, PostgreSQL and protected backups | A vote affects availability for 30 minutes; operational data is deleted by the scheduled 30-day retention process |
| Location verification | Latitude, longitude and accuracy in request memory; anonymous UUID, location ID, verification and expiry timestamps in the authorization table | Restrict voting to visitors near HH5; legitimate interests in demonstration integrity | Application API and PostgreSQL for the authorization result only | Coordinates are discarded after the request and are never persisted; authorization expires after four hours and is deleted by the next scheduled retention run |
| Geolocation failure monitoring | Enumerated failure category and browser or standalone context | Diagnose reliability without collecting coordinates or identifiers; legitimate interests | Application API and Prometheus | Production Prometheus retention is 30 days |
| Optional analytics | Page URL, path, title and provider-generated technical metadata | Count visits and understand use; consent | Google Analytics | Disabled until consent; provider/property retention must remain documented in the production configuration |
| Error and trace diagnostics | Technical error, release, environment, route/request metadata and sampled spans | Reliability, security and incident response; legitimate interests | Configured Sentry-compatible/GlitchTip and OpenTelemetry providers | Disabled when not configured; production provider retention must be reviewed after configuration changes |
| Infrastructure logs and alerts | Health, request, scheduler and alert metadata | Availability, security and incident response; legitimate interests | Hosting stack, Prometheus, Alertmanager and Telegram | Application logs follow hosting configuration; Prometheus retains 30 days; alert content excludes coordinates, identifiers and report records |
| Backups | Encrypted database backup | Disaster recovery; legitimate interests | Configured object-storage provider, currently Cloudflare R2 where enabled | Provider lifecycle must match the production backup policy; restore access is restricted |
| Contact email | Sender address, message content and response history | Answer support and privacy requests; legal obligations and legitimate interests | Apple iCloud; GoDaddy receives aggregate DMARC authentication reports | Retain only as long as needed to resolve and evidence the request, subject to applicable legal requirements |

Pseudonymous identifiers can still be personal data. No data in this inventory is
described as anonymous unless re-identification is no longer reasonably possible.

## Coordinate exclusion controls

- The location route validates coordinates, makes the proximity decision in
  memory and writes only the authorization result.
- Application tables contain no latitude, longitude or accuracy columns.
- Geolocation failure events use a strict schema that rejects extra coordinate
  fields.
- Metrics use only predefined failure category and client-context labels.
- Error reporting disables default user, cookie, header, body and query-string
  collection; callers must not attach location readings to diagnostics.
- Logs, traces, alerts and issue evidence must never contain exact user
  coordinates.

## Rights request workflow

1. Acknowledge a message sent to `privacy@skipthetrip.info` within three business
   days when practical.
2. Classify the request and ask only for information reasonably necessary to
   locate the relevant record and avoid affecting another person.
3. Do not request passwords, precise location history or identity documents by
   default. Explain any exceptional verification request.
4. Search or act using the anonymous identifier when it is available. Because
   there are no accounts, explain when a record cannot be reliably linked to the
   requester.
5. Complete valid requests within the applicable legal deadline and record only
   the request type, dates, decision and completion state needed for
   accountability.
6. Direct dissatisfied requesters to the Irish Data Protection Commission.

Clearing browser data removes the local cookie, selection and analytics
preference. It does not itself remove records already received by the API.

## Analytics consent

Google Analytics is not initialized without an affirmative choice. Accepting
loads the configured tag with Google Signals and advertising personalization
disabled. Declining or withdrawing prevents future page-view events from the
browser; it cannot recall an event already received by Google. The privacy page
keeps both choices available.

## Review and change control

- Review this inventory and the public notice whenever a provider, collected
  field, retention period, purpose or launch audience changes.
- New advertising, profiling, session replay, accounts or precise-location
  persistence require a separate GitHub issue and privacy review before use.
- Confirm the production state and retention of optional diagnostics rather than
  inferring it from dormant code paths.
- Do not publish credentials, DSNs, Apple Account details, backup contents or
  private legal advice as evidence.

## Temporary experiment scope — 20 October 2026

The owner has limited this workstream to a temporary experimental portfolio app
for a selected group whose members agree to participate. Independent legal review
and preparation for wider public promotion are removed from the project's
acceptance and issue-closure criteria. This records a scope decision, not a
completed legal review or a legal exemption.

Issue #22 retains technical checks of the processing inventory, published notice,
provider configuration and retention evidence. Existing consent choices, contact
and rights workflows, data minimization, retention and security controls remain
in place. Agreement to participate does not replace the app's analytics choice.
The existing public URL remains forwardable; no access restriction is introduced.

The owner intends to deactivate the app after the experiment. No date is defined
and no shutdown, deletion or reminder is scheduled. When shutdown is planned,
record its date and data/backup disposition under the existing retention rules.
