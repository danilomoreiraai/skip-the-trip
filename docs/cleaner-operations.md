# Cleaner operations (#60)

`STAFF_ENABLED=false` is the default. Before activation, designate the operator, confirm the supported HH5 bathrooms and privately onboard cleaners. Activation is a separate configuration change; this implementation does not create live credentials.

## Operator commands

Use the API container private terminal, not a shared log collector:

- `npm run staff:admin:prod -- invite cleaner-alias` creates an individual HH5 invitation valid for 24 hours. Supply the code privately; the cleaner enters it at `/staff`. Record the returned staff ID in private operations records for revocation. Never paste the code into a URL, issue, screenshot or chat.
- `npm run staff:admin:prod -- revoke <staff-id>` immediately revokes all sessions and remaining invitations for that identity. It does not silently end an ongoing cleaning cycle; another authorized cleaner can end it, or its estimate expires.

Development uses `npm run staff:admin -- ...` with a non-production DATABASE_URL. A new invitation is needed after the eight-hour session expires. No passwords, email provider or corporate identity provider is required.

## Behavior and recovery

Start with 15 or 30 minutes. Extension replaces the expected end with 15 or 30 minutes from the update. Starting and voting use the same bathroom transaction lock. End/extend require the current cycle ID/version, so an old page cannot end a newer cycle. A retry with the same command ID and content returns the original result.

Expiry releases votes without asserting availability. The team can confirm the end of the latest expired cycle; extending an expired cycle requires starting a new one. Votes earlier than the latest start remain in history/cooldown but do not contribute to current status. No affirmative vote is manufactured by staff actions.

Public status continues to honor existing cleaning windows even when staff access is disabled. For application rollback to a version without cleaning support, disable staff changes, end all active windows or wait for their latest expected end, then roll back code. Keep the additive tables; never run a destructive down migration against production.

Retention runs through the existing report-retention jobs: expired credentials are removed and cycle/command history follows REPORT_RETENTION_DAYS. Public reads and staff writes use no-store. Staff requests require the configured Origin plus a session-bound CSRF token; sessions use HttpOnly/SameSite=Strict and Secure/__Host cookies in production.

## Evidence boundary

Use synthetic local/CI fixtures for authorization, simultaneous commands/votes, expiry, stale pages and revocation. Real staff onboarding, actual cleaning correctness and physical-device acceptance remain unverified until observed. Configure feature flags explicitly and record matching public/API revisions before claiming a release.
