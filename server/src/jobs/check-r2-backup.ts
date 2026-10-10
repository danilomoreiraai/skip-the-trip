import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { backupIsStale } from "../lib/backup-monitor.js";

type Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  prefix: string;
  maxAgeHours: number;
  telegramBotToken: string;
  telegramChatId: string;
};

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

function loadConfig(): Config {
  const maxAgeHours = Number(process.env.BACKUP_MAX_AGE_HOURS ?? "26");
  if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0) {
    throw new Error("BACKUP_MAX_AGE_HOURS must be positive");
  }
  return {
    accountId: required("R2_ACCOUNT_ID"),
    accessKeyId: required("R2_ACCESS_KEY_ID"),
    secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
    bucket: process.env.R2_BUCKET?.trim() || "skip-the-trip-backups",
    prefix: process.env.R2_PREFIX?.trim() || "production/postgres/",
    maxAgeHours,
    telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
    telegramChatId: required("TELEGRAM_CHAT_ID"),
  };
}

async function listBackups(config: Config) {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  const response = await client.send(
    new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: config.prefix,
    }),
  );
  const timestamps = (response.Contents ?? [])
    .map((item) => item.LastModified)
    .filter((value): value is Date => value instanceof Date);
  if (timestamps.length === 0) return null;
  return new Date(Math.max(...timestamps.map((date) => date.getTime())));
}

async function sendTelegram(config: Config, text: string) {
  const response = await fetch(
    `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: config.telegramChatId, text }),
    },
  );
  if (!response.ok) {
    throw new Error(`Telegram send failed with HTTP ${response.status}`);
  }
}

async function check(config: Config) {
  const now = new Date();
  const latest = await listBackups(config);
  if (!backupIsStale(latest, now, config.maxAgeHours)) {
    console.log(`backup healthy: ${latest?.toISOString()}`);
    return;
  }
  const detail = latest
    ? `last backup: ${latest.toISOString()}`
    : `no object found under ${config.prefix}`;
  await sendTelegram(
    config,
    `⚠️ Skip The Trip backup alert\n${detail}\nExpected age: < ${config.maxAgeHours}h\nEasyPanel: https://painel.levelupuser.com/`,
  );
  console.error(`backup stale: ${detail}`);
}

async function main() {
  const config = loadConfig();
  const intervalMs =
    Number(process.env.BACKUP_CHECK_INTERVAL_SECONDS ?? "3600") * 1000;
  if (!Number.isFinite(intervalMs) || intervalMs < 60_000) {
    throw new Error("BACKUP_CHECK_INTERVAL_SECONDS must be at least 60");
  }
  let failureNotified = false;
  for (;;) {
    try {
      await check(config);
      failureNotified = false;
    } catch (error) {
      console.error(error);
      if (!failureNotified) {
        await sendTelegram(
          config,
          `⚠️ Skip The Trip backup monitor failed\n${error instanceof Error ? error.message : "unknown error"}`,
        );
        failureNotified = true;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
