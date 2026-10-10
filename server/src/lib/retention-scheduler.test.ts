import { describe, expect, it, vi } from "vitest";
import {
  createRetentionScheduler,
  runRetention,
} from "./retention-scheduler.js";

describe("retention scheduler", () => {
  it("records deleted rows and duration without report data", async () => {
    const now = vi.fn().mockReturnValueOnce(1_000).mockReturnValueOnce(1_025);

    await expect(runRetention(async () => 7, now)).resolves.toEqual({
      deleted: 7,
      durationMs: 25,
    });
  });

  it("alerts once after repeated failures and resets after success", async () => {
    const run = vi
      .fn<() => Promise<number>>()
      .mockRejectedValueOnce(new Error("first"))
      .mockRejectedValueOnce(new Error("second"))
      .mockRejectedValueOnce(new Error("third"))
      .mockResolvedValueOnce(2)
      .mockRejectedValueOnce(new Error("fourth"))
      .mockRejectedValueOnce(new Error("fifth"));
    const notify = vi.fn(async () => undefined);
    const log = vi.fn();
    const execute = createRetentionScheduler({
      failureThreshold: 2,
      log,
      notify,
      run,
    });

    await execute();
    await execute();
    await execute();
    await execute();
    await execute();
    await execute();

    expect(notify).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        consecutive_failures: 2,
        error_name: "Error",
        event: "reports.retention.failed",
      }),
    );
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        deleted: 2,
        event: "reports.retention.succeeded",
      }),
    );
  });
});
