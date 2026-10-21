import { afterEach, expect, it, vi } from "vitest";
import { getBuildingStatus } from "./building";

afterEach(() => vi.unstubAllGlobals());
it("loads a consolidated public HH5 status without credentials", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            building: "HH5",
            generatedAt: "2026-10-20T10:00:00.000Z",
            bathrooms: [
              {
                building: "HH5",
                floor: "1",
                category: "Female",
                available: null,
                reportedAt: null,
                expiresAt: null,
                yesCount: 0,
                noCount: 0,
              },
            ],
          }),
        ),
    ),
  );
  expect((await getBuildingStatus()).bathrooms[0]?.available).toBeNull();
  expect(vi.mocked(fetch).mock.calls[0]).toMatchObject([
    "http://localhost:3333/locations/HH5/status",
    { credentials: "omit", cache: "no-store" },
  ]);
});
it("rejects unsuccessful and malformed responses instead of displaying fresh status", async () => {
  vi.stubGlobal("fetch", async () => new Response("{}", { status: 503 }));
  await expect(getBuildingStatus()).rejects.toThrow("Could not refresh");
  vi.stubGlobal("fetch", async () => new Response('{"building":"HH1"}'));
  await expect(getBuildingStatus()).rejects.toThrow();
});
