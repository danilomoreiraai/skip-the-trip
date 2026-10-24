import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { bathroomSchema } from "./reports.js";
export const cleaningStateSchema = bathroomSchema.extend({
  id: z.string().uuid(),
  state: z.enum(["active", "expired", "ended"]),
  startedAt: z.string().datetime(),
  expectedEndAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime(),
  version: z.number().int().positive(),
});
export type CleaningState = z.infer<typeof cleaningStateSchema>;
export const cleaningCommandSchema = z.discriminatedUnion("action", [
  bathroomSchema
    .extend({
      building: z.literal("HH5"),
      action: z.literal("start"),
      minutes: z.union([z.literal(15), z.literal(30)]),
      commandId: z.string().uuid(),
    })
    .strict(),
  bathroomSchema
    .extend({
      building: z.literal("HH5"),
      action: z.literal("extend"),
      minutes: z.union([z.literal(15), z.literal(30)]),
      cycleId: z.string().uuid(),
      version: z.number().int().positive(),
      commandId: z.string().uuid(),
    })
    .strict(),
  bathroomSchema
    .extend({
      building: z.literal("HH5"),
      action: z.literal("end"),
      cycleId: z.string().uuid(),
      version: z.number().int().positive(),
      commandId: z.string().uuid(),
    })
    .strict(),
]);
export type CleaningCommand = z.infer<typeof cleaningCommandSchema>;
export function token() {
  return randomBytes(32).toString("hex");
}
export function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export class OperationsError extends Error {
  constructor(
    readonly code: "STAFF_UNAUTHORIZED" | "CLEANING_CONFLICT",
    readonly statusCode: number,
  ) {
    super(
      code === "STAFF_UNAUTHORIZED"
        ? "Staff access required"
        : "Cleaning status changed. Refresh and try again.",
    );
  }
}
export class CleaningInProgressError extends Error {
  readonly code = "CLEANING_IN_PROGRESS";
  readonly statusCode = 409;
  constructor(readonly expectedEndAt: Date) {
    super("Cleaning is in progress. Contributions are temporarily paused.");
  }
}
