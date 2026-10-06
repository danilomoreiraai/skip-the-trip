import type { CreateReportInput, ReportSummary } from "../domain/reports.js";
import type { ReportsRepository } from "../modules/reports/repository.js";
import { getReport } from "./get-report.js";

export async function createReport(
  repository: ReportsRepository,
  input: CreateReportInput,
  windowMinutes: number,
  cooldownSeconds: number,
): Promise<ReportSummary> {
  const result = await repository.createWithCooldown(input, cooldownSeconds);
  if (result.retryAfterSeconds > 0) throw new VoteCooldownError(result.retryAfterSeconds);
  return getReport(repository, input, windowMinutes);
}

export class VoteCooldownError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("Please wait before voting on this bathroom again");
    this.name = "VoteCooldownError";
  }
}
