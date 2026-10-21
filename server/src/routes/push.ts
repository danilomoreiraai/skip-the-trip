import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { token } from "../domain/cleaning.js";
import { bathroomSchema } from "../domain/reports.js";
import { allowedPushEndpoint } from "../lib/push-security.js";
import type { PushRepository } from "../modules/push/repository.js";

const subscriptionSchema = z
  .object({
    endpoint: z.string().max(2048).refine(allowedPushEndpoint),
    keys: z
      .object({
        p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}$/),
        auth: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
      })
      .strict(),
    expirationTime: z.number().nullable().optional(),
  })
  .strict();
export type PushConfig = { enabled: boolean; publicKey: string | null };
export function registerPushRoutes(
  app: FastifyInstance,
  repository: PushRepository,
  config: PushConfig,
  origins: string[],
  secure: boolean,
) {
  const name = secure ? "__Host-skip-the-trip-push" : "skip-the-trip-push";
  const options = {
    secure,
    httpOnly: true,
    sameSite: "strict" as const,
    path: "/",
  };
  const owner = (request: FastifyRequest) => {
    const value = request.cookies[name];
    return value && /^[0-9a-f]{64}$/.test(value) ? value : null;
  };
  const allowed = (request: FastifyRequest) =>
    origins.includes(request.headers.origin ?? "") &&
    request.headers["x-push-client"] === "1";
  app.get(
    "/push/config",
    {
      schema: {
        response: {
          200: z.object({
            enabled: z.boolean(),
            publicKey: z.string().nullable(),
          }),
        },
      },
    },
    async (_request, reply) => {
      reply.header("cache-control", "no-store");
      return config;
    },
  );
  app.get("/push/subscription", async (request, reply) => {
    reply.header("cache-control", "private, no-store");
    const key = owner(request);
    const bathroom = key ? await repository.preference(key) : null;
    return { subscribed: Boolean(bathroom), bathroom };
  });
  if (config.enabled)
    app.put(
      "/push/subscription",
      {
        config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
        schema: {
          body: z
            .object({
              bathroom: bathroomSchema
                .extend({ building: z.literal("HH5") })
                .strict(),
              subscription: subscriptionSchema,
            })
            .strict(),
        },
      },
      async (request, reply) => {
        reply.header("cache-control", "private, no-store");
        if (!allowed(request))
          return reply
            .status(403)
            .send({ message: "Request not allowed", statusCode: 403 });
        const body = request.body as {
          bathroom: z.infer<typeof bathroomSchema>;
          subscription: z.infer<typeof subscriptionSchema>;
        };
        const key = owner(request) ?? token();
        await repository.save(key, body.bathroom, {
          endpoint: body.subscription.endpoint,
          keys: body.subscription.keys,
        });
        reply.setCookie(name, key, { ...options, maxAge: 30 * 24 * 60 * 60 });
        return reply.status(204).send();
      },
    );
  app.delete("/push/subscription", async (request, reply) => {
    reply.header("cache-control", "private, no-store");
    if (!allowed(request))
      return reply
        .status(403)
        .send({ message: "Request not allowed", statusCode: 403 });
    const key = owner(request);
    if (key) await repository.remove(key);
    reply.clearCookie(name, options);
    return reply.status(204).send();
  });
}
