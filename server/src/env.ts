import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PUSH_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z
    .string()
    .regex(/^(mailto:|https:\/\/)/)
    .default("mailto:support@skipthetrip.info"),
  PUSH_ENCRYPTION_KEY: z.string().optional(),
  STAFF_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().max(65_535).default(3333),
  DATABASE_URL: z.string().url(),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  REPORT_WINDOW_MINUTES: z.coerce
    .number()
    .int()
    .positive()
    .max(120)
    .default(30),
  VOTE_COOLDOWN_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .max(3_600)
    .default(300),
  LOCATION_MAX_ACCURACY_METERS: z.coerce
    .number()
    .positive()
    .max(5_000)
    .default(100),
  LOCATION_LATITUDE: z.coerce.number().min(-90).max(90).default(51.907327),
  LOCATION_LONGITUDE: z.coerce.number().min(-180).max(180).default(-8.513503),
  LOCATION_RADIUS_METERS: z.coerce.number().positive().max(10_000).default(500),
  REPORT_RETENTION_DAYS: z.coerce
    .number()
    .int()
    .positive()
    .max(3_650)
    .default(30),
  SENTRY_DSN: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().url().optional(),
  ),
  SENTRY_ENVIRONMENT: z.string().min(1).default("development"),
  SENTRY_RELEASE: z.string().min(1).default("local"),
  APP_REVISION: z
    .string()
    .regex(/^(?:[0-9a-f]{40}|local)$/)
    .default("local"),
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().url().optional(),
  ),
  OTEL_SERVICE_NAME: z.string().min(1).default("skip-the-trip-api"),
});

export type Env = z.infer<typeof envSchema>;
export const env = envSchema
  .superRefine((value, context) => {
    if (
      value.PUSH_ENABLED &&
      (!value.VAPID_PUBLIC_KEY ||
        !value.VAPID_PRIVATE_KEY ||
        !value.PUSH_ENCRYPTION_KEY ||
        Buffer.from(value.PUSH_ENCRYPTION_KEY, "base64").length !== 32)
    )
      context.addIssue({
        code: "custom",
        message:
          "Enabled push requires VAPID keys and a 32-byte PUSH_ENCRYPTION_KEY",
      });
  })
  .parse(process.env);
