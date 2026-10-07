import type { Bathroom, ReportSummary } from "../domain/reports.js";
import type { ReportsRepository } from "../modules/reports/repository.js";

export async function getReport(
  repository: ReportsRepository,
  bathroom: Bathroom,
  now = new Date(),
): Promise<ReportSummary> {
  return repository.findSummary(bathroom, now);
}
