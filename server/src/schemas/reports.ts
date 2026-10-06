import { z } from "zod";
import { createReportBodySchema, getReportQuerySchema } from "../domain/reports.js";

export { createReportBodySchema, getReportQuerySchema };

export const reportSummarySchema = getReportQuerySchema.extend({
  available: z.boolean().nullable(),
  reportedAt: z.date().nullable(),
  yesCount: z.number().int().nonnegative(),
  noCount: z.number().int().nonnegative(),
  expiresAt: z.date().nullable(),
});

export const voteCooldownErrorSchema = z.object({
  message: z.string(),
  retryAfterSeconds: z.number().int().positive(),
  statusCode: z.literal(429),
});
