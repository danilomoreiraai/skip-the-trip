import { z } from "zod";
export const buildings = ["HH1", "HH2", "HH3", "HH4", "HH5"] as const;
export const floors = ["G", "1", "2", "3"] as const;
export const categories = ["Male", "Accessible", "Female"] as const;
export const bathroomSchema = z.object({
  building: z.enum(buildings),
  floor: z.enum(floors),
  category: z.enum(categories),
});
export type Bathroom = z.infer<typeof bathroomSchema>;
export function isBuildingAvailable(building: (typeof buildings)[number]) {
  return building === "HH5";
}
const reportSchema = z.object({
  available: z.boolean(),
  reportedAt: z.number().finite().nonnegative().nullable(),
  expiresAt: z.number().finite().nonnegative().nullable(),
  yesCount: z.number().int().nonnegative().optional(),
  noCount: z.number().int().nonnegative().optional(),
});
export type Report = z.infer<typeof reportSchema>;
export const CLOSURE_DURATION = 30 * 60 * 1000;
export function bathroomKey(bathroom: Bathroom) {
  return `${bathroom.building}:${bathroom.floor}:${bathroom.category}`;
}
/**
 * Bathrooms are available by default and after any YES. A NO closes the
 * bathroom until `expiresAt`, after which it is available again.
 */
export function isAvailable(
  report: Pick<Report, "available" | "expiresAt"> | null | undefined,
  now = Date.now(),
) {
  if (!report || report.available) return true;
  return report.expiresAt !== null && now >= report.expiresAt;
}
