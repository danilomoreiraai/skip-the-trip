import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import type { LocationAuthorizationWindow } from "./domain/locations.js";
import type {
  AuthorizedReportInput,
  Bathroom,
  ReportSummary,
} from "./domain/reports.js";
import type { LocationAuthorizationsRepository } from "./modules/location-authorizations/repository.js";
import type { ReportsRepository } from "./modules/reports/repository.js";

function createFakeReportsRepository(): ReportsRepository {
  const votes = new Map<
    string,
    AuthorizedReportInput & { updatedAt: Date; expiresAt: Date }
  >();
  const operations = new Map<string, AuthorizedReportInput>();
  return {
    async createWithCooldown(
      input,
      cooldownSeconds,
      windowMinutes,
      now = new Date(),
    ) {
      const operation = operations.get(input.idempotencyKey);
      if (operation) return { created: false, retryAfterSeconds: 0 };
      const key = `${input.anonymousId}:${input.building}:${input.floor}:${input.category}`;
      const latest = votes.get(key);
      const retryAfterSeconds = latest
        ? Math.ceil(
            cooldownSeconds -
              (now.getTime() - latest.updatedAt.getTime()) / 1000,
          )
        : 0;
      if (retryAfterSeconds > 0) return { created: false, retryAfterSeconds };
      operations.set(input.idempotencyKey, input);
      votes.set(key, {
        ...input,
        updatedAt: now,
        expiresAt: new Date(now.getTime() + windowMinutes * 60_000),
      });
      return { created: true, retryAfterSeconds: 0 };
    },
    async findSummary(bathroom: Bathroom, now: Date): Promise<ReportSummary> {
      const matching = [...votes.values()]
        .filter(
          (vote) =>
            vote.building === bathroom.building &&
            vote.floor === bathroom.floor &&
            vote.category === bathroom.category &&
            vote.expiresAt > now,
        )
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      const latest = matching[0];
      return {
        ...bathroom,
        available: latest?.available ?? null,
        reportedAt: latest?.updatedAt ?? null,
        expiresAt: latest?.expiresAt ?? null,
        yesCount: matching.filter((vote) => vote.available).length,
        noCount: matching.filter((vote) => !vote.available).length,
      };
    },
    async deleteExpired() {
      return 0;
    },
    async ping() {},
  };
}

function createFakeAuthorizationsRepository(): LocationAuthorizationsRepository {
  const records = new Map<string, LocationAuthorizationWindow>();
  return {
    async findValid(anonymousId, locationId, now) {
      const value = records.get(`${anonymousId}:${locationId}`);
      return value && value.expiresAt > now ? value : null;
    },
    async authorize(anonymousId, locationId, window, now) {
      const key = `${anonymousId}:${locationId}`;
      const current = records.get(key);
      if (current && current.expiresAt > now) return current;
      records.set(key, window);
      return window;
    },
  };
}

const config = {
  NODE_ENV: "test" as const,
  CORS_ORIGIN: "http://localhost:5173",
  LOG_LEVEL: "silent" as const,
  REPORT_WINDOW_MINUTES: 30,
  VOTE_COOLDOWN_SECONDS: 300,
  LOCATION_MAX_ACCURACY_METERS: 100,
  LOCATION_LATITUDE: 51.8533617,
  LOCATION_LONGITUDE: -8.3037587,
  LOCATION_RADIUS_METERS: 500,
};
const vote = {
  building: "HH5",
  floor: "G",
  category: "Male",
  available: true,
  idempotencyKey: "550e8400-e29b-41d4-a716-446655440001",
} as const;

async function testApp() {
  return buildApp({
    config,
    reportsRepository: createFakeReportsRepository(),
    locationAuthorizationsRepository: createFakeAuthorizationsRepository(),
  });
}

async function authorize(app: Awaited<ReturnType<typeof testApp>>) {
  const response = await app.inject({
    method: "POST",
    url: "/locations/HH5/verify-location",
    payload: { latitude: 51.8533617, longitude: -8.3037587, accuracy: 20 },
  });
  return response.headers["set-cookie"] as string;
}

describe("location-authorized reports", () => {
  it("keeps viewing public and blocks a vote without authorization", async () => {
    const app = await testApp();
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/reports?building=HH5&floor=G&category=Male",
        })
      ).statusCode,
    ).toBe(200);
    const response = await app.inject({
      method: "POST",
      url: "/reports",
      payload: vote,
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      code: "LOCATION_VERIFICATION_REQUIRED",
    });
    await app.close();
  });

  it("authorizes HH5 for four hours and records the selected vote", async () => {
    const app = await testApp();
    const cookie = await authorize(app);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    const eligibility = await app.inject({
      method: "GET",
      url: "/locations/HH5/eligibility",
      headers: { cookie },
    });
    expect(eligibility.json()).toMatchObject({
      authorized: true,
      expiresAt: expect.any(String),
    });
    const response = await app.inject({
      method: "POST",
      url: "/reports",
      headers: { cookie },
      payload: vote,
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      available: true,
      yesCount: 1,
      noCount: 0,
    });
    await app.close();
  });

  it("rejects low-accuracy and outside-area readings without issuing identity", async () => {
    const app = await testApp();
    const inaccurate = await app.inject({
      method: "POST",
      url: "/locations/HH5/verify-location",
      payload: { latitude: 51.8533617, longitude: -8.3037587, accuracy: 101 },
    });
    expect(inaccurate.statusCode).toBe(403);
    expect(inaccurate.json()).toMatchObject({ code: "INSUFFICIENT_ACCURACY" });
    expect(inaccurate.headers["set-cookie"]).toBeUndefined();
    const outside = await app.inject({
      method: "POST",
      url: "/locations/HH5/verify-location",
      payload: { latitude: 51.92, longitude: -8.513503, accuracy: 20 },
    });
    expect(outside.json()).toMatchObject({ code: "OUTSIDE_ALLOWED_AREA" });
    await app.close();
  });

  it("uses the configured test location instead of the HH5 default", async () => {
    const app = await testApp();
    const response = await app.inject({
      method: "POST",
      url: "/locations/HH5/verify-location",
      payload: { latitude: 51.907327, longitude: -8.513503, accuracy: 20 },
    });
    expect(response.json()).toMatchObject({ code: "OUTSIDE_ALLOWED_AREA" });
    await app.close();
  });

  it("preserves idempotent retries and cooldown per bathroom", async () => {
    const app = await testApp();
    const cookie = await authorize(app);
    await app.inject({
      method: "POST",
      url: "/reports",
      headers: { cookie },
      payload: vote,
    });
    const retry = await app.inject({
      method: "POST",
      url: "/reports",
      headers: { cookie },
      payload: vote,
    });
    expect(retry.statusCode).toBe(201);
    expect(retry.json()).toMatchObject({ yesCount: 1 });
    const cooldown = await app.inject({
      method: "POST",
      url: "/reports",
      headers: { cookie },
      payload: {
        ...vote,
        available: false,
        idempotencyKey: "550e8400-e29b-41d4-a716-446655440002",
      },
    });
    expect(cooldown.statusCode).toBe(429);
    await app.close();
  });

  it("exposes liveness, database readiness, request correlation and RED metrics", async () => {
    const app = await testApp();
    const health = await app.inject({
      method: "GET",
      url: "/health/live",
      headers: { "x-request-id": "test-request-id" },
    });
    expect(health.headers["x-request-id"]).toBe("test-request-id");
    expect(
      (await app.inject({ method: "GET", url: "/health/ready" })).statusCode,
    ).toBe(200);
    const metrics = await app.inject({ method: "GET", url: "/metrics" });
    expect(metrics.body).toContain("skip_the_trip_http_requests_total");
    expect(metrics.body).toContain("skip_the_trip_database_ready");
    await app.close();
  });

  it("aggregates privacy-safe geolocation failure categories without accepting coordinates", async () => {
    const app = await testApp();
    const categories = [
      "permission_denied",
      "position_unavailable",
      "timeout",
      "insufficient_accuracy",
      "outside_allowed_area",
      "network_failure",
      "authorization_cookie_failure",
      "unexpected",
    ] as const;
    for (const category of categories) {
      const response = await app.inject({
        method: "POST",
        url: "/client-events/geolocation",
        payload: { category, context: "browser" },
      });
      expect(response.statusCode).toBe(204);
    }
    const rejected = await app.inject({
      method: "POST",
      url: "/client-events/geolocation",
      payload: {
        category: "timeout",
        context: "browser",
        latitude: 51.9,
      },
    });
    expect(rejected.statusCode).toBe(400);
    const metrics = await app.inject({ method: "GET", url: "/metrics" });
    for (const category of categories) {
      expect(metrics.body).toContain(`category="${category}"`);
    }
    expect(metrics.body).not.toContain("51.9");
    await app.close();
  });
});
