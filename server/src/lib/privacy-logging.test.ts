import { Writable } from "node:stream";
import Fastify from "fastify";
import { serializerCompiler } from "fastify-type-provider-zod";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  CleaningInProgressError,
  OperationsError,
} from "../domain/cleaning.js";
import { registerErrorHandler } from "../plugins/error-handler.js";
import { privacyLogger } from "./privacy-logging.js";

describe("private request diagnostics", () => {
  it("returns bounded operation errors without treating cleaning as cooldown", async () => {
    const app = Fastify({ logger: false });
    registerErrorHandler(app);
    app.post("/cleaning", async () => {
      throw new OperationsError("CLEANING_CONFLICT", 409);
    });
    app.post("/vote", async () => {
      throw new CleaningInProgressError(new Date("2026-10-20T10:15:00.000Z"));
    });
    app.post("/unauthorized", async () => {
      throw new OperationsError("STAFF_UNAUTHORIZED", 401);
    });
    expect(
      (await app.inject({ method: "POST", url: "/unauthorized" })).statusCode,
    ).toBe(401);
    const conflict = await app.inject({ method: "POST", url: "/cleaning" });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toMatchObject({ code: "CLEANING_CONFLICT" });
    const cleaning = await app.inject({ method: "POST", url: "/vote" });
    expect(cleaning.statusCode).toBe(409);
    expect(cleaning.json()).toMatchObject({
      code: "CLEANING_IN_PROGRESS",
      expectedEndAt: "2026-10-20T10:15:00.000Z",
    });
    expect(cleaning.json().retryAfterSeconds).toBeUndefined();
    await app.close();
  });
  it("keeps sensitive unknown paths and query strings out of not-found logs and responses", async () => {
    const logs: string[] = [];
    const app = Fastify({
      logger: {
        ...privacyLogger("info"),
        stream: new Writable({
          write(chunk, _encoding, callback) {
            logs.push(String(chunk));
            callback();
          },
        }),
      },
    });
    registerErrorHandler(app);
    for (const url of [
      "/unknown?latitude=secret-coordinate",
      "/secret-invite-code?longitude=secret-coordinate",
    ]) {
      const response = await app.inject({ method: "GET", url });
      expect(response.statusCode).toBe(404);
      expect(response.body).not.toContain("secret-");
    }
    await app.close();
    expect(logs.join("")).not.toContain("secret-coordinate");
    expect(logs.join("")).not.toContain("secret-invite-code");
  });
  it("sanitizes response serialization failures before sending them to error tracking", async () => {
    const errors: unknown[] = [];
    const app = Fastify({ logger: false });
    app.setSerializerCompiler(serializerCompiler);
    registerErrorHandler(app, (error) => errors.push(error));
    app.get(
      "/broken",
      { schema: { response: { 200: z.object({ result: z.string() }) } } },
      async () => ({ result: { secret: "secret-coordinate" } }),
    );
    const response = await app.inject({ method: "GET", url: "/broken" });
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain("secret-coordinate");
    expect(errors).toHaveLength(1);
    expect(String(errors[0])).not.toContain("secret-coordinate");
    await app.close();
  });
  it("excludes query strings, headers, body and exception payloads from request logs and error tracking", async () => {
    const logs: string[] = [];
    const errors: unknown[] = [];
    const app = Fastify({
      logger: {
        ...privacyLogger("info"),
        stream: new Writable({
          write(chunk, _encoding, callback) {
            logs.push(String(chunk));
            callback();
          },
        }),
      },
    });
    registerErrorHandler(app, (error) => errors.push(error));
    app.post("/verify", async () => {
      throw new Error("secret-coordinate-51.123456 secret-invite-code");
    });
    const result = await app.inject({
      method: "POST",
      url: "/verify?latitude=secret-coordinate-51.123456",
      headers: { cookie: "secret-invite-code" },
      payload: { latitude: "secret-coordinate-51.123456" },
    });
    expect(result.statusCode).toBe(500);
    const malformed = await app.inject({
      method: "POST",
      url: "/verify",
      headers: { "content-type": "application/json" },
      payload: '{"latitude":"secret-coordinate-51.123456"',
    });
    expect(malformed.statusCode).toBe(400);
    await app.close();
    const diagnostics =
      logs.join("") + errors.map((error) => String(error)).join("");
    expect(diagnostics).not.toContain("secret-coordinate");
    expect(diagnostics).not.toContain("secret-invite");
    expect(logs.join("")).toContain('"method":"POST"');
    expect(errors).toHaveLength(1);
  });
});
