import type { FastifyInstance } from "fastify";
import { createReport, VoteCooldownError } from "../functions/create-report.js";
import { getReport } from "../functions/get-report.js";
import { readAnonymousId } from "../lib/anonymous-identity.js";
import type { LocationAuthorizationsRepository } from "../modules/location-authorizations/repository.js";
import type { ReportsRepository } from "../modules/reports/repository.js";
import {
  createReportBodySchema,
  getReportQuerySchema,
  notFoundErrorSchema,
  reportAuthorizationErrorSchema,
  reportSummarySchema,
  voteCooldownErrorSchema,
} from "../schemas/reports.js";

export function registerReportRoutes(
  app: FastifyInstance,
  repository: ReportsRepository,
  authorizations: LocationAuthorizationsRepository,
  windowMinutes: number,
  cooldownSeconds: number,
  secureCookie: boolean,
) {
  app.get(
    "/reports",
    {
      schema: {
        querystring: getReportQuerySchema,
        response: { 200: reportSummarySchema },
      },
    },
    async (request) => {
      const query = getReportQuerySchema.parse(request.query);
      return getReport(repository, query);
    },
  );

  app.post(
    "/reports",
    {
      schema: {
        body: createReportBodySchema,
        response: {
          201: reportSummarySchema,
          403: reportAuthorizationErrorSchema,
          404: notFoundErrorSchema,
          429: voteCooldownErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const body = createReportBodySchema.parse(request.body);
      if (body.building !== "HH5")
        return reply
          .status(404)
          .send({ message: "Location not found", statusCode: 404 });
      const anonymousId = readAnonymousId(request, secureCookie);
      const authorization = anonymousId
        ? await authorizations.findValid(anonymousId, body.building, new Date())
        : null;
      if (!anonymousId || !authorization) {
        return reply.status(403).send({
          code: "LOCATION_VERIFICATION_REQUIRED",
          message: "Confirm your location to vote.",
          statusCode: 403,
        });
      }
      try {
        const report = await createReport(
          repository,
          { ...body, anonymousId },
          windowMinutes,
          cooldownSeconds,
        );
        return reply.status(201).send(report);
      } catch (error) {
        if (error instanceof VoteCooldownError) {
          return reply.status(429).send({
            message: error.message,
            retryAfterSeconds: error.retryAfterSeconds,
            statusCode: 429,
          });
        }
        throw error;
      }
    },
  );
}
