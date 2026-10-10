import { describe, expect, it } from "vitest";
import { backupIsStale, parseLatestBackup } from "./check-r2-backup.js";

describe("R2 backup monitor", () => {
  it("selects the newest backup timestamp", () => {
    const latest = parseLatestBackup(`
      <Contents><LastModified>2026-10-08T02:00:00.000Z</LastModified></Contents>
      <Contents><LastModified>2026-10-09T02:00:00.000Z</LastModified></Contents>
    `);
    expect(latest?.toISOString()).toBe("2026-10-09T02:00:00.000Z");
  });

  it("treats missing and older-than-threshold backups as stale", () => {
    const now = new Date("2026-10-10T05:00:00.000Z");
    expect(backupIsStale(null, now, 26)).toBe(true);
    expect(
      backupIsStale(new Date("2026-10-09T02:00:00.000Z"), now, 26),
    ).toBe(true);
    expect(
      backupIsStale(new Date("2026-10-09T04:00:00.000Z"), now, 26),
    ).toBe(false);
  });
});
