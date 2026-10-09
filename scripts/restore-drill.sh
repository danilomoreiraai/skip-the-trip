#!/usr/bin/env sh
set -eu

if [ "${RESTORE_DRILL_CONFIRM_ISOLATED:-}" != "yes" ]; then
  echo "Refusing to restore without RESTORE_DRILL_CONFIRM_ISOLATED=yes." >&2
  exit 1
fi

if [ "$#" -ne 2 ]; then
  echo "Usage: RESTORE_DRILL_CONFIRM_ISOLATED=yes $0 <backup.sql.gz> <target-database-url>" >&2
  exit 1
fi

backup_file=$1
target_database_url=$2

if [ ! -f "$backup_file" ]; then
  echo "Backup file not found: $backup_file" >&2
  exit 1
fi

for command_name in gzip pg_restore psql; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Required command is unavailable: $command_name" >&2
    exit 1
  fi
done

restore_started_at=$(date +%s)

gzip -cd "$backup_file" | pg_restore \
  --exit-on-error \
  --no-owner \
  --no-privileges \
  --dbname "$target_database_url"

psql "$target_database_url" --set ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  required_table text;
BEGIN
  FOREACH required_table IN ARRAY ARRAY[
    'reports',
    'active_votes',
    'location_authorizations'
  ]
  LOOP
    IF to_regclass('public.' || required_table) IS NULL THEN
      RAISE EXCEPTION 'required table is missing: %', required_table;
    END IF;
  END LOOP;

  IF to_regclass('drizzle.__drizzle_migrations') IS NULL THEN
    RAISE EXCEPTION 'required table is missing: drizzle.__drizzle_migrations';
  END IF;
END
$$;

SELECT 'reports' AS table_name, count(*) AS row_count FROM reports
UNION ALL
SELECT 'active_votes', count(*) FROM active_votes
UNION ALL
SELECT 'location_authorizations', count(*) FROM location_authorizations;

BEGIN;
INSERT INTO reports (
  building,
  floor,
  category,
  available,
  client_id,
  idempotency_key
) VALUES (
  'DRL',
  '0',
  'Accessible',
  true,
  '00000000-0000-4000-8000-000000000019',
  '00000000-0000-4000-8000-000000000919'
);
ROLLBACK;
SQL

restore_finished_at=$(date +%s)
echo "Restore drill succeeded in $((restore_finished_at - restore_started_at)) seconds."
