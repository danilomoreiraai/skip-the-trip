import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import type { AnalyticsConsent } from "../lib/analytics";

export function Privacy({
  consent,
  onConsentChange,
}: {
  consent: AnalyticsConsent | null;
  onConsentChange: (consent: AnalyticsConsent) => void;
}) {
  return (
    <main className="document-card">
      <Link className="back-link" to="/">
        <ArrowLeft size={16} />
        Back to the app
      </Link>
      <span className="eyebrow">YOUR DATA, EXPLAINED</span>
      <h1>Privacy, kept simple.</h1>
      <p>
        This is a prototype of Skip The Trip. It helps demonstrate how shared
        bathroom availability reports could work.
      </p>
      <h2>What stays on this device</h2>
      <p>
        Your Yes/No report, bathroom selection, anonymous browser identifier and
        timestamp are sent to the Skip The Trip API and stored in its database.
        Your current building, floor and bathroom selection is also kept in
        session storage on this device.
      </p>
      <h2>Location verification</h2>
      <p>
        Location is requested only when you choose to vote. The API checks
        whether you are near HH5 and discards the coordinates immediately after
        that check. It stores only the result and a four-hour authorization
        period. Location verification is separate from your analytics choice.
        When verification fails, the service counts only a predefined failure
        category and whether the app is running in a browser or as an installed
        web app. It does not send coordinates, free-form error messages or a
        browser identifier with this monitoring event.
      </p>
      <h2>No accounts or advertising tracking</h2>
      <p>
        This site has no login, advertising pixels or session recording. With
        your permission, Google Analytics counts visits without advertising
        features or cross-site tracking. A configured deployment may also send
        technical error and performance diagnostics to its observability
        provider. These diagnostics exclude your bathroom selection and vote
        location.
      </p>
      <h2>Analytics preference</h2>
      <p>
        Current choice: <strong>{consent ?? "not selected"}</strong>. You can
        change it at any time.
      </p>
      <fieldset className="privacy-actions">
        <legend className="sr-only">Analytics preference</legend>
        <button type="button" onClick={() => onConsentChange("accepted")}>
          Accept analytics
        </button>
        <button type="button" onClick={() => onConsentChange("declined")}>
          Decline analytics
        </button>
      </fieldset>
      <h2>Removing your data</h2>
      <p>
        You can remove the anonymous browser identifier and current selection
        through your browser’s site settings. Closing the tab ends the selection
        session. A report stops determining availability after 30 minutes, but
        server-side retention rules remove expired operational records.
      </p>
      <h2>Before a public release</h2>
      <p>
        A production privacy policy, responsible organization and contact
        channel will be defined before collecting or sharing any real user data.
      </p>
    </main>
  );
}
export function NotFound() {
  return (
    <main className="document-card not-found">
      <span className="eyebrow">404 · A SMALL DETOUR</span>
      <h1>This stop doesn’t exist.</h1>
      <p>Let’s get you back on the right path.</p>
      <Link className="button" to="/">
        <ArrowLeft size={17} />
        Back to the app
      </Link>
    </main>
  );
}
