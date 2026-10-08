import { beforeEach, describe, expect, it, vi } from "vitest";
import { reportGeolocationFailure } from "./geolocation-monitoring";

describe("geolocation failure monitoring", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null)));
    const matchMedia = vi.fn().mockReturnValue({ matches: false });
    vi.stubGlobal("matchMedia", matchMedia);
    vi.stubGlobal("window", { matchMedia });
    vi.stubGlobal("navigator", { standalone: false });
  });

  it("sends only the closed failure category and browser context", async () => {
    await reportGeolocationFailure("timeout");

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3333/client-events/geolocation",
      expect.objectContaining({
        body: JSON.stringify({ category: "timeout", context: "browser" }),
        credentials: "omit",
        keepalive: true,
      }),
    );
  });

  it("distinguishes an installed standalone web app", async () => {
    vi.mocked(matchMedia).mockReturnValue({
      matches: true,
    } as MediaQueryList);

    await reportGeolocationFailure("position_unavailable");

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          category: "position_unavailable",
          context: "standalone",
        }),
      }),
    );
  });

  it("never disrupts the voting flow when monitoring is unavailable", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("offline"));
    await expect(
      reportGeolocationFailure("network_failure"),
    ).resolves.toBeUndefined();
  });
});
