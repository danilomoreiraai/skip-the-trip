import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  cleaningCommandSchema,
  cleaningStateSchema,
  hashToken,
} from "../domain/cleaning.js";
import type { OperationsRepository } from "../modules/operations/repository.js";

const errorSchema = z.object({
  message: z.string(),
  statusCode: z.number(),
  code: z.string().optional(),
});
const sessionSchema = z.object({
  authenticated: z.literal(true),
  building: z.literal("HH5"),
  expiresAt: z.date(),
  csrfToken: z.string(),
});
export function registerStaffRoutes(
  app: FastifyInstance,
  repository: OperationsRepository,
  origins: string[],
  secure: boolean,
) {
  const cookieName = secure
    ? "__Host-skip-the-trip-staff"
    : "skip-the-trip-staff";
  const cookieOptions = {
    httpOnly: true,
    secure,
    sameSite: "strict" as const,
    path: "/",
  };
  const credential = (request: FastifyRequest) => {
    const value = request.cookies[cookieName];
    return value && /^[0-9a-f]{64}$/.test(value) ? value : null;
  };
  const allowedOrigin = (request: FastifyRequest) =>
    origins.includes(request.headers.origin ?? "");
  async function authorize(request: FastifyRequest, mutate = false) {
    const raw = credential(request);
    const session = raw ? await repository.authenticate(hashToken(raw)) : null;
    if (!raw || !session) return null;
    if (mutate) {
      const supplied = request.headers["x-csrf-token"];
      const expected = hashToken(`csrf:${raw}`);
      if (
        !allowedOrigin(request) ||
        typeof supplied !== "string" ||
        !/^[0-9a-f]{64}$/.test(supplied) ||
        supplied.length !== expected.length ||
        !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
      )
        return false;
    }
    return { raw, session };
  }
  app.addHook("onRequest", async (request, reply) => {
    if (request.url.split("?")[0]?.startsWith("/staff/"))
      reply.header("cache-control", "private, no-store");
  });
  app.post(
    "/staff/session",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: {
        body: z.object({ code: z.string().regex(/^[0-9a-f]{64}$/) }).strict(),
        response: { 200: sessionSchema, 401: errorSchema, 403: errorSchema },
      },
    },
    async (request, reply) => {
      if (!allowedOrigin(request))
        return reply
          .status(403)
          .send({ message: "Origin not allowed", statusCode: 403 });
      const { code } = request.body as { code: string };
      const session = await repository.redeemInvite(code);
      if (!session)
        return reply
          .status(401)
          .send({ message: "Invite is invalid or expired", statusCode: 401 });
      reply.setCookie(cookieName, session.token, {
        ...cookieOptions,
        maxAge: 8 * 60 * 60,
        expires: session.expiresAt,
      });
      return {
        authenticated: true as const,
        building: "HH5" as const,
        expiresAt: session.expiresAt,
        csrfToken: hashToken(`csrf:${session.token}`),
      };
    },
  );
  app.get(
    "/staff/session",
    {
      schema: {
        response: { 200: sessionSchema, 401: errorSchema, 403: errorSchema },
      },
    },
    async (request, reply) => {
      const auth = await authorize(request);
      if (!auth)
        return reply
          .status(401)
          .send({ message: "Staff access required", statusCode: 401 });
      return {
        authenticated: true as const,
        building: "HH5" as const,
        expiresAt: auth.session.expiresAt,
        csrfToken: hashToken(`csrf:${auth.raw}`),
      };
    },
  );
  app.delete("/staff/session", async (request, reply) => {
    if (!allowedOrigin(request))
      return reply
        .status(403)
        .send({ message: "Origin not allowed", statusCode: 403 });
    const auth = await authorize(request, true);
    if (!auth)
      return reply.status(auth === false ? 403 : 401).send({
        message: "Staff access required",
        statusCode: auth === false ? 403 : 401,
      });
    await repository.logout(hashToken(auth.raw));
    reply.clearCookie(cookieName, cookieOptions);
    return reply.status(204).send();
  });
  app.post(
    "/staff/cleaning",
    {
      schema: {
        body: cleaningCommandSchema,
        response: {
          200: cleaningStateSchema,
          401: errorSchema,
          403: errorSchema,
          409: errorSchema,
        },
      },
    },
    async (request, reply) => {
      if (!allowedOrigin(request))
        return reply
          .status(403)
          .send({ message: "Origin not allowed", statusCode: 403 });
      const auth = await authorize(request, true);
      if (!auth)
        return reply.status(auth === false ? 403 : 401).send({
          message: "Staff access required",
          statusCode: auth === false ? 403 : 401,
        });
      return repository.command(
        hashToken(auth.raw),
        cleaningCommandSchema.parse(request.body),
      );
    },
  );
}
