import { describe, expect, it, vi } from "vitest";
import { pruneReports } from "./prune-reports.js";

describe("report retention", () => {
  it("deletes reports older than the configured number of days", async () => {
    const deleteExpired = vi.fn(async () => 4);
    const deleted = await pruneReports(
      {
        create: vi.fn(),
        createWithCooldown: vi.fn(),
        findSummary: vi.fn(),
        deleteExpired,
        ping: vi.fn(),
      },
      30,
      new Date("2026-10-04T12:00:00.000Z"),
    );

    expect(deleteExpired).toHaveBeenCalledWith(
      new Date("2026-09-04T12:00:00.000Z"),
    );
    expect(deleted).toBe(4);
  });
});
