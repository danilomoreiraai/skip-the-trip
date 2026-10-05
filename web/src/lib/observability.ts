import { type Attributes, SpanStatusCode, trace } from "@opentelemetry/api";
import { env } from "../env";

const tracerName = "skip-the-trip.web";
const pendingExceptions: Array<{
  error: unknown;
  context: Record<string, unknown>;
}> = [];

let captureInSentry = (error: unknown, context: Record<string, unknown>) => {
  pendingExceptions.push({ error, context });
};

let addSentryBreadcrumb = (name: string, attributes: Attributes) => {
  void name;
  void attributes;
};

export interface Observability {
  captureException(error: unknown, context?: Record<string, unknown>): void;
  trackEvent(name: string, attributes?: Attributes): void;
  withSpan<T>(
    name: string,
    attributes: Attributes,
    operation: () => Promise<T>,
  ): Promise<T>;
}

export const observability: Observability = {
  captureException(error, context = {}) {
    captureInSentry(error, context);
    const span = trace.getActiveSpan();
    if (error instanceof Error) span?.recordException(error);
    span?.setStatus({ code: SpanStatusCode.ERROR });
  },
  trackEvent(name, attributes = {}) {
    const span = trace.getTracer(tracerName).startSpan(name, { attributes });
    span.end();
    addSentryBreadcrumb(name, attributes);
  },
  async withSpan(name, attributes, operation) {
    const tracer = trace.getTracer(tracerName);
    return tracer.startActiveSpan(name, { attributes }, async (span) => {
      try {
        const result = await operation();
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        if (error instanceof Error) span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    });
  },
};

export async function initializeObservability() {
  if (env.VITE_SENTRY_DSN) {
    const Sentry = await import("@sentry/react");
    Sentry.init({
      dsn: env.VITE_SENTRY_DSN,
      environment: env.VITE_APP_ENV,
      release: env.VITE_RELEASE,
      tracesSampleRate: env.VITE_APP_ENV === "production" ? 0.1 : 1,
      integrations: (defaults) =>
        defaults.filter((integration) => integration.name !== "BrowserSession"),
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
      },
    });
    captureInSentry = (error, context) => {
      Sentry.captureException(error, { extra: context });
    };
    addSentryBreadcrumb = (name, attributes) => {
      Sentry.addBreadcrumb({
        category: "product",
        message: name,
        data: attributes,
      });
    };
    for (const pending of pendingExceptions.splice(0)) {
      captureInSentry(pending.error, pending.context);
    }
  }

  if (env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT) {
    const [
      { OTLPTraceExporter },
      { resourceFromAttributes },
      { BatchSpanProcessor },
      { WebTracerProvider },
      { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION },
    ] = await Promise.all([
      import("@opentelemetry/exporter-trace-otlp-http"),
      import("@opentelemetry/resources"),
      import("@opentelemetry/sdk-trace-base"),
      import("@opentelemetry/sdk-trace-web"),
      import("@opentelemetry/semantic-conventions"),
    ]);
    const exporter = new OTLPTraceExporter({
      url: env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT,
    });
    const provider = new WebTracerProvider({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: env.VITE_OTEL_SERVICE_NAME,
        [ATTR_SERVICE_VERSION]: env.VITE_RELEASE,
        "deployment.environment.name": env.VITE_APP_ENV,
      }),
      spanProcessors: [new BatchSpanProcessor(exporter)],
    });
    provider.register();
  }

  window.addEventListener("error", (event) => {
    observability.captureException(event.error ?? event.message, {
      source: "window.error",
    });
  });
  window.addEventListener("unhandledrejection", (event) => {
    observability.captureException(event.reason, {
      source: "unhandledrejection",
    });
  });
}
