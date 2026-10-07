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
  reportedAt: z.number().finite().nonnegative(),
  expiresAt: z.number().finite().nonnegative(),
  yesCount: z.number().int().nonnegative().optional(),
  noCount: z.number().int().nonnegative().optional(),
});
export type Report = z.infer<typeof reportSchema>;
export const REPORT_LIFETIME = 30 * 60 * 1000;
export function bathroomKey(bathroom: Bathroom) {
  return `${bathroom.building}:${bathroom.floor}:${bathroom.category}`;
}
export function isRecent(
  report:
    | Pick<Report, "available" | "reportedAt" | "expiresAt">
    | null
    | undefined,
  now = Date.now(),
) {
  return Boolean(report && report.reportedAt <= now && now < report.expiresAt);
}
