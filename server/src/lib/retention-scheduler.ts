export type RetentionRunResult = {
  deleted: number;
  durationMs: number;
};

type RetentionSchedulerOptions = {
  run: () => Promise<number>;
  notify: (message: string) => Promise<void>;
  log: (entry: Record<string, unknown>) => void;
  failureThreshold: number;
  now?: () => number;
};

export async function runRetention(
  run: () => Promise<number>,
  now: () => number = Date.now,
): Promise<RetentionRunResult> {
  const startedAt = now();
  const deleted = await run();
  return { deleted, durationMs: Math.max(0, now() - startedAt) };
}

export function createRetentionScheduler(options: RetentionSchedulerOptions) {
  let consecutiveFailures = 0;
  let failureNotified = false;

  return async function execute() {
    const startedAt = options.now?.() ?? Date.now();
    try {
      const result = await runRetention(options.run, options.now);
      consecutiveFailures = 0;
      failureNotified = false;
      options.log({
        deleted: result.deleted,
        duration_ms: result.durationMs,
        event: "reports.retention.succeeded",
        started_at: new Date(startedAt).toISOString(),
      });
      return result;
    } catch (error) {
      consecutiveFailures += 1;
      options.log({
        consecutive_failures: consecutiveFailures,
        duration_ms: Math.max(0, (options.now?.() ?? Date.now()) - startedAt),
        error_name: error instanceof Error ? error.name : "UnknownError",
        event: "reports.retention.failed",
        started_at: new Date(startedAt).toISOString(),
      });

      if (consecutiveFailures >= options.failureThreshold && !failureNotified) {
        try {
          await options.notify(
            `Skip The Trip retention failed ${consecutiveFailures} consecutive times. Check the EasyPanel retention-scheduler logs and the retention runbook.`,
          );
          failureNotified = true;
        } catch (notificationError) {
          options.log({
            error_name:
              notificationError instanceof Error
                ? notificationError.name
                : "UnknownError",
            event: "reports.retention.alert_failed",
          });
        }
      }
      return null;
    }
  };
}
