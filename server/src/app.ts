import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import type { Env } from "./env.js";
import { privacyLogger } from "./lib/privacy-logging.js";
import type { LocationAuthorizationsRepository } from "./modules/location-authorizations/repository.js";
import type { OperationsRepository } from "./modules/operations/repository.js";
import type { PushRepository } from "./modules/push/repository.js";
import type { ReportsRepository } from "./modules/reports/repository.js";
import { registerTracing } from "./observability/tracing.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { registerMetrics } from "./plugins/metrics.js";
import {
  registerBuildingStatusRoutes,
  registerLocationRoutes,
} from "./routes/locations.js";
import { type PushConfig, registerPushRoutes } from "./routes/push.js";
import { registerReportRoutes } from "./routes/reports.js";
import { registerStaffRoutes } from "./routes/staff.js";

type AppOptions = {
  config: Pick<
    Env,
    | "CORS_ORIGIN"
    | "LOG_LEVEL"
    | "REPORT_WINDOW_MINUTES"
    | "VOTE_COOLDOWN_SECONDS"
    | "LOCATION_MAX_ACCURACY_METERS"
    | "LOCATION_LATITUDE"
    | "LOCATION_LONGITUDE"
    | "LOCATION_RADIUS_METERS"
    | "NODE_ENV"
    | "APP_REVISION"
  > &
    Partial<Pick<Env, "STAFF_ENABLED">>;
  operationsRepository?: OperationsRepository;
  pushRepository?: PushRepository;
  pushConfig?: PushConfig;
  reportsRepository: ReportsRepository;
  locationAuthorizationsRepository: LocationAuthorizationsRepository;
  captureException?: (
    error: unknown,
    context: { requestId: string; route: string },
  ) => void;
};

export async function buildApp({
  config,
  reportsRepository,
  locationAuthorizationsRepository,
  captureException,
  operationsRepository,
  pushRepository,
  pushConfig,
}: AppOptions) {
  const app = Fastify({
    logger: privacyLogger(config.LOG_LEVEL),
    requestIdHeader: "x-request-id",
  });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerTracing(app);
  registerErrorHandler(app, captureException);
  registerMetrics(app, reportsRepository);

  await app.register(cookie);
  await app.register(cors, {
    origin: config.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
    credentials: true,
  });
  await app.register(helmet);
  await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });

  app.get("/health/live", async () => ({ status: "ok" }));
  app.get("/release", async () => ({ revision: config.APP_REVISION }));
  app.get("/health/ready", async (_request, reply) => {
    try {
      await reportsRepository.ping();
      return { status: "ready" };
    } catch {
      return reply
        .status(503)
        .send({ message: "Database unavailable", statusCode: 503 });
    }
  });

  const secureCookie = config.NODE_ENV === "production";
  registerLocationRoutes(
    app,
    locationAuthorizationsRepository,
    {
      id: "HH5",
      latitude: config.LOCATION_LATITUDE,
      longitude: config.LOCATION_LONGITUDE,
      radiusMeters: config.LOCATION_RADIUS_METERS,
      maxAccuracyMeters: config.LOCATION_MAX_ACCURACY_METERS,
    },
    secureCookie,
  );
  if (pushRepository)
    registerPushRoutes(
      app,
      pushRepository,
      pushConfig ?? { enabled: false, publicKey: null },
      config.CORS_ORIGIN.split(",").map((value) => value.trim()),
      secureCookie,
    );
  registerBuildingStatusRoutes(app, reportsRepository, operationsRepository);
  if (config.STAFF_ENABLED && operationsRepository)
    registerStaffRoutes(
      app,
      operationsRepository,
      config.CORS_ORIGIN.split(",").map((value) => value.trim()),
      secureCookie,
    );
  registerReportRoutes(
    app,
    reportsRepository,
    locationAuthorizationsRepository,
    config.REPORT_WINDOW_MINUTES,
    config.VOTE_COOLDOWN_SECONDS,
    secureCookie,
    operationsRepository,
  );
  return app;
}
