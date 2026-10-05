import type { CreateReportInput, ReportSummary } from "../domain/reports.js";
import type { ReportsRepository } from "../modules/reports/repository.js";
import { getReport } from "./get-report.js";

export async function createReport(
  repository: ReportsRepository,
  input: CreateReportInput,
  windowMinutes: number,
): Promise<ReportSummary> {
  await repository.create(input);
  return getReport(repository, input, windowMinutes);
}
