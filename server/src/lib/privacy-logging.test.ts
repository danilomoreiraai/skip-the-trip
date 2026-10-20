import { Writable } from "node:stream";
import Fastify from "fastify";
import { serializerCompiler } from "fastify-type-provider-zod";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { registerErrorHandler } from "../plugins/error-handler.js";
import { privacyLogger } from "./privacy-logging.js";

describe("private request diagnostics", () => {
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
