import { z } from "zod";
import { type Bathroom, bathroomSchema, type Report } from "../domain/bathroom";
import { env } from "../env";
import { observability } from "../lib/observability";

const SELECTION_KEY = "skip-the-trip:selection";
const apiUrl = env.VITE_API_URL.replace(/\/$/, "");

const apiReportSchema = bathroomSchema.extend({
  available: z.boolean().nullable(),
  reportedAt: z.string().datetime().nullable(),
  yesCount: z.number().int().nonnegative(),
  noCount: z.number().int().nonnegative(),
  expiresAt: z.string().datetime().nullable(),
});
const apiErrorSchema = z.object({
  code: z.string().optional(),
  message: z.string(),
  retryAfterSeconds: z.number().int().positive().optional(),
});

async function fetchWithNetworkRetry(input: string, init: RequestInit) {
  try {
    return await fetch(input, {
      ...init,
      credentials: "include",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return fetch(input, {
      ...init,
      credentials: "include",
      signal: AbortSignal.timeout(10_000),
    });
  }
}

async function parseResponse(response: Response) {
  const payload: unknown = await response.json();
  if (!response.ok) {
    const error = apiErrorSchema.safeParse(payload);
    if (error.success && error.data.retryAfterSeconds) {
      throw new VoteCooldownError(
        error.data.message,
        error.data.retryAfterSeconds,
      );
    }
    if (error.success && error.data.code === "LOCATION_VERIFICATION_REQUIRED") {
      throw new LocationVerificationRequiredError(error.data.message);
    }
    if (error.success && error.data.code) {
      throw new LocationVerificationError(error.data.code, error.data.message);
    }
    throw new Error(
      error.success
        ? error.data.message
        : `Request failed (${response.status})`,
    );
  }
  return apiReportSchema.parse(payload);
}

export class VoteCooldownError extends Error {
  readonly retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number) {
    super(message);
    this.name = "VoteCooldownError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class LocationVerificationRequiredError extends Error {}
export class LocationVerificationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "LocationVerificationError";
    this.code = code;
  }
}

function toReport(report: z.infer<typeof apiReportSchema>): Report | null {
  if (report.available === null || report.reportedAt === null) return null;
  return {
    available: report.available,
    reportedAt: Date.parse(report.reportedAt),
    expiresAt: Date.parse(report.expiresAt ?? report.reportedAt),
    yesCount: report.yesCount,
    noCount: report.noCount,
  };
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
        credentials: "include",
        signal: AbortSignal.timeout(10_000),
      });
      return toReport(await parseResponse(response));
    },
  );
}

export async function submitReport(
  bathroom: Bathroom,
  available: boolean,
  idempotencyKey: string = crypto.randomUUID(),
): Promise<Report> {
  const validBathroom = bathroomSchema.parse(bathroom);
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

export async function verifyLocation(
  locationId: "HH5",
  reading: GeolocationCoordinates,
) {
  const response = await fetchWithNetworkRetry(
    `${apiUrl}/locations/${locationId}/verify-location`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        latitude: reading.latitude,
        longitude: reading.longitude,
        accuracy: reading.accuracy,
      }),
    },
  );
  const payload: unknown = await response.json();
  if (!response.ok) {
    const error = apiErrorSchema.safeParse(payload);
    if (error.success)
      throw new LocationVerificationError(
        error.data.code ?? "LOCATION_ERROR",
        error.data.message,
      );
    throw new Error(`Request failed (${response.status})`);
  }
}

export function loadSelection(): Partial<Bathroom> {
  try {
    const raw = sessionStorage.getItem(SELECTION_KEY);
    const selection = raw
      ? bathroomSchema.partial().parse(JSON.parse(raw))
      : {};
    return selection.building && selection.building !== "HH5" ? {} : selection;
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
