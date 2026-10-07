import { randomUUID } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

const COOKIE_NAME = "skip-the-trip-anonymous-id";
const SECURE_COOKIE_NAME = `__Host-${COOKIE_NAME}`;

export function readAnonymousId(request: FastifyRequest, secure: boolean) {
  const value = request.cookies[secure ? SECURE_COOKIE_NAME : COOKIE_NAME];
  return z.string().uuid().safeParse(value).success ? value : null;
}

export function ensureAnonymousId(
  request: FastifyRequest,
  reply: FastifyReply,
  secure: boolean,
) {
  const existing = readAnonymousId(request, secure);
  if (existing) return existing;
  const anonymousId = randomUUID();
  reply.setCookie(secure ? SECURE_COOKIE_NAME : COOKIE_NAME, anonymousId, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return anonymousId;
}
