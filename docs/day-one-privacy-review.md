# Day-one privacy review (issue #58)

Reviewed on 20 October 2026 against the main baseline `9d5e6d3`.

| Boundary | Evidence | Status |
| --- | --- | --- |
| Coordinate persistence | Location route passes only anonymous ID, location ID and verification/expiry timestamps to the repository. Application schema has no coordinate columns. | Verified in source; valid and rejected readings covered by API tests. |
| Diagnostics | Default Fastify request logs included raw URLs and arbitrary error messages; unexpected exceptions could also enter error tracking. The default 404 handler could also interpolate unknown paths/query strings into free-form log messages; a bounded not-found handler now suppresses that path. This change allowlists request log fields and replaces tracked exception messages. Nginx access logging now omits URLs, IPs and headers; error severity is restricted to critical. | Regression test verifies malformed JSON and unexpected error exclusion. |
| Browser | Verification submits coordinates in POST body; selection storage contains building/floor/category only. Traces exclude request bodies. | Verified in source and existing service/tracing tests. |
| Public transport | Read-only HTTPS requests to `/`, `/HH5` and `/release.json` succeeded during planning. | Public HTTPS observed; TLS termination/provider logs require separate operator inspection. |
| Database transport | Pool consumes `DATABASE_URL`; deployment uses the private EasyPanel network. | Source verified. Actual TLS negotiation and host disk encryption not inspected; do not claim encryption at rest or encrypted internal transport. |
| Backups | Runbook requires private, TLS-protected, encrypted and versioned remote storage. | Configuration policy only in this review. Current provider encryption/versioning and backup contents not inspected. |

Coordinates continue to be processed transiently, not stored encrypted. No new coordinate collection, production configuration or real-user requests were introduced. Provider/reverse-proxy diagnostic settings must exclude request bodies and URL parameters; this review does not certify independently managed infrastructure logs.
