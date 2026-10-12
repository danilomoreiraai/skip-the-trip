import { db, pool } from "../db/index.js";
import { env } from "../env.js";
import { pruneReports } from "../functions/prune-reports.js";
import { runRetention } from "../lib/retention-scheduler.js";
import { createLocationAuthorizationsRepository } from "../modules/location-authorizations/repository.js";
import { createReportsRepository } from "../modules/reports/repository.js";

try {
  const result = await runRetention(() =>
    pruneReports(
      createReportsRepository(db),
      createLocationAuthorizationsRepository(db),
      env.REPORT_RETENTION_DAYS,
    ),
  );
  console.log(
    JSON.stringify({
      deleted_active_votes: result.deleted.activeVotes,
      deleted_location_authorizations: result.deleted.locationAuthorizations,
      deleted_reports: result.deleted.reports,
      deleted_total: result.deleted.total,
      duration_ms: result.durationMs,
      event: "reports.retention.succeeded",
    }),
  );
} finally {
  await pool.end();
}
