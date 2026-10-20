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

## Cleaner operations (default disabled)

Individual staff access uses an operator-provided alias and a one-use invitation that expires after 24 hours. Only SHA-256 hashes of invitations and session credentials are stored. Sessions expire after eight hours and can be revoked individually by the operator; public responses display only team attribution, never the staff alias or identity. Staff access is scoped to HH5.

Cleaning cycles and idempotent command audit contain bathroom identity, staff ID, action and timestamps, and follow the configured 30-day retention. Expired invitations/sessions are removed on the scheduled retention run. Revoked staff identities are removed after the retention period. Active staff identities remain restricted operational records until revoked. No staff geolocation is collected. The operator must distribute invitations privately and keep credentials out of logs, screenshots and support messages.

## Optional favorite cleaning notifications (default disabled)

An explicit browser favorite stays in local storage. Enabling notifications separately requests browser permission and creates a dedicated HttpOnly/SameSite=Strict push-owner cookie, independent of vote identity and analytics. The API stores its hash, favorite bathroom, encrypted subscription endpoint/keys, timestamps and expiry. Endpoints and keys are encrypted with AES-256-GCM using a deployment key kept outside the database. The application sends encrypted Web Push through the supported browser providers (Google, Mozilla and Apple).

Subscriptions expire after 30 days without renewal and are removed by retention or after provider 404/410 responses. Turning notifications off deletes the server subscription immediately and asks the browser to unsubscribe. Removing/changing the favorite updates notification preferences while the app is open. Clearing browser storage alone cannot prove immediate deletion of previously received server records; expiration and invalid-subscription cleanup still apply. Browser/system permissions remain independently manageable.

Only new team cleaning cycles enqueue notification events; extensions and community votes do not. Events and delivery bookkeeping contain cycle/subscription IDs and bounded state/timestamps and follow the existing 30-day cycle retention. Push payloads include bathroom identity and cycle times, never cleaner identity or coordinates. Staff and push activation each require a separate configuration decision; no production subscriptions or keys were created by implementation.

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

## Legal review status

The technical inventory and controller decisions are recorded, but independent
legal review for the intended Ireland/EEA launch remains pending under GitHub
issue #22. Wider public promotion must not treat that review as complete until
the reviewer, date, reviewed revision, jurisdictional scope and blocking
findings are recorded.
