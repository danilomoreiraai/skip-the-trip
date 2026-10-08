import { env } from "../env";

export type GeolocationFailureCategory =
  | "permission_denied"
  | "position_unavailable"
  | "timeout"
  | "insufficient_accuracy"
  | "outside_allowed_area"
  | "network_failure"
  | "authorization_cookie_failure"
  | "unexpected";

function browserContext(): "browser" | "standalone" {
  const iosNavigator = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches ||
    iosNavigator.standalone === true
    ? "standalone"
    : "browser";
}

export async function reportGeolocationFailure(
  category: GeolocationFailureCategory,
) {
  try {
    await fetch(
      `${env.VITE_API_URL.replace(/\/$/, "")}/client-events/geolocation`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, context: browserContext() }),
        credentials: "omit",
        keepalive: true,
      },
    );
  } catch {
    // Monitoring must never interfere with location verification or voting.
  }
}
