import { randomUUID } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

const COOKIE_NAME = "skip-the-trip-anonymous-id";
function cookieName(secure: boolean, suffix: string) {
  return `${secure ? "__Host-" : ""}${COOKIE_NAME}${suffix ? `-${suffix}` : ""}`;
}

export function readAnonymousId(
  request: FastifyRequest,
  secure: boolean,
  suffix = "",
) {
  const value = request.cookies[cookieName(secure, suffix)];
  return z.string().uuid().safeParse(value).success ? value : null;
}

export function ensureAnonymousId(
  request: FastifyRequest,
  reply: FastifyReply,
  secure: boolean,
  suffix = "",
) {
  const existing = readAnonymousId(request, secure, suffix);
  if (existing) return existing;
  const anonymousId = randomUUID();
  reply.setCookie(cookieName(secure, suffix), anonymousId, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return anonymousId;
}
