import { z } from "zod";

const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().url().optional(),
);

const apiUrl = z
  .string()
  .refine(
    (value) =>
      value.startsWith("/") || z.string().url().safeParse(value).success,
    "Expected an absolute URL or a root-relative path",
  );

const envSchema = z.object({
  VITE_API_URL: apiUrl.default("http://localhost:3333"),
  VITE_APP_ENV: z
    .enum(["development", "staging", "production"])
    .default("development"),
  VITE_RELEASE: z.string().min(1).default("local"),
  VITE_SENTRY_DSN: optionalUrl,
  VITE_OTEL_EXPORTER_OTLP_ENDPOINT: optionalUrl,
  VITE_OTEL_SERVICE_NAME: z.string().min(1).default("skip-the-trip-web"),
});

export const env = envSchema.parse(import.meta.env);
