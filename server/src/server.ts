import { buildApp } from "./app.js";
import { db, pool } from "./db/index.js";
import { env } from "./env.js";
import { createLocationAuthorizationsRepository } from "./modules/location-authorizations/repository.js";
import { createOperationsRepository } from "./modules/operations/repository.js";
import { createPushRepository } from "./modules/push/repository.js";
import { createReportsRepository } from "./modules/reports/repository.js";
import {
  initializeTracing,
  instrumentLocationAuthorizationsRepository,
  instrumentReportsRepository,
  shutdownTracing,
} from "./observability/tracing.js";

initializeTracing({
  serviceName: env.OTEL_SERVICE_NAME,
  serviceVersion: env.SENTRY_RELEASE,
  environment: env.SENTRY_ENVIRONMENT,
  ...(env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
    ? { endpoint: env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT }
    : {}),
});

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
  operationsRepository: createOperationsRepository(db),
  pushRepository: createPushRepository(db, env.PUSH_ENCRYPTION_KEY),
  pushConfig: {
    enabled: env.PUSH_ENABLED,
    publicKey: env.PUSH_ENABLED ? env.VAPID_PUBLIC_KEY! : null,
  },
  reportsRepository: instrumentReportsRepository(createReportsRepository(db)),
  locationAuthorizationsRepository: instrumentLocationAuthorizationsRepository(
    createLocationAuthorizationsRepository(db),
  ),
  ...(captureException ? { captureException } : {}),
});

async function shutdown(signal: string) {
  app.log.info({ signal }, "Shutting down");
  await app.close();
  await flushErrorTracking?.();
  await shutdownTracing();
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
