import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ANALYTICS_CONSENT_KEY,
  getAnalyticsConsent,
  initializeGoogleAnalytics,
  setAnalyticsConsent,
  trackPageView,
} from "./analytics";

beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  vi.stubGlobal("window", {
    dataLayer: [],
    location: { href: "https://skipthetrip.info/" },
  });
  vi.stubGlobal("document", { title: "Skip The Trip" });
});

describe("analytics consent", () => {
  it("persists accept and decline decisions", () => {
    expect(getAnalyticsConsent()).toBeNull();
    setAnalyticsConsent("accepted");
    expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe("accepted");
    expect(getAnalyticsConsent()).toBe("accepted");
    setAnalyticsConsent("declined");
    expect(getAnalyticsConsent()).toBe("declined");
  });

  it("does not initialize Google Analytics without accepted consent", () => {
    const appendScript = vi.fn();
    initializeGoogleAnalytics("declined", "G-TEST123", appendScript);
    expect(appendScript).not.toHaveBeenCalled();
  });

  it("initializes Google Analytics after accepted consent", () => {
    const appendScript = vi.fn();
    initializeGoogleAnalytics("accepted", "G-TEST123", appendScript);
    expect(appendScript).toHaveBeenCalledWith(
      "https://www.googletagmanager.com/gtag/js?id=G-TEST123",
    );
  });

  it("does not emit future page views after consent is withdrawn", () => {
    const gtag = vi.fn();
    window.gtag = gtag;

    trackPageView("accepted", "G-TEST123", "/before-withdrawal");
    setAnalyticsConsent("declined");
    trackPageView(getAnalyticsConsent(), "G-TEST123", "/after-withdrawal");

    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith(
      "event",
      "page_view",
      expect.objectContaining({ page_path: "/before-withdrawal" }),
    );
  });
});
