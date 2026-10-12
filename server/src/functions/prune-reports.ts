import type { LocationAuthorizationsRepository } from "../modules/location-authorizations/repository.js";
import type { ReportsRepository } from "../modules/reports/repository.js";

export type RetentionDeletionSummary = {
  activeVotes: number;
  locationAuthorizations: number;
  reports: number;
  total: number;
};

export async function pruneReports(
  reports: ReportsRepository,
  authorizations: LocationAuthorizationsRepository,
  retentionDays: number,
  now = new Date(),
): Promise<RetentionDeletionSummary> {
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60_000);
  const [reportData, locationAuthorizations] = await Promise.all([
    reports.deleteExpired(cutoff),
    authorizations.deleteExpired(now),
  ]);
  return {
    ...reportData,
    locationAuthorizations,
    total: reportData.reports + reportData.activeVotes + locationAuthorizations,
  };
}
