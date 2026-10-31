import { describe, expect, it } from "vitest";
import {
  bathroomKey,
  bathroomSchema,
  CLOSURE_DURATION,
  isAvailable,
  isBuildingAvailable,
} from "./bathroom";

describe("bathroom availability", () => {
  const reportedAt = 1_000_000;
  const closureEnd = reportedAt + CLOSURE_DURATION;
  it("is available when nobody has reported", () => {
    expect(isAvailable(null)).toBe(true);
    expect(isAvailable(undefined)).toBe(true);
  });
  it("keeps YES available however old the report is", () => {
    const report = { available: true, reportedAt, expiresAt: null };
    expect(isAvailable(report, reportedAt + 12 * 60 * 60 * 1000)).toBe(true);
  });
  it("is closed for exactly 30 minutes after a NO", () => {
    const report = { available: false, reportedAt, expiresAt: closureEnd };
    expect(CLOSURE_DURATION).toBe(30 * 60 * 1000);
    expect(isAvailable(report, closureEnd - 1)).toBe(false);
    expect(isAvailable(report, closureEnd)).toBe(true);
  });
  it("isolates location and validates catalog", () => {
    expect(
      bathroomKey({ building: "HH1", floor: "G", category: "Male" }),
    ).not.toBe(
      bathroomKey({ building: "HH1", floor: "G", category: "Female" }),
    );
    expect(
      bathroomSchema.safeParse({
        building: "HH6",
        floor: "G",
        category: "Male",
      }).success,
    ).toBe(false);
  });
  it("only exposes HH5 for live interaction", () => {
    expect(isBuildingAvailable("HH5")).toBe(true);
    expect(isBuildingAvailable("HH1")).toBe(false);
    expect(isBuildingAvailable("HH4")).toBe(false);
  });
});
