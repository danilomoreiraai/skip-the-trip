import { z } from "zod";
import { cleaningStateSchema } from "../domain/bathroom";
import { env } from "../env";

const sessionSchema = z.object({
  authenticated: z.literal(true),
  building: z.literal("HH5"),
  expiresAt: z.string().datetime(),
  csrfToken: z.string(),
});
export type StaffSession = z.infer<typeof sessionSchema>;
const base = `${env.VITE_API_URL.replace(/\/$/, "")}/staff`;
export class StaffRequestError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(
      status === 401
        ? "Staff access expired or invite invalid"
        : status === 409
          ? "Status changed. Refresh and try again."
          : "Staff request failed. Please try again.",
    );
    this.status = status;
  }
}
async function request(path: string, init: RequestInit = {}) {
  return fetch(`${base}${path}`, {
    ...init,
    credentials: "include",
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
}
export async function getStaffSession(): Promise<StaffSession | null | false> {
  const response = await request("/session");
  if (response.status === 404) return false;
  if (response.status === 401) return null;
  if (!response.ok) throw new StaffRequestError(response.status);
  return sessionSchema.parse(await response.json());
}
export async function loginStaff(code: string): Promise<StaffSession> {
  const response = await request("/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!response.ok) throw new StaffRequestError(response.status);
  return sessionSchema.parse(await response.json());
}
export async function logoutStaff(csrfToken: string) {
  const response = await request("/session", {
    method: "DELETE",
    headers: { "x-csrf-token": csrfToken },
  });
  if (!response.ok) throw new StaffRequestError(response.status);
}
export type CleaningCommand = {
  building: "HH5";
  floor: "G" | "1" | "2" | "3";
  category: "Male" | "Accessible" | "Female";
  commandId: string;
} & (
  | { action: "start"; minutes: 15 | 30 }
  | { action: "extend"; minutes: 15 | 30; cycleId: string; version: number }
  | { action: "end"; cycleId: string; version: number }
);
export async function sendCleaningCommand(
  csrfToken: string,
  command: CleaningCommand,
) {
  const response = await request("/cleaning", {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
    body: JSON.stringify(command),
  });
  if (!response.ok) throw new StaffRequestError(response.status);
  return cleaningStateSchema.parse(await response.json());
}
