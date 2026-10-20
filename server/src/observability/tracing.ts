import {
  type Context,
  context,
  propagation,
  SpanKind,
  SpanStatusCode,
  type TextMapPropagator,
  type Tracer,
  trace,
} from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { LocationAuthorizationsRepository } from "../modules/location-authorizations/repository.js";
import type { ReportsRepository } from "../modules/reports/repository.js";

type RequestTrace = { context: Context; span: ReturnType<Tracer["startSpan"]> };
const requestTraces = new WeakMap<FastifyRequest, RequestTrace>();
let provider: NodeTracerProvider | undefined;

export type TracingConfig = {
  endpoint?: string;
  serviceName: string;
  serviceVersion: string;
  environment: string;
};

export function initializeTracing(config: TracingConfig) {
  if (!config.endpoint) return false;
  provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: config.serviceName,
      [ATTR_SERVICE_VERSION]: config.serviceVersion,
      "deployment.environment.name": config.environment,
    }),
    spanProcessors: [
      new BatchSpanProcessor(new OTLPTraceExporter({ url: config.endpoint })),
    ],
  });
  provider.register({
    contextManager: new AsyncLocalStorageContextManager(),
    propagator: new W3CTraceContextPropagator(),
  });
  return true;
}

export async function shutdownTracing() {
  await provider?.shutdown();
}

export function registerTracing(
  app: FastifyInstance,
  tracer: Tracer = trace.getTracer("skip-the-trip.server"),
  propagator: TextMapPropagator = propagation,
) {
  app.addHook("onRequest", (request, _reply, done) => {
    const parent = propagator.extract(context.active(), request.headers, {
      get(carrier, key) {
        return carrier[key];
      },
      keys(carrier) {
        return Object.keys(carrier);
      },
    });
    const span = tracer.startSpan(
      `HTTP ${request.method}`,
      {
        kind: SpanKind.SERVER,
        attributes: {
          "http.request.method": request.method,
          "server.request_id": request.id,
        },
      },
      parent,
    );
    const traceContext = trace.setSpan(parent, span);
    requestTraces.set(request, { context: traceContext, span });
    context.with(traceContext, done);
  });

  app.addHook("preHandler", (request, _reply, done) => {
    const requestTrace = requestTraces.get(request);
    if (!requestTrace) return done();
    context.with(requestTrace.context, done);
  });

  app.addHook("onError", (request, _reply, _error, done) => {
    requestTraces.get(request)?.span.setStatus({ code: SpanStatusCode.ERROR });
    done();
  });

  app.addHook("onResponse", (request, reply, done) => {
    const requestTrace = requestTraces.get(request);
    if (requestTrace) {
      requestTrace.span.setAttributes({
        "http.route": request.routeOptions.url ?? "unknown",
        "http.response.status_code": reply.statusCode,
      });
      if (reply.statusCode >= 500)
        requestTrace.span.setStatus({ code: SpanStatusCode.ERROR });
      requestTrace.span.end();
      requestTraces.delete(request);
    }
    done();
  });
}

export async function traceDatabaseOperation<T>(
  operationName: string,
  operation: () => Promise<T>,
  tracer: Tracer = trace.getTracer("skip-the-trip.database"),
): Promise<T> {
  return tracer.startActiveSpan(
    `postgresql.${operationName}`,
    {
      kind: SpanKind.CLIENT,
      attributes: {
        "db.system.name": "postgresql",
        "db.operation.name": operationName,
      },
    },
    async (span) => {
      try {
        const result = await operation();
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    },
  );
}

export function instrumentReportsRepository(
  repository: ReportsRepository,
  tracer: Tracer = trace.getTracer("skip-the-trip.database"),
): ReportsRepository {
  return {
    createWithCooldown: (...args) =>
      traceDatabaseOperation(
        "reports.create",
        () => repository.createWithCooldown(...args),
        tracer,
      ),
    findBuildingSummaries: (...args) =>
      traceDatabaseOperation(
        "reports.building_read",
        () => repository.findBuildingSummaries(...args),
        tracer,
      ),
    findSummary: (...args) =>
      traceDatabaseOperation(
        "reports.read",
        () => repository.findSummary(...args),
        tracer,
      ),
    deleteExpired: (...args) =>
      traceDatabaseOperation(
        "reports.delete_expired",
        () => repository.deleteExpired(...args),
        tracer,
      ),
    ping: () =>
      traceDatabaseOperation("healthcheck", () => repository.ping(), tracer),
  };
}

export function instrumentLocationAuthorizationsRepository(
  repository: LocationAuthorizationsRepository,
  tracer: Tracer = trace.getTracer("skip-the-trip.database"),
): LocationAuthorizationsRepository {
  return {
    findValid: (...args) =>
      traceDatabaseOperation(
        "location_authorizations.read",
        () => repository.findValid(...args),
        tracer,
      ),
    authorize: (...args) =>
      traceDatabaseOperation(
        "location_authorizations.authorize",
        () => repository.authorize(...args),
        tracer,
      ),
    deleteExpired: (...args) =>
      traceDatabaseOperation(
        "location_authorizations.delete_expired",
        () => repository.deleteExpired(...args),
        tracer,
      ),
  };
}
