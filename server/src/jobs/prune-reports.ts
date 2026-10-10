import { db, pool } from "../db/index.js";
import { env } from "../env.js";
import { pruneReports } from "../functions/prune-reports.js";
import { runRetention } from "../lib/retention-scheduler.js";
import { createReportsRepository } from "../modules/reports/repository.js";

try {
  const result = await runRetention(() =>
    pruneReports(createReportsRepository(db), env.REPORT_RETENTION_DAYS),
  );
  console.log(
    JSON.stringify({
      deleted: result.deleted,
      duration_ms: result.durationMs,
      event: "reports.retention.succeeded",
    }),
  );
} finally {
  await pool.end();
}
