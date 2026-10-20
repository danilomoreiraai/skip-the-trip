# Favorite cleaning Web Push (#61)

Push defaults disabled. The app remains fully usable without push permission or compatible browser APIs. Analytics consent never enables notifications.

## Activation

1. Complete the cleaner onboarding and privacy review in `cleaner-operations.md`.
2. In a private operator terminal, generate VAPID keys once with the installed `web-push` CLI and a 32-byte random base64 encryption key with the Node crypto module. Store the private key/encryption key in deployment secrets, outside the database and backups. Never paste them into issues/chat/logs. This implementation creates no live keys.
3. Supply `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (a monitored HTTPS/mailto contact) and `PUSH_ENCRYPTION_KEY` to both API and worker. Set `PUSH_ENABLED=true` only after configuration validation. Browser clients fetch only the public VAPID key.
4. Enable the Compose `notifications` profile (`COMPOSE_PROFILES=notifications`) and deploy the `push-worker` together with the API. Confirm both use the approved APP_REVISION, migrations succeeded, and bounded `push.batch` events appear for synthetic tests. Staff actions commit independently from delivery.
5. On iPhone/iPad use the Home Screen web app. On other compatible browsers opt in through the favorite's notification control. Record real page-closed receipt separately for each tested environment; do not infer it from VM/Playwright tests.

## Delivery and privacy

New cycles insert an outbox row in the staff transaction. Idempotency prevents duplicate events; an event/subscription primary key plus row locks coordinates workers. There are at most three attempts, with 5/10-second retry delays. Events older than one minute, expired/ended cycles, changed favorites and cancelled subscriptions are discarded. TTL is capped at sixty seconds and at the remaining cleaning estimate. A crash after provider acceptance can cause a retry; the service worker deduplicates by cycle ID using IndexedDB and notification tags.

Before display the worker refetches live cleaning status and the browser's owned subscription. If either cannot be verified, it discards the message. Tapping an alert opens `/HH5` with the bathroom highlighted and a fresh status query. The service worker does not cache API responses or queue votes. Seen cycle IDs are pruned after 24 hours.

Only exact HTTPS endpoints for Google FCM, Mozilla production Web Push and Apple Web Push are accepted. Credentials, fragments, query strings and custom ports are refused. No arbitrary URL fetching is supported. The push library sends encrypted payloads with a ten-second network timeout and does not follow redirects. Unsupported push providers require an explicit reviewed allowlist change.

The worker logs aggregate sent/retried/discarded counts and a bounded failure event; never log provider errors, subscription endpoints/keys, favorites or owner cookies. The UI offers one favorite per browser and no cross-device sync.

## Rollback and key rotation

Disable PUSH_ENABLED on API and worker first; existing subscriptions then receive no new messages. Keep additive tables for retention. For encryption-key rotation, unsubscribe/remove existing subscriptions before replacing the key; ciphertext encrypted with an old key cannot be read by the new key. Keep the key required to interpret retained backups in restricted recovery storage for the applicable retention period. VAPID key rotation requires browser re-enrollment.

## Evidence still pending

Production key/worker provisioning, provider-side privacy settings, real cleaner adoption and real push receipt with the page closed have not been observed by local/CI tests. System/browser power saving, permissions and delivery services can delay or prevent receipt.
