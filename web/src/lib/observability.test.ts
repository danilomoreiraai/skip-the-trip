import { describe, expect, it } from "vitest";
import { observability } from "./observability";

describe("observability adapter", () => {
  it("keeps the operation result transparent", async () => {
    await expect(
      observability.withSpan("test.success", {}, async () => "ok"),
    ).resolves.toBe("ok");
  });

  it("rethrows operation failures", async () => {
    const error = new Error("failure");
    await expect(
      observability.withSpan("test.failure", {}, async () => {
        throw error;
      }),
    ).rejects.toBe(error);
  });

  it("accepts events and exceptions when exporters are disabled", () => {
    expect(() => observability.trackEvent("test.event")).not.toThrow();
    expect(() =>
      observability.captureException(new Error("test")),
    ).not.toThrow();
  });
});
