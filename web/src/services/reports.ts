import { z } from "zod";
import { type Bathroom, bathroomSchema, type Report } from "../domain/bathroom";
import { env } from "../env";
import { observability } from "../lib/observability";

export const CLIENT_ID_KEY = "skip-the-trip:client-id:v1";
const SELECTION_KEY = "skip-the-trip:selection";
const apiUrl = env.VITE_API_URL.replace(/\/$/, "");

const apiReportSchema = bathroomSchema.extend({
  available: z.boolean().nullable(),
  reportedAt: z.string().datetime().nullable(),
  yesCount: z.number().int().nonnegative(),
  noCount: z.number().int().nonnegative(),
  expiresAt: z.string().datetime().nullable(),
});
const apiErrorSchema = z.object({ message: z.string() });
let memoryClientId: string | undefined;

async function fetchWithNetworkRetry(input: string, init: RequestInit) {
  try {
    return await fetch(input, {
      ...init,
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return fetch(input, {
      ...init,
      signal: AbortSignal.timeout(10_000),
    });
  }
}

async function parseResponse(response: Response) {
  const payload: unknown = await response.json();
  if (!response.ok) {
    const error = apiErrorSchema.safeParse(payload);
    throw new Error(
      error.success
        ? error.data.message
        : `Request failed (${response.status})`,
    );
  }
  return apiReportSchema.parse(payload);
}

function toReport(report: z.infer<typeof apiReportSchema>): Report | null {
  if (report.available === null || report.reportedAt === null) return null;
  return {
    available: report.available,
    reportedAt: Date.parse(report.reportedAt),
    yesCount: report.yesCount,
    noCount: report.noCount,
  };
}

function getClientId() {
  if (memoryClientId) return memoryClientId;
  try {
    const stored = localStorage.getItem(CLIENT_ID_KEY);
    if (stored && z.string().uuid().safeParse(stored).success) {
      memoryClientId = stored;
      return stored;
    }
  } catch {
    // Fall back to an in-memory installation id when storage is unavailable.
  }
  memoryClientId = crypto.randomUUID();
  try {
    localStorage.setItem(CLIENT_ID_KEY, memoryClientId);
  } catch {
    // The in-memory id remains stable for the current page lifetime.
  }
  return memoryClientId;
}

export async function getReport(bathroom: Bathroom): Promise<Report | null> {
  const validBathroom = bathroomSchema.parse(bathroom);
  return observability.withSpan(
    "reports.read",
    { "report.storage": "api" },
    async () => {
      const query = new URLSearchParams(validBathroom);
      const response = await fetch(`${apiUrl}/reports?${query}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      return toReport(await parseResponse(response));
    },
  );
}

export async function submitReport(
  bathroom: Bathroom,
  available: boolean,
): Promise<Report> {
  const validBathroom = bathroomSchema.parse(bathroom);
  const idempotencyKey = crypto.randomUUID();
  return observability.withSpan(
    "reports.write",
    { "report.storage": "api", "report.available": available },
    async () => {
      const response = await fetchWithNetworkRetry(`${apiUrl}/reports`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...validBathroom,
          available,
          clientId: getClientId(),
          idempotencyKey,
        }),
      });
      const report = toReport(await parseResponse(response));
      if (!report)
        throw new Error("API returned an empty report after accepting a vote");
      return report;
    },
  );
}

export function loadSelection(): Partial<Bathroom> {
  try {
    const raw = sessionStorage.getItem(SELECTION_KEY);
    return raw ? bathroomSchema.partial().parse(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

export function saveSelection(selection: Partial<Bathroom>) {
  try {
    sessionStorage.setItem(SELECTION_KEY, JSON.stringify(selection));
  } catch {
    // Keep selection in memory when storage is blocked.
  }
}
