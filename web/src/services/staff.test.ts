import { afterEach, expect, it, vi } from "vitest";
import {
  getStaffSession,
  loginStaff,
  logoutStaff,
  sendCleaningCommand,
} from "./staff";

const session = {
  authenticated: true,
  building: "HH5",
  csrfToken: "b".repeat(64),
  expiresAt: "2026-10-20T18:00:00.000Z",
};
afterEach(() => vi.unstubAllGlobals());
it("distinguishes disabled staff access, missing session and network failures", async () => {
  vi.stubGlobal("fetch", async () => new Response("{}", { status: 404 }));
  await expect(getStaffSession()).resolves.toBe(false);
  vi.stubGlobal("fetch", async () => new Response("{}", { status: 401 }));
  await expect(getStaffSession()).resolves.toBeNull();
  vi.stubGlobal("fetch", async () => new Response("{}", { status: 500 }));
  await expect(getStaffSession()).rejects.toThrow();
});
it("exchanges the code in a POST body, scopes commands and sends CSRF for logout", async () => {
  const requests: Array<[string, RequestInit | undefined]> = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    requests.push([url, init]);
    return url.endsWith("/cleaning")
      ? new Response(
          JSON.stringify({
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
          }),
        )
      : init?.method === "DELETE"
        ? new Response(null, { status: 204 })
        : new Response(JSON.stringify(session));
  });
  expect(await loginStaff("a".repeat(64))).toEqual(session);
  expect(await getStaffSession()).toEqual(session);
  await sendCleaningCommand(session.csrfToken, {
    building: "HH5",
    floor: "G",
    category: "Male",
    action: "start",
    minutes: 15,
    commandId: "550e8400-e29b-41d4-a716-446655440001",
  });
  await logoutStaff(session.csrfToken);
  expect(requests[0]?.[0]).not.toContain("aaaa");
  expect(requests[0]?.[1]).toMatchObject({
    credentials: "include",
    method: "POST",
    body: JSON.stringify({ code: "a".repeat(64) }),
  });
  expect(new Headers(requests[2]?.[1]?.headers).get("x-csrf-token")).toBe(
    session.csrfToken,
  );
  expect(requests[3]?.[1]?.method).toBe("DELETE");
});
it("does not expose server payloads when staff credentials are rejected", async () => {
  vi.stubGlobal(
    "fetch",
    async () => new Response('{"message":"secret-code"}', { status: 401 }),
  );
  await expect(loginStaff("bad")).rejects.toThrow(
    "Staff access expired or invite invalid",
  );
});

it("reports conflict and server failure without exposing operational payloads", async () => {
  for (const status of [409, 503]) {
    vi.stubGlobal(
      "fetch",
      async () => new Response('{"message":"private-payload"}', { status }),
    );
    await expect(
      sendCleaningCommand(session.csrfToken, {
        building: "HH5",
        floor: "G",
        category: "Male",
        action: "start",
        minutes: 15,
        commandId: "550e8400-e29b-41d4-a716-446655440001",
      }),
    ).rejects.toThrow(
      status === 409 ? "Status changed" : "Staff request failed",
    );
    await expect(logoutStaff(session.csrfToken)).rejects.toThrow(
      status === 409 ? "Status changed" : "Staff request failed",
    );
  }
});
