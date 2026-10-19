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

  it("queues initialization and page views in the Google tag arguments format", () => {
    initializeGoogleAnalytics("accepted", "G-TEST123", vi.fn());
    trackPageView("accepted", "G-TEST123", "/");

    const commands = window.dataLayer ?? [];
    expect(commands).toHaveLength(3);
    for (const command of commands) {
      expect(Object.prototype.toString.call(command)).toBe(
        "[object Arguments]",
      );
    }
    expect(
      commands.map((command) => Array.from(command as IArguments)),
    ).toEqual([
      ["js", expect.any(Date)],
      [
        "config",
        "G-TEST123",
        {
          anonymize_ip: true,
          allow_google_signals: false,
          allow_ad_personalization_signals: false,
          send_page_view: false,
        },
      ],
      [
        "event",
        "page_view",
        {
          page_location: "https://skipthetrip.info/",
          page_path: "/",
          page_title: "Skip The Trip",
        },
      ],
    ]);
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
