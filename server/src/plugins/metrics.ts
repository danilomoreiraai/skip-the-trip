import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from "@prometheus-io/client";
import type { FastifyInstance } from "fastify";
import type { ReportsRepository } from "../modules/reports/repository.js";

export function registerMetrics(
  app: FastifyInstance,
  repository: ReportsRepository,
) {
  const registry = new Registry();
  registry.setDefaultLabels({ service: "skip-the-trip-api" });
  collectDefaultMetrics({ prefix: "skip_the_trip_", register: registry });

  const requests = new Counter({
    name: "skip_the_trip_http_requests_total",
    help: "Total HTTP requests completed by the API",
    labelNames: ["method", "route", "status_code"] as const,
    registers: [registry],
  });
  const duration = new Histogram({
    name: "skip_the_trip_http_request_duration_seconds",
    help: "HTTP request duration in seconds",
    labelNames: ["method", "route", "status_code"] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [registry],
  });
  new Gauge({
    name: "skip_the_trip_database_ready",
    help: "Whether the reports database is reachable",
    registers: [registry],
    async collect() {
      try {
        await repository.ping();
        this.set(1);
      } catch {
        this.set(0);
      }
    },
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });
  app.addHook("onResponse", async (request, reply) => {
    const labels = {
      method: request.method,
      route: request.routeOptions.url ?? "unknown",
      status_code: String(reply.statusCode),
    };
    requests.inc(labels);
    duration.observe(labels, reply.elapsedTime / 1000);
  });

  app.get("/metrics", async (_request, reply) => {
    return reply
      .header("content-type", registry.contentType)
      .send(await registry.metrics());
  });
}
