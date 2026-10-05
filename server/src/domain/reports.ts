import { z } from "zod";

export const buildings = ["HH1", "HH2", "HH3", "HH4", "HH5"] as const;
export const floors = ["G", "1", "2", "3"] as const;
export const bathroomCategories = ["Male", "Accessible", "Female"] as const;

export const bathroomSchema = z.object({
  building: z.enum(buildings),
  floor: z.enum(floors),
  category: z.enum(bathroomCategories),
});

export const getReportQuerySchema = bathroomSchema;
export const createReportBodySchema = bathroomSchema.extend({
  available: z.boolean(),
  clientId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
});

export type Bathroom = z.infer<typeof bathroomSchema>;
export type CreateReportInput = z.infer<typeof createReportBodySchema>;

export type ReportSummary = Bathroom & {
  available: boolean | null;
  reportedAt: Date | null;
  yesCount: number;
  noCount: number;
  expiresAt: Date | null;
};
