import { z } from "zod";
import {
  createReportBodySchema,
  getReportQuerySchema,
} from "../domain/reports.js";

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

export const reportAuthorizationErrorSchema = z.object({
  code: z.literal("LOCATION_VERIFICATION_REQUIRED"),
  message: z.string(),
  statusCode: z.literal(403),
});

export const notFoundErrorSchema = z.object({
  message: z.string(),
  statusCode: z.literal(404),
});
