import { buildApp } from "./app.js";
import { db, pool } from "./db/index.js";
import { env } from "./env.js";
import { createLocationAuthorizationsRepository } from "./modules/location-authorizations/repository.js";
import { createReportsRepository } from "./modules/reports/repository.js";

let captureException:
  | ((error: unknown, context: { requestId: string; route: string }) => void)
  | undefined;
let flushErrorTracking: (() => Promise<boolean>) | undefined;

if (env.SENTRY_DSN) {
  const Sentry = await import("@sentry/node");
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT,
    release: env.SENTRY_RELEASE,
    tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
      frameContextLines: 0,
    },
  });
  captureException = (error, context) => {
    Sentry.captureException(error, { extra: context });
  };
  flushErrorTracking = () => Sentry.flush(2_000);
}

const app = await buildApp({
  config: env,
  reportsRepository: createReportsRepository(db),
  locationAuthorizationsRepository: createLocationAuthorizationsRepository(db),
  ...(captureException ? { captureException } : {}),
});

async function shutdown(signal: string) {
  app.log.info({ signal }, "Shutting down");
  await app.close();
  await flushErrorTracking?.();
  await pool.end();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.error(error);
  await pool.end();
  process.exit(1);
}
