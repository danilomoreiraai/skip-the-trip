import cookie from "@fastify/cookie";
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { describe, expect, it, vi } from "vitest";
import type { PushRepository } from "../modules/push/repository.js";
import { registerPushRoutes } from "./push.js";

async function app(enabled = true) {
  const server = Fastify({ logger: false });
  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);
  await server.register(cookie);
  registerPushRoutes(
    server,
    {
      save: vi.fn(),
      preference: vi
        .fn()
        .mockResolvedValue({ building: "HH5", floor: "G", category: "Male" }),
      remove: vi.fn(),
    } as unknown as PushRepository,
    { enabled, publicKey: enabled ? "public-key" : null },
    ["https://skipthetrip.info"],
    true,
  );
  return server;
}
describe("push subscription ownership and consent boundaries", () => {
  it("exposes configuration without creating tracking cookies and defaults to disabled", async () => {
    const server = await app(false);
    const result = await server.inject({ method: "GET", url: "/push/config" });
    expect(result.json()).toEqual({ enabled: false, publicKey: null });
    expect(result.headers["set-cookie"]).toBeUndefined();
    expect(
      (await server.inject({ method: "PUT", url: "/push/subscription" }))
        .statusCode,
    ).toBe(404);
    await server.close();
  });
  it("requires Origin and a non-simple request header before saving validated subscription credentials", async () => {
    const server = await app();
    const body = {
      bathroom: { building: "HH5", floor: "G", category: "Male" },
      subscription: {
        endpoint: "https://fcm.googleapis.com/fcm/send/test",
        keys: { p256dh: "B" + "a".repeat(86), auth: "a".repeat(22) },
        expirationTime: null,
      },
    };
    const base = {
      method: "PUT" as const,
      url: "/push/subscription",
      payload: body,
    };
    expect((await server.inject(base)).statusCode).toBe(403);
    expect(
      (
        await server.inject({
          ...base,
          headers: { origin: "https://skipthetrip.info" },
        })
      ).statusCode,
    ).toBe(403);
    const headers = {
      origin: "https://skipthetrip.info",
      "x-push-client": "1",
    };
    const saved = await server.inject({ ...base, headers });
    expect(saved.statusCode).toBe(204);
    expect(saved.headers["set-cookie"]).toContain("__Host-skip-the-trip-push");
    expect(saved.headers["set-cookie"]).toContain("HttpOnly");
    expect(saved.headers["set-cookie"]).toContain("Secure");
    expect(
      (
        await server.inject({
          ...base,
          headers,
          payload: {
            ...body,
            subscription: {
              ...body.subscription,
              endpoint: "https://127.0.0.1/private",
            },
          },
        })
      ).statusCode,
    ).toBe(400);
    const preference = await server.inject({
      method: "GET",
      url: "/push/subscription",
      headers: { cookie: "__Host-skip-the-trip-push=" + "a".repeat(64) },
    });
    expect(preference.json()).toMatchObject({
      subscribed: true,
      bathroom: { building: "HH5" },
    });
    expect(preference.body).not.toContain("endpoint");
    expect(
      (
        await server.inject({
          method: "DELETE",
          url: "/push/subscription",
          headers,
        })
      ).statusCode,
    ).toBe(204);
    expect(
      (await server.inject({ method: "DELETE", url: "/push/subscription" }))
        .statusCode,
    ).toBe(403);
    const removed = await server.inject({
      method: "DELETE",
      url: "/push/subscription",
      headers: {
        ...headers,
        cookie: "__Host-skip-the-trip-push=" + "a".repeat(64),
      },
    });
    expect(removed.statusCode).toBe(204);
    expect(removed.headers["set-cookie"]).toContain("Max-Age=0");
    await server.close();
  });
});
