import { z } from "zod";

export const locationParamsSchema = z.object({ id: z.literal("HH5") });
export const verifyLocationBodySchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracy: z.number().finite().positive(),
});
export const eligibilitySchema = z.object({
  authorized: z.boolean(),
  expiresAt: z.date().nullable(),
});
export const locationErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  statusCode: z.literal(403),
});
