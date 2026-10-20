import { z } from "zod";
import { cleaningStateSchema } from "../domain/bathroom";
import { env } from "../env";
import { apiReportSchema } from "./reports";

const buildingStatusSchema = z.object({
  building: z.literal("HH5"),
  generatedAt: z.string().datetime(),
  bathrooms: z.array(apiReportSchema),
  cleaning: z.array(cleaningStateSchema).default([]),
});
export type BuildingStatus = z.infer<typeof buildingStatusSchema>;
export async function getBuildingStatus(): Promise<BuildingStatus> {
  const response = await fetch(
    `${env.VITE_API_URL.replace(/\/$/, "")}/locations/HH5/status`,
    {
      credentials: "omit",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) throw new Error("Could not refresh building status");
  return buildingStatusSchema.parse(await response.json());
}
