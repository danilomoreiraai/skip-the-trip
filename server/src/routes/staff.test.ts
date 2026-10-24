import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { hashToken, token } from "../domain/cleaning.js";
import type { OperationsRepository } from "../modules/operations/repository.js";

const raw = token();
const csrf = hashToken(`csrf:${raw}`);
const state = {
  id: "550e8400-e29b-41d4-a716-446655440099",
  building: "HH5",
  floor: "G",
  category: "Male",
  state: "active",
  startedAt: "2026-10-20T10:00:00.000Z",
  expectedEndAt: "2026-10-20T10:15:00.000Z",
  endedAt: null,
  updatedAt: "2026-10-20T10:00:00.000Z",
  version: 1,
};
async function app(enabled = true) {
  return buildApp({
    config: {
      NODE_ENV: "test",
      APP_REVISION: "local",
      CORS_ORIGIN: "http://localhost:5173",
      LOG_LEVEL: "silent",
      REPORT_WINDOW_MINUTES: 30,
      VOTE_COOLDOWN_SECONDS: 300,
      LOCATION_MAX_ACCURACY_METERS: 100,
      LOCATION_LATITUDE: 51,
      LOCATION_LONGITUDE: -8,
      LOCATION_RADIUS_METERS: 500,
      STAFF_ENABLED: enabled,
    },
    reportsRepository: {
      createWithCooldown: vi.fn(),
      findSummary: async (bathroom) => ({
        ...bathroom,
        available: null,
        reportedAt: null,
        expiresAt: null,
        yesCount: 0,
        noCount: 0,
      }),
      findBuildingSummaries: vi.fn().mockResolvedValue([]),
      deleteExpired: vi.fn(),
      ping: vi.fn(),
    },
    locationAuthorizationsRepository: {
      findValid: vi.fn(),
      authorize: vi.fn(),
      deleteExpired: vi.fn(),
    },
    operationsRepository: {
      redeemInvite: async (code: string) =>
        code === raw
          ? {
              token: raw,
              expiresAt: new Date("2026-10-20T18:00:00.000Z"),
              building: "HH5",
            }
          : null,
      authenticate: async (hash: string) =>
        hash === hashToken(raw)
          ? {
              staffId: "550e8400-e29b-41d4-a716-446655440001",
              building: "HH5",
              expiresAt: new Date("2026-10-20T18:00:00.000Z"),
            }
          : null,
      logout: vi.fn(),
      command: vi.fn().mockResolvedValue(state),
      buildingStates: vi.fn().mockResolvedValue([state]),
    } as unknown as OperationsRepository,
  });
}
describe("staff HTTP boundaries", () => {
  it("refuses invalid invitations, missing sessions and unauthenticated logout", async () => {
    const server = await app();
    expect(
      (
        await server.inject({
          method: "POST",
          url: "/staff/session",
          headers: { origin: "http://localhost:5173" },
          payload: { code: hashToken(raw + "invalid") },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (await server.inject({ method: "GET", url: "/staff/session" }))
        .statusCode,
    ).toBe(401);
    expect(
      (await server.inject({ method: "DELETE", url: "/staff/session" }))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await server.inject({
          method: "DELETE",
          url: "/staff/session",
          headers: { origin: "http://localhost:5173" },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await server.inject({
          method: "DELETE",
          url: "/staff/session",
          headers: {
            origin: "http://localhost:5173",
            cookie: `skip-the-trip-staff=${raw}`,
          },
        })
      ).statusCode,
    ).toBe(403);
    await server.close();
  });
  it("includes team cleaning only for the requested bathroom in public report reads", async () => {
    const server = await app();
    const selected = await server.inject({
      method: "GET",
      url: "/reports?building=HH5&floor=G&category=Male",
    });
    expect(selected.statusCode).toBe(200);
    expect(selected.json()).toMatchObject({
      available: null,
      cleaning: { state: "active" },
    });
    expect(
      (
        await server.inject({
          method: "GET",
          url: "/reports?building=HH5&floor=1&category=Female",
        })
      ).json().cleaning,
    ).toBeNull();
    await server.close();
  });
  it("requires an allowed Origin before exchanging a code and uses an HttpOnly cookie", async () => {
    const server = await app();
    expect(
      (
        await server.inject({
          method: "POST",
          url: "/staff/session",
          payload: { code: raw },
        })
      ).statusCode,
    ).toBe(403);
    const response = await server.inject({
      method: "POST",
      url: "/staff/session",
      headers: { origin: "http://localhost:5173" },
      payload: { code: raw },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["set-cookie"]).toContain("HttpOnly");
    expect(response.headers["set-cookie"]).toContain("SameSite=Strict");
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.body).not.toContain(raw);
    expect(response.json().csrfToken).toBe(csrf);
    await server.close();
  });
  it("denies unauthenticated, cross-origin and missing-CSRF writes; accepts a scoped valid command", async () => {
    const server = await app();
    const body = {
      building: "HH5",
      floor: "G",
      category: "Male",
      action: "start",
      minutes: 15,
      commandId: "550e8400-e29b-41d4-a716-446655440002",
    };
    const base = {
      method: "POST" as const,
      url: "/staff/cleaning",
      payload: body,
    };
    expect(
      (
        await server.inject({
          ...base,
          headers: { origin: "http://localhost:5173" },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await server.inject({
          ...base,
          headers: {
            origin: "https://other.example",
            cookie: `skip-the-trip-staff=${raw}`,
            "x-csrf-token": csrf,
          },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await server.inject({
          ...base,
          headers: {
            origin: "http://localhost:5173",
            cookie: `skip-the-trip-staff=${raw}`,
          },
        })
      ).statusCode,
    ).toBe(403);
    const headers = {
      origin: "http://localhost:5173",
      cookie: `skip-the-trip-staff=${raw}`,
      "x-csrf-token": csrf,
    };
    expect(
      (
        await server.inject({
          ...base,
          headers: { ...headers, "x-csrf-token": "é".repeat(64) },
        })
      ).statusCode,
    ).toBe(403);
    expect((await server.inject({ ...base, headers })).json()).toMatchObject({
      state: "active",
      version: 1,
    });
    expect(
      (
        await server.inject({
          ...base,
          headers,
          payload: { ...body, minutes: 20 },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await server.inject({
          ...base,
          headers,
          payload: { ...body, building: "HH1" },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await server.inject({ method: "GET", url: "/staff/session", headers })
      ).json(),
    ).toMatchObject({ authenticated: true, building: "HH5", csrfToken: csrf });
    const logout = await server.inject({
      method: "DELETE",
      url: "/staff/session",
      headers,
    });
    expect(logout.statusCode).toBe(204);
    expect(logout.headers["set-cookie"]).toContain("Max-Age=0");
    await server.close();
  });
  it("keeps staff access disabled by default and never exposes staff identity in public status", async () => {
    const server = await app(false);
    expect(
      (await server.inject({ method: "GET", url: "/staff/session" }))
        .statusCode,
    ).toBe(404);
    const overview = await server.inject({
      method: "GET",
      url: "/locations/HH5/status",
    });
    expect(overview.json().cleaning).toHaveLength(1);
    expect(overview.body).not.toContain("staffId");
    expect(overview.body).not.toContain("tokenHash");
    await server.close();
  });
});
