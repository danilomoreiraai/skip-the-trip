import { describe, expect, it } from "vitest";
import { storageKey } from "./storage-key";

describe("preview storage isolation", () => {
  it("preserves beta preferences and isolates preview preferences", () => {
    expect(storageKey("favorite", "/")).toBe("favorite");
    expect(storageKey("favorite", "/teste2_0/")).toBe("favorite:/teste2_0/");
  });
});
