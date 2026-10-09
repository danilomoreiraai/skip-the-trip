# Production database backup and recovery runbook

This runbook covers the native EasyPanel PostgreSQL service for Skip The Trip.
It does not authorize an in-place production restore. A production restore is
an incident action and requires an identified incident owner and a fresh safety
backup.

## Service objectives

- Recovery point objective (RPO): at most 24 hours.
- Recovery time objective (RTO): four hours from declaration to verified
  application recovery.
- Backup owner: the infrastructure owner with EasyPanel administrator access.
- Recovery owner: the incident lead designated before a restore starts.

Record the named people and escalation channel in the private operations
system. Do not commit personal contact details or provider credentials.

## Production configuration

Configure the native EasyPanel PostgreSQL service, not a copy of its live data
volume:

| Setting | Required value |
| --- | --- |
| Database | `skip_the_trip` |
| Enabled | yes |
| Schedule | `0 2 * * *` (server time) |
| Retention | 30 backup files |
| Destination | remote S3-compatible storage |
| Path | `skip-the-trip/production/postgres` |

The schedule provides a daily logical backup and the retention setting keeps
approximately 30 days. Confirm the server timezone in EasyPanel and record its
UTC interpretation in the private operations system.

Use a dedicated storage credential restricted to the backup bucket or prefix.
It needs list, read, write, and delete access because restores read objects and
EasyPanel retention deletes old objects. The application and database services
must not receive this credential.

Require all of the following on the storage provider:

- TLS for data in transit;
- provider-managed encryption at rest (SSE-S3 or the provider equivalent);
- bucket public access disabled;
- object versioning enabled;
- an account or role protected by multi-factor authentication for human access;
- an independent provider lifecycle rule that matches the agreed retention.

Do not use storage on the EasyPanel host as the disaster-recovery copy.

## Initial verification

1. In EasyPanel, add the remote destination under **Settings → Storage
   Providers** and verify that the connection succeeds.
2. Open the production PostgreSQL service, select **Backups**, create the
   configuration above, and run it manually.
3. Wait for a successful Backups Log entry. Starting the job is not evidence of
   completion.
4. In the storage provider, confirm the new object exists at the expected path,
   is private, encrypted, versioned, and has a recent modification time.
5. Record the EasyPanel log timestamp, object path, size, checksum when the
   provider exposes one, and operator in the issue without credentials or
   database contents.

## Isolated restore drill

Never select `skip_the_trip` as the drill target. Create a separate temporary
PostgreSQL service and database named `skip_the_trip_restore_drill`, with no
public port and no application connected to it.

Restore through EasyPanel:

1. Open the isolated PostgreSQL service and select **Backups → Restore**.
2. Select the remote provider, enter the exact backup object path, and use
   `skip_the_trip_restore_drill` as the target database.
3. Confirm the restore only after rechecking the service and database names.
4. Follow the action output until it completes.
5. From the isolated service shell, verify that `reports`, `active_votes`,
   `location_authorizations`, and `drizzle.__drizzle_migrations` exist. Record
   their row counts and the elapsed restore time; do not copy row contents.
6. Connect a temporary non-production API instance to the restored database.
   Verify `/health/ready`, one representative read, and a write inside a
   transaction that is rolled back.
7. Remove the temporary API and restore service after the evidence is recorded.

For a downloaded EasyPanel backup, the same structural and transactional check
can be run against an already-created, empty, isolated database:

```sh
RESTORE_DRILL_CONFIRM_ISOLATED=yes \
  ./scripts/restore-drill.sh backup.sql.gz \
  'postgresql://restore-user:password@restore-host:5432/skip_the_trip_restore_drill'
```

The script deliberately refuses to run without the isolation acknowledgement.
It does not create or drop a database and must never receive the production
database URL.

## Notifications and daily checks

Configure an EasyPanel notification channel under **Settings → Notifications**
for database backup events and send a test notification. The channel must reach
the infrastructure owner and the operational escalation channel.

Because a completion notification alone may not detect a job that never ran,
also create a daily check in the storage provider or monitoring system that
alerts when no new object appears under the production path for 26 hours. The
alert must include the service name, last successful object timestamp, link to
the EasyPanel Backups Log, and this runbook.

On an alert:

1. Check the EasyPanel Backups Log for dump, upload, and retention errors.
2. Confirm that the schedule is enabled, the license supports scheduled
   backups, and the server timezone has not changed.
3. Check provider authentication, capacity, endpoint reachability, and list,
   write, read, and delete permissions.
4. Correct the fault, run a manual backup, and confirm the object remotely.
5. Escalate if the 24-hour RPO has been or will be exceeded.

## Production recovery

1. Declare an incident, name the incident and recovery owners, and stop writes.
2. Confirm the exact recovery point and take a fresh safety backup when the
   source database is reachable.
3. Prefer restoring into a new database service, then point a temporary API at
   it for verification. EasyPanel restore replaces data in the selected target.
4. Verify schema, migration history, aggregate row counts, `/health/ready`, a
   representative read, and a controlled write before switching traffic.
5. Record actual RPO and RTO, the selected object, validation evidence, and any
   follow-up actions. Never paste credentials or database contents into GitHub.

Review this runbook and perform an isolated restore drill at least quarterly and
after changing PostgreSQL versions, storage providers, credentials, or backup
settings.
