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
