import { describe, expect, it } from "vitest";
import {
  bathroomKey,
  bathroomSchema,
  isRecent,
  REPORT_LIFETIME,
} from "./bathroom";

describe("report freshness", () => {
  const reportedAt = 1_000_000;
  it("expires exactly at 30 minutes", () => {
    expect(
      isRecent(
        { available: true, reportedAt },
        reportedAt + REPORT_LIFETIME - 1,
      ),
    ).toBe(true);
    expect(
      isRecent({ available: true, reportedAt }, reportedAt + REPORT_LIFETIME),
    ).toBe(false);
  });
  it("rejects missing and future reports", () => {
    expect(isRecent(null)).toBe(false);
    expect(isRecent({ available: false, reportedAt }, reportedAt - 1)).toBe(
      false,
    );
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
});
