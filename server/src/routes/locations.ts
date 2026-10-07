import type { FastifyInstance } from "fastify";
import {
  authorizationWindow,
  authorizeLocation,
  type LocationConfiguration,
} from "../domain/locations.js";
import {
  ensureAnonymousId,
  readAnonymousId,
} from "../lib/anonymous-identity.js";
import type { LocationAuthorizationsRepository } from "../modules/location-authorizations/repository.js";
import {
  eligibilitySchema,
  locationErrorSchema,
  locationParamsSchema,
  verifyLocationBodySchema,
} from "../schemas/locations.js";

export function registerLocationRoutes(
  app: FastifyInstance,
  repository: LocationAuthorizationsRepository,
  location: LocationConfiguration,
  secureCookie: boolean,
) {
  app.get(
    "/locations/:id/eligibility",
    {
      schema: {
        params: locationParamsSchema,
        response: { 200: eligibilitySchema },
      },
    },
    async (request, reply) => {
      reply.header("cache-control", "private, no-store");
      const { id } = locationParamsSchema.parse(request.params);
      const anonymousId = readAnonymousId(request, secureCookie);
      if (!anonymousId) return { authorized: false, expiresAt: null };
      const authorization = await repository.findValid(
        anonymousId,
        id,
        new Date(),
      );
      return {
        authorized: Boolean(authorization),
        expiresAt: authorization?.expiresAt ?? null,
      };
    },
  );

  app.post(
    "/locations/:id/verify-location",
    {
      schema: {
        params: locationParamsSchema,
        body: verifyLocationBodySchema,
        response: { 200: eligibilitySchema, 403: locationErrorSchema },
      },
    },
    async (request, reply) => {
      reply.header("cache-control", "private, no-store");
      const { id } = locationParamsSchema.parse(request.params);
      const reading = verifyLocationBodySchema.parse(request.body);
      const decision = authorizeLocation(location, reading);
      if (!decision.authorized) {
        const messages = {
          INVALID_INPUT: "The location reading is invalid.",
          INSUFFICIENT_ACCURACY:
            "We could not confirm your location accurately enough. Try again.",
          OUTSIDE_ALLOWED_AREA:
            "You need to be near this location to enable voting.",
        } as const;
        return reply.status(403).send({
          code: decision.reason,
          message: messages[decision.reason],
          statusCode: 403,
        });
      }
      const anonymousId = ensureAnonymousId(request, reply, secureCookie);
      const now = new Date();
      const saved = await repository.authorize(
        anonymousId,
        id,
        authorizationWindow(now),
        now,
      );
      return { authorized: true, expiresAt: saved.expiresAt };
    },
  );
}
