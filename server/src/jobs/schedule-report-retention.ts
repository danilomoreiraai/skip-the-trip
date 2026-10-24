import { db, pool } from "../db/index.js";
import { env } from "../env.js";
import { pruneReports } from "../functions/prune-reports.js";
import { createRetentionScheduler } from "../lib/retention-scheduler.js";
import { createLocationAuthorizationsRepository } from "../modules/location-authorizations/repository.js";
import { createOperationsRepository } from "../modules/operations/repository.js";
import { createReportsRepository } from "../modules/reports/repository.js";

const positiveNumber = (name: string, fallback: number) => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be positive`);
  }
  return value;
};

const positiveInteger = (name: string, fallback: number) => {
  const value = positiveNumber(name, fallback);
  if (!Number.isInteger(value)) throw new Error(`${name} must be an integer`);
  return value;
};

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

async function sendTelegram(message: string) {
  const token = required("TELEGRAM_BOT_TOKEN");
  const chatId = required("TELEGRAM_CHAT_ID");
  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    },
  );
  if (!response.ok) throw new Error("Retention alert delivery failed");
}

async function main() {
  const intervalHours = positiveNumber("RETENTION_INTERVAL_HOURS", 24);
  const failureThreshold = positiveInteger("RETENTION_FAILURE_THRESHOLD", 3);
  const repository = createReportsRepository(db);
  const authorizations = createLocationAuthorizationsRepository(db);
  const execute = createRetentionScheduler({
    failureThreshold,
    log: (entry) => console.log(JSON.stringify(entry)),
    notify: sendTelegram,
    run: async () => {
      const now = new Date();
      await createOperationsRepository(db).prune(
        new Date(now.getTime() - env.REPORT_RETENTION_DAYS * 86_400_000),
        now,
      );
      return pruneReports(
        repository,
        authorizations,
        env.REPORT_RETENTION_DAYS,
      );
    },
  });

  for (;;) {
    await execute();
    await new Promise((resolve) =>
      setTimeout(resolve, intervalHours * 60 * 60 * 1000),
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .catch((error) => {
      console.error(
        JSON.stringify({
          error_name: error instanceof Error ? error.name : "UnknownError",
          event: "reports.retention.scheduler_stopped",
        }),
      );
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
