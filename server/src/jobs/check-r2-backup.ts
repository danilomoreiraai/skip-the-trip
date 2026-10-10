import { createHash, createHmac } from "node:crypto";

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

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

const hmac = (key: Buffer | string, value: string) =>
  createHmac("sha256", key).update(value).digest();

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

export function parseLatestBackup(xml: string): Date | null {
  const timestamps = [...xml.matchAll(/<LastModified>([^<]+)<\/LastModified>/g)]
    .map((match) => match[1])
    .filter((value): value is string => value !== undefined)
    .map((value) => new Date(value))
    .filter((date) => Number.isFinite(date.getTime()));
  if (timestamps.length === 0) return null;
  return new Date(Math.max(...timestamps.map((date) => date.getTime())));
}

export function backupIsStale(
  latest: Date | null,
  now: Date,
  maxAgeHours: number,
) {
  return !latest || now.getTime() - latest.getTime() > maxAgeHours * 3_600_000;
}

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

async function listBackups(config: Config, now: Date) {
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const path = `/${config.bucket}`;
  const query = `list-type=2&prefix=${encodeURIComponent(config.prefix)}`;
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const shortDate = amzDate.slice(0, 8);
  const payloadHash = hash("");
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    "GET",
    path,
    query,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const scope = `${shortDate}/auto/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    hash(canonicalRequest),
  ].join("\n");
  const dateKey = hmac(`AWS4${config.secretAccessKey}`, shortDate);
  const regionKey = hmac(dateKey, "auto");
  const serviceKey = hmac(regionKey, "s3");
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = createHmac("sha256", signingKey)
    .update(stringToSign)
    .digest("hex");
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(`https://${host}${path}?${query}`, {
    headers: {
      Authorization: authorization,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    },
  });
  if (!response.ok) {
    throw new Error(`R2 list failed with HTTP ${response.status}`);
  }
  return parseLatestBackup(await response.text());
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
  const latest = await listBackups(config, now);
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
