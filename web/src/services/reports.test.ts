import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Bathroom } from "../domain/bathroom";
import {
  CLIENT_ID_KEY,
  getReport,
  loadSelection,
  saveSelection,
  submitReport,
} from "./reports";

const location: Bathroom = { building: "HH1", floor: "G", category: "Male" };
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  const local = new Map<string, string>();
  const session = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => local.get(key) ?? null,
    setItem: (key: string, value: string) => local.set(key, value),
  });
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => session.get(key) ?? null,
    setItem: (key: string, value: string) => session.set(key, value),
  });
  vi.stubGlobal("crypto", {
    randomUUID: vi.fn(() => "550e8400-e29b-41d4-a716-446655440000"),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("reports API service", () => {
  it("loads a report and converts API dates to browser timestamps", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        response({
          ...location,
          available: true,
          reportedAt: "2026-10-04T12:30:00.000Z",
          expiresAt: "2026-10-04T13:00:00.000Z",
          yesCount: 3,
          noCount: 1,
        }),
      ),
    );
    await expect(getReport(location)).resolves.toEqual({
      available: true,
      reportedAt: 1_791_117_000_000,
      yesCount: 3,
      noCount: 1,
    });
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3333/reports?building=HH1&floor=G&category=Male",
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );
  });

  it("maps an empty API summary to no current report", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        response({
          ...location,
          available: null,
          reportedAt: null,
          expiresAt: null,
          yesCount: 0,
          noCount: 0,
        }),
      ),
    );
    await expect(getReport(location)).resolves.toBeNull();
  });

  it("submits an anonymous idempotent vote using a persistent client id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body));
        return response(
          {
            ...location,
            available: body.available,
            reportedAt: "2026-10-04T12:30:00.000Z",
            expiresAt: "2026-10-04T13:00:00.000Z",
            yesCount: 1,
            noCount: 0,
          },
          201,
        );
      }),
    );
    await expect(submitReport(location, true)).resolves.toMatchObject({
      available: true,
      yesCount: 1,
    });
    const request = vi.mocked(fetch).mock.calls[0];
    expect(request[0]).toBe("http://localhost:3333/reports");
    expect(JSON.parse(String(request[1]?.body))).toEqual({
      ...location,
      available: true,
      clientId: "550e8400-e29b-41d4-a716-446655440000",
      idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(localStorage.getItem(CLIENT_ID_KEY)).toBe(
      "550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it("reuses a valid client id already stored by the installation", async () => {
    vi.resetModules();
    localStorage.setItem(CLIENT_ID_KEY, "550e8400-e29b-41d4-a716-446655440009");
    const service = await import("./reports");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body));
        return response(
          {
            ...location,
            available: body.available,
            reportedAt: "2026-10-04T12:30:00.000Z",
            expiresAt: "2026-10-04T13:00:00.000Z",
            yesCount: 1,
            noCount: 0,
          },
          201,
        );
      }),
    );
    await service.submitReport(location, true);
    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(body.clientId).toBe("550e8400-e29b-41d4-a716-446655440009");
  });

  it("reuses the idempotency key when a network failure is retried", async () => {
    const requestBodies: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        requestBodies.push(String(init?.body));
        if (requestBodies.length === 1)
          throw new TypeError("Network unavailable");
        return response(
          {
            ...location,
            available: false,
            reportedAt: "2026-10-04T12:30:00.000Z",
            expiresAt: "2026-10-04T13:00:00.000Z",
            yesCount: 0,
            noCount: 1,
          },
          201,
        );
      }),
    );

    await expect(submitReport(location, false)).resolves.toMatchObject({
      available: false,
    });
    expect(requestBodies).toHaveLength(2);
    expect(JSON.parse(requestBodies[0]).idempotencyKey).toBe(
      JSON.parse(requestBodies[1]).idempotencyKey,
    );
  });

  it("surfaces API failures without reporting success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response({ message: "Nope" }, 503)),
    );
    await expect(getReport(location)).rejects.toThrow("Nope");
  });

  it("uses a status-based error when the API error body is malformed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response({ problem: "unknown" }, 502)),
    );
    await expect(getReport(location)).rejects.toThrow("Request failed (502)");
  });

  it("rejects an empty summary after an accepted vote", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        response(
          {
            ...location,
            available: null,
            reportedAt: null,
            expiresAt: null,
            yesCount: 0,
            noCount: 0,
          },
          201,
        ),
      ),
    );
    await expect(submitReport(location, true)).rejects.toThrow("empty report");
  });
});

describe("selection persistence", () => {
  it("loads and saves a valid partial selection", () => {
    saveSelection({ building: "HH5", floor: "1" });
    expect(loadSelection()).toEqual({ building: "HH5", floor: "1" });
  });
  it("clears a persisted selection for an unavailable building", () => {
    saveSelection({ building: "HH2", floor: "1" });
    expect(loadSelection()).toEqual({});
  });
  it("recovers from invalid or blocked selection storage", () => {
    sessionStorage.setItem("skip-the-trip:selection", "{broken");
    expect(loadSelection()).toEqual({});
    vi.spyOn(sessionStorage, "setItem").mockImplementation(() => {
      throw new Error("Blocked");
    });
    expect(() => saveSelection({ building: "HH1" })).not.toThrow();
  });
});
