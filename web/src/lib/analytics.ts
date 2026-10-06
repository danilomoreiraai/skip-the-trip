export type AnalyticsConsent = "accepted" | "declined";

export const ANALYTICS_CONSENT_KEY = "skip-the-trip:analytics-consent:v1";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function getAnalyticsConsent(): AnalyticsConsent | null {
  try {
    const value = localStorage.getItem(ANALYTICS_CONSENT_KEY);
    return value === "accepted" || value === "declined" ? value : null;
  } catch {
    return null;
  }
}

export function setAnalyticsConsent(consent: AnalyticsConsent) {
  try {
    localStorage.setItem(ANALYTICS_CONSENT_KEY, consent);
  } catch {
    // The choice still applies for the current page through React state.
  }
}

function appendGoogleScript(url: string) {
  if (document.querySelector(`script[src="${url}"]`)) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = url;
  document.head.append(script);
}

export function initializeGoogleAnalytics(
  consent: AnalyticsConsent | null,
  measurementId: string | undefined,
  appendScript: (url: string) => void = appendGoogleScript,
) {
  if (consent !== "accepted" || !measurementId) return;
  appendScript(`https://www.googletagmanager.com/gtag/js?id=${measurementId}`);
  window.dataLayer ??= [];
  window.gtag ??= (...args: unknown[]) => window.dataLayer?.push(args);
  window.gtag("js", new Date());
  window.gtag("config", measurementId, {
    anonymize_ip: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    send_page_view: false,
  });
}

export function trackPageView(
  consent: AnalyticsConsent | null,
  measurementId: string | undefined,
  path: string,
) {
  if (consent !== "accepted" || !measurementId || !window.gtag) return;
  window.gtag("event", "page_view", {
    page_location: window.location.href,
    page_path: path,
    page_title: document.title,
  });
}
