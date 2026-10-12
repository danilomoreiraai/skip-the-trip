import { context } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import type { LocationAuthorizationsRepository } from "../modules/location-authorizations/repository.js";
import type { ReportsRepository } from "../modules/reports/repository.js";
import {
  initializeTracing,
  instrumentLocationAuthorizationsRepository,
  instrumentReportsRepository,
  registerTracing,
  traceDatabaseOperation,
} from "./tracing.js";

function testTracer() {
  const exporter = new InMemorySpanExporter();
  const provider = new NodeTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  return { exporter, tracer: provider.getTracer("test") };
}

describe("server tracing", () => {
  it("continues W3C browser context with bounded HTTP attributes", async () => {
    const { exporter, tracer } = testTracer();
    context.setGlobalContextManager(new AsyncLocalStorageContextManager());
    const app = Fastify({ logger: false, requestIdHeader: "x-request-id" });
    registerTracing(app, tracer, new W3CTraceContextPropagator());
    app.get("/reports", async () =>
      traceDatabaseOperation(
        "reports.read",
        async () => ({ ok: true }),
        tracer,
      ),
    );

    await app.inject({
      method: "GET",
      url: "/reports?building=HH5&floor=G&category=Male",
      headers: {
        "x-request-id": "request-23",
        traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      },
    });

    const spans = exporter.getFinishedSpans();
    const span = spans.find(({ name }) => name === "HTTP GET");
    const databaseSpan = spans.find(
      ({ name }) => name === "postgresql.reports.read",
    );
    expect(span?.spanContext().traceId).toBe(
      "4bf92f3577b34da6a3ce929d0e0e4736",
    );
    expect(span?.attributes).toEqual({
      "http.request.method": "GET",
      "server.request_id": "request-23",
      "http.route": "/reports",
      "http.response.status_code": 200,
    });
    expect(JSON.stringify(span?.attributes)).not.toContain("HH5");
    expect(databaseSpan?.parentSpanContext?.spanId).toBe(
      span?.spanContext().spanId,
    );
    await app.close();
    context.disable();
  });

  it("creates database spans without SQL, payloads, or identifiers", async () => {
    const { exporter, tracer } = testTracer();
    await traceDatabaseOperation("reports.read", async () => "ok", tracer);

    const [span] = exporter.getFinishedSpans();
    expect(span?.name).toBe("postgresql.reports.read");
    expect(span?.attributes).toEqual({
      "db.system.name": "postgresql",
      "db.operation.name": "reports.read",
    });
  });

  it("stays disabled without an exporter endpoint", () => {
    expect(
      initializeTracing({
        serviceName: "test",
        serviceVersion: "test",
        environment: "test",
      }),
    ).toBe(false);
  });

  it("instruments every repository boundary without exposing arguments", async () => {
    const { exporter, tracer } = testTracer();
    const reports = {
      createWithCooldown: vi.fn().mockResolvedValue({
        created: true,
        retryAfterSeconds: 0,
      }),
      findSummary: vi.fn().mockResolvedValue({}),
      deleteExpired: vi.fn().mockResolvedValue({ activeVotes: 0, reports: 0 }),
      ping: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReportsRepository;
    const authorizations = {
      findValid: vi.fn().mockResolvedValue(null),
      authorize: vi.fn().mockResolvedValue({
        verifiedAt: new Date(0),
        expiresAt: new Date(1),
      }),
      deleteExpired: vi.fn().mockResolvedValue(0),
    } as LocationAuthorizationsRepository;
    const tracedReports = instrumentReportsRepository(reports, tracer);
    const tracedAuthorizations = instrumentLocationAuthorizationsRepository(
      authorizations,
      tracer,
    );
    const sensitive = "must-not-be-exported";

    await tracedReports.createWithCooldown(
      { anonymousId: sensitive } as never,
      300,
      30,
    );
    await tracedReports.findSummary(
      { building: sensitive } as never,
      new Date(),
    );
    await tracedReports.deleteExpired(new Date());
    await tracedReports.ping();
    await tracedAuthorizations.findValid(sensitive, sensitive, new Date());
    await tracedAuthorizations.authorize(
      sensitive,
      sensitive,
      { verifiedAt: new Date(0), expiresAt: new Date(1) },
      new Date(),
    );
    await tracedAuthorizations.deleteExpired(new Date());

    expect(exporter.getFinishedSpans().map(({ name }) => name)).toEqual([
      "postgresql.reports.create",
      "postgresql.reports.read",
      "postgresql.reports.delete_expired",
      "postgresql.healthcheck",
      "postgresql.location_authorizations.read",
      "postgresql.location_authorizations.authorize",
      "postgresql.location_authorizations.delete_expired",
    ]);
    expect(
      JSON.stringify(
        exporter
          .getFinishedSpans()
          .map(({ name, attributes }) => ({ name, attributes })),
      ),
    ).not.toContain(sensitive);
  });
});
