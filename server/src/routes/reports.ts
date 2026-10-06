import type { FastifyInstance } from "fastify";
import {
  createReportBodySchema,
  getReportQuerySchema,
  reportSummarySchema,
  voteCooldownErrorSchema,
} from "../schemas/reports.js";
import { createReport, VoteCooldownError } from "../functions/create-report.js";
import { getReport } from "../functions/get-report.js";
import type { ReportsRepository } from "../modules/reports/repository.js";

export function registerReportRoutes(
  app: FastifyInstance,
  repository: ReportsRepository,
  windowMinutes: number,
  cooldownSeconds: number,
) {
  app.get("/reports", { schema: { querystring: getReportQuerySchema, response: { 200: reportSummarySchema } } }, async (request) => {
    const query = getReportQuerySchema.parse(request.query);
    return getReport(repository, query, windowMinutes);
  });

  app.post("/reports", { schema: { body: createReportBodySchema, response: { 201: reportSummarySchema, 429: voteCooldownErrorSchema } } }, async (request, reply) => {
    const body = createReportBodySchema.parse(request.body);
    try {
      const report = await createReport(repository, body, windowMinutes, cooldownSeconds);
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
  });
}
