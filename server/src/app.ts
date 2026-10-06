import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import type { Env } from "./env.js";
import type { ReportsRepository } from "./modules/reports/repository.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { registerMetrics } from "./plugins/metrics.js";
import { registerReportRoutes } from "./routes/reports.js";

type AppOptions = {
  config: Pick<
    Env,
    "CORS_ORIGIN" | "LOG_LEVEL" | "REPORT_WINDOW_MINUTES" | "VOTE_COOLDOWN_SECONDS"
  >;
  reportsRepository: ReportsRepository;
  captureException?: (error: unknown, context: { requestId: string; route: string }) => void;
};

export async function buildApp({ config, reportsRepository, captureException }: AppOptions) {
  const app = Fastify({ logger: { level: config.LOG_LEVEL }, requestIdHeader: "x-request-id" });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app, captureException);
  registerMetrics(app, reportsRepository);

  await app.register(cors, { origin: config.CORS_ORIGIN.split(",").map((origin) => origin.trim()) });
  await app.register(helmet);
  await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });

  app.get("/health/live", async () => ({ status: "ok" }));
  app.get("/health/ready", async (_request, reply) => {
    try {
      await reportsRepository.ping();
      return { status: "ready" };
    } catch {
      return reply.status(503).send({ message: "Database unavailable", statusCode: 503 });
    }
  });

  registerReportRoutes(
    app,
    reportsRepository,
    config.REPORT_WINDOW_MINUTES,
    config.VOTE_COOLDOWN_SECONDS,
  );
  return app;
}
