import type { FastifyInstance } from "fastify";
import { createReportBodySchema, getReportQuerySchema, reportSummarySchema } from "../schemas/reports.js";
import { createReport } from "../functions/create-report.js";
import { getReport } from "../functions/get-report.js";
import type { ReportsRepository } from "../modules/reports/repository.js";

export function registerReportRoutes(app: FastifyInstance, repository: ReportsRepository, windowMinutes: number) {
  app.get("/reports", { schema: { querystring: getReportQuerySchema, response: { 200: reportSummarySchema } } }, async (request) => {
    const query = getReportQuerySchema.parse(request.query);
    return getReport(repository, query, windowMinutes);
  });

  app.post("/reports", { schema: { body: createReportBodySchema, response: { 201: reportSummarySchema } } }, async (request, reply) => {
    const body = createReportBodySchema.parse(request.body);
    const report = await createReport(repository, body, windowMinutes);
    return reply.status(201).send(report);
  });
}
