import { context } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import {
  initializeTracing,
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
});
