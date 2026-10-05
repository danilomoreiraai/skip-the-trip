import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import type { Bathroom, CreateReportInput, ReportSummary } from "./domain/reports.js";
import type { ReportsRepository } from "./modules/reports/repository.js";

function createFakeRepository(): ReportsRepository {
  const votes: CreateReportInput[] = [];
  return {
    async create(input) {
      if (!votes.some((vote) => vote.idempotencyKey === input.idempotencyKey)) votes.push(input);
    },
    async findSummary(bathroom: Bathroom, _since: Date, expiresAt): Promise<ReportSummary> {
      const matching = votes.filter((vote) => vote.building === bathroom.building && vote.floor === bathroom.floor && vote.category === bathroom.category);
      const latest = matching.at(-1);
      const reportedAt = latest ? new Date() : null;
      return {
        ...bathroom,
        available: latest?.available ?? null,
        reportedAt,
        yesCount: matching.filter((vote) => vote.available).length,
        noCount: matching.filter((vote) => !vote.available).length,
        expiresAt: reportedAt ? expiresAt(reportedAt) : null,
      };
    },
    async deleteExpired() {
      return 0;
    },
    async ping() {},
  };
}

const config = { CORS_ORIGIN: "http://localhost:5173", LOG_LEVEL: "silent" as const, REPORT_WINDOW_MINUTES: 30 };
const vote = {
  building: "HH1",
  floor: "G",
  category: "Male",
  available: true,
  clientId: "550e8400-e29b-41d4-a716-446655440000",
  idempotencyKey: "550e8400-e29b-41d4-a716-446655440001",
};

describe("reports routes", () => {
  it("creates a vote and returns the current summary", async () => {
    const app = await buildApp({ config, reportsRepository: createFakeRepository() });
    const response = await app.inject({ method: "POST", url: "/reports", payload: vote });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ available: true, yesCount: 1, noCount: 0 });
    await app.close();
  });

  it("keeps retries idempotent", async () => {
    const app = await buildApp({ config, reportsRepository: createFakeRepository() });
    await app.inject({ method: "POST", url: "/reports", payload: vote });
    const response = await app.inject({ method: "POST", url: "/reports", payload: vote });
    expect(response.json()).toMatchObject({ yesCount: 1 });
    await app.close();
  });

  it("rejects invalid locations with the standard error shape", async () => {
    const app = await buildApp({ config, reportsRepository: createFakeRepository() });
    const response = await app.inject({ method: "GET", url: "/reports?building=XX&floor=G&category=Male" });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ message: "Invalid request", statusCode: 400 });
    await app.close();
  });

  it("exposes liveness and readiness checks", async () => {
    const app = await buildApp({ config, reportsRepository: createFakeRepository() });
    expect((await app.inject({ method: "GET", url: "/health/live" })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/health/ready" })).statusCode).toBe(200);
    await app.close();
  });

  it("exposes request correlation and RED metrics", async () => {
    const app = await buildApp({ config, reportsRepository: createFakeRepository() });
    const health = await app.inject({
      method: "GET",
      url: "/health/live",
      headers: { "x-request-id": "test-request-id" },
    });
    expect(health.headers["x-request-id"]).toBe("test-request-id");

    const metrics = await app.inject({ method: "GET", url: "/metrics" });
    expect(metrics.statusCode).toBe(200);
    expect(metrics.headers["content-type"]).toContain("text/plain");
    expect(metrics.body).toContain("skip_the_trip_http_requests_total");
    expect(metrics.body).toContain('route="/health/live"');
    expect(metrics.body).toContain("skip_the_trip_http_request_duration_seconds");
    expect(metrics.body).toContain(
      'skip_the_trip_database_ready{service="skip-the-trip-api"} 1',
    );
    await app.close();
  });

  it("reports unexpected server errors without request payloads", async () => {
    const captured: Array<{ error: unknown; context: { requestId: string; route: string } }> = [];
    const app = await buildApp({
      config,
      reportsRepository: createFakeRepository(),
      captureException(error, context) {
        captured.push({ error, context });
      },
    });
    app.get("/test-error", async () => {
      throw new Error("test failure");
    });

    const response = await app.inject({ method: "GET", url: "/test-error" });

    expect(response.statusCode).toBe(500);
    expect(captured).toHaveLength(1);
    expect(captured[0]?.context.route).toBe("/test-error");
    expect(captured[0]?.context.requestId).toBeTruthy();
    await app.close();
  });
});
