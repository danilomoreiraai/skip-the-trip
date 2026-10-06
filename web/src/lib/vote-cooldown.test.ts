import { describe, expect, it } from "vitest";
import type { Bathroom } from "../domain/bathroom";
import { getVoteCooldown, withVoteCooldown } from "./vote-cooldown";

const accessibleThirdFloor: Bathroom = {
  building: "HH5",
  floor: "3",
  category: "Accessible",
};

describe("vote cooldowns", () => {
  it("only blocks the exact building, floor and bathroom type", () => {
    const cooldowns = withVoteCooldown({}, accessibleThirdFloor, 1234);

    expect(getVoteCooldown(cooldowns, accessibleThirdFloor)).toBe(1234);
    expect(
      getVoteCooldown(cooldowns, { ...accessibleThirdFloor, category: "Male" }),
    ).toBe(0);
    expect(
      getVoteCooldown(cooldowns, { ...accessibleThirdFloor, floor: "2" }),
    ).toBe(0);
  });

  it("keeps independent cooldowns for multiple bathrooms", () => {
    const maleSecondFloor = {
      ...accessibleThirdFloor,
      floor: "2",
      category: "Male",
    } as const;
    const cooldowns = withVoteCooldown(
      withVoteCooldown({}, accessibleThirdFloor, 1234),
      maleSecondFloor,
      5678,
    );

    expect(getVoteCooldown(cooldowns, accessibleThirdFloor)).toBe(1234);
    expect(getVoteCooldown(cooldowns, maleSecondFloor)).toBe(5678);
  });
});
