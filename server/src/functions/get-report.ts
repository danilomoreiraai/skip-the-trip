import type { Bathroom, ReportSummary } from "../domain/reports.js";
import type { ReportsRepository } from "../modules/reports/repository.js";

export async function getReport(
  repository: ReportsRepository,
  bathroom: Bathroom,
  windowMinutes: number,
  now = new Date(),
): Promise<ReportSummary> {
  const windowMs = windowMinutes * 60_000;
  const since = new Date(now.getTime() - windowMs);
  return repository.findSummary(
    bathroom,
    since,
    (reportedAt) => new Date(reportedAt.getTime() + windowMs),
  );
}
