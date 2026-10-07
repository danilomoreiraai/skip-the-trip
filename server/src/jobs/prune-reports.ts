import { db, pool } from "../db/index.js";
import { env } from "../env.js";
import { pruneReports } from "../functions/prune-reports.js";
import { createReportsRepository } from "../modules/reports/repository.js";

try {
  const deleted = await pruneReports(
    createReportsRepository(db),
    env.REPORT_RETENTION_DAYS,
  );
  console.log(JSON.stringify({ deleted, event: "reports.pruned" }));
} finally {
  await pool.end();
}
