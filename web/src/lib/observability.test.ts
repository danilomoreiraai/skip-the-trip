import { ROOT_CONTEXT, trace } from "@opentelemetry/api";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { describe, expect, it } from "vitest";
import { injectTraceContext, observability } from "./observability";

describe("observability adapter", () => {
  it("injects W3C context without copying application data", () => {
    const span = trace.wrapSpanContext({
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      spanId: "00f067aa0ba902b7",
      traceFlags: 1,
    });
    const init = injectTraceContext(
      { headers: { Accept: "application/json" } },
      trace.setSpan(ROOT_CONTEXT, span),
      new W3CTraceContextPropagator(),
    );
    const headers = new Headers(init.headers);
    expect(headers.get("traceparent")).toBe(
      "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    );
    expect([...headers.keys()].sort()).toEqual(["accept", "traceparent"]);
  });

  it("keeps the operation result transparent", async () => {
    await expect(
      observability.withSpan("test.success", {}, async () => "ok"),
    ).resolves.toBe("ok");
  });

  it("rethrows operation failures", async () => {
    const error = new Error("failure");
    await expect(
      observability.withSpan("test.failure", {}, async () => {
        throw error;
      }),
    ).rejects.toBe(error);
  });

  it("accepts events and exceptions when exporters are disabled", () => {
    expect(() => observability.trackEvent("test.event")).not.toThrow();
    expect(() =>
      observability.captureException(new Error("test")),
    ).not.toThrow();
  });
});
