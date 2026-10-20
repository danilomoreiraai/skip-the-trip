import { describe, expect, it, vi } from "vitest";
import { pruneReports } from "./prune-reports.js";

describe("report retention", () => {
  it("deletes retained report data at the cutoff and expired location authorizations immediately", async () => {
    const deleteExpiredReportData = vi.fn(async () => ({
      activeVotes: 2,
      reports: 4,
    }));
    const deleteExpiredAuthorizations = vi.fn(async () => 3);
    const deleted = await pruneReports(
      {
        findBuildingSummaries: vi.fn(),
        createWithCooldown: vi.fn(),
        findSummary: vi.fn(),
        deleteExpired: deleteExpiredReportData,
        ping: vi.fn(),
      },
      {
        authorize: vi.fn(),
        deleteExpired: deleteExpiredAuthorizations,
        findValid: vi.fn(),
      },
      30,
      new Date("2026-10-04T12:00:00.000Z"),
    );

    expect(deleteExpiredReportData).toHaveBeenCalledWith(
      new Date("2026-09-04T12:00:00.000Z"),
    );
    expect(deleteExpiredAuthorizations).toHaveBeenCalledWith(
      new Date("2026-10-04T12:00:00.000Z"),
    );
    expect(deleted).toEqual({
      activeVotes: 2,
      locationAuthorizations: 3,
      reports: 4,
      total: 9,
    });
  });
});
