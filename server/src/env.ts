import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().max(65_535).default(3333),
  DATABASE_URL: z.string().url(),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  REPORT_WINDOW_MINUTES: z.coerce.number().int().positive().max(120).default(30),
  VOTE_COOLDOWN_SECONDS: z.coerce.number().int().positive().max(3_600).default(300),
  REPORT_RETENTION_DAYS: z.coerce.number().int().positive().max(3_650).default(30),
  SENTRY_DSN: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().url().optional(),
  ),
  SENTRY_ENVIRONMENT: z.string().min(1).default("development"),
  SENTRY_RELEASE: z.string().min(1).default("local"),
});

export type Env = z.infer<typeof envSchema>;
export const env = envSchema.parse(process.env);
