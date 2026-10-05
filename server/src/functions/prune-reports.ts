import type { ReportsRepository } from "../modules/reports/repository.js";

export async function pruneReports(
  repository: ReportsRepository,
  retentionDays: number,
  now = new Date(),
) {
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60_000);
  return repository.deleteExpired(cutoff);
}
