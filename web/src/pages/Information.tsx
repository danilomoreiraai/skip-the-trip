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
      <span className="eyebrow">LAST UPDATED 12 OCTOBER 2026</span>
      <h1>Privacy notice</h1>
      <p>
        Skip The Trip is a personal educational and portfolio project operated
        in Ireland. It demonstrates how shared bathroom availability reports
        could work; it is not an emergency or public-authority service.
      </p>
      <h2>Who is responsible</h2>
      <p>
        <strong>Danilo Moreira</strong> is the data controller. For privacy
        questions or requests, email{" "}
        <a href="mailto:privacy@skipthetrip.info">privacy@skipthetrip.info</a>.
        For general help, email{" "}
        <a href="mailto:support@skipthetrip.info">support@skipthetrip.info</a>.
      </p>
      <h2>What the project processes and why</h2>
      <p>
        When you vote, the API receives the bathroom selection, Yes/No report,
        an idempotency key, timestamps and a random browser identifier. The
        identifier is stored in an HttpOnly cookie for up to 30 days and is not
        an account. The project uses this information to display recent
        availability, enforce cooldowns and resist duplicate votes.
      </p>
      <p>
        The current building, floor and bathroom selection remain in session
        storage on your device. The analytics preference remains in local
        storage. The essential voting data is processed on the basis of the
        controller&apos;s legitimate interests in operating, securing and
        demonstrating the project with limited, pseudonymous data.
      </p>
      <h2>Location verification</h2>
      <p>
        Location is requested only when you choose to vote. Latitude, longitude
        and accuracy are used in memory to check whether you are near HH5. They
        are discarded immediately after the check and are not written to the
        application database, logs, traces, metrics or alerts. A successful
        check stores only the random identifier, location ID, verification time
        and a four-hour authorization expiry. Expired authorizations are removed
        by the scheduled retention process.
      </p>
      <p>
        Failed checks increment a metric containing only a predefined failure
        category and browser/installed-app context. It contains no coordinates,
        free-form message or browser identifier.
      </p>
      <h2>Analytics and diagnostics</h2>
      <p>
        Google Analytics is optional and loads only after consent. Advertising
        personalization, Google Signals, advertising pixels and session replay
        are not used. Technical diagnostics and infrastructure metrics may be
        processed by configured hosting and observability providers to keep the
        project reliable and secure; they must not contain coordinates or vote
        details.
      </p>
      <p>
        Current analytics choice: <strong>{consent ?? "not selected"}</strong>.
        You may change it at any time. Declining or withdrawing stops future
        analytics events from this browser, but cannot recall events already
        received by the analytics provider.
      </p>
      <fieldset className="privacy-actions">
        <legend className="sr-only">Analytics preference</legend>
        <button
          type="button"
          aria-pressed={consent === "accepted"}
          onClick={() => onConsentChange("accepted")}
        >
          {consent === "accepted" && <span aria-hidden="true">✓ </span>}
          Accept analytics
        </button>
        <button
          type="button"
          aria-pressed={consent === "declined"}
          onClick={() => onConsentChange("declined")}
        >
          {consent === "declined" && <span aria-hidden="true">✓ </span>}
          Decline analytics
        </button>
      </fieldset>
      <h2>Retention and recipients</h2>
      <p>
        A vote affects availability for 30 minutes. Operational report data is
        deleted by the scheduled retention process using the configured 30-day
        window. Location authorization lasts four hours and is removed after it
        expires. Production Prometheus metrics are retained for 30 days. Backup,
        hosting, analytics and diagnostic providers apply their configured or
        contractual retention periods.
      </p>
      <p>
        Data may be processed by the project&apos;s infrastructure, database,
        backup and observability providers. Google receives analytics data only
        after consent. Apple iCloud processes messages sent to the project
        contact addresses, and GoDaddy receives aggregate DMARC email-security
        reports. Providers may process data outside the EEA under their
        applicable safeguards.
      </p>
      <h2>Cleaning team updates</h2>
      <p>
        Cleaning updates are attributed publicly to the team. Individual cleaner
        access is restricted, revocable and separate from public voting. Team
        updates include the reported time and estimated end; they do not
        guarantee the physical condition or availability of a bathroom. A saved
        favorite stays in this browser and can be removed in the app.
      </p>
      <h2>Optional cleaning notifications</h2>
      <p>
        Notifications require a separate choice and browser permission,
        independently from analytics. We store your selected favorite and
        protected subscription details to deliver new cleaning-team updates
        through your browser provider. You can turn notifications off in the
        app; removing your favorite also requests cancellation. Inactive
        subscriptions expire after 30 days. On iPhone/iPad, add the app to the
        Home Screen before enabling notifications. Delivery can be delayed or
        unavailable.
      </p>
      <h2>Your choices and rights</h2>
      <p>
        Depending on the circumstances, you may request access, correction,
        deletion, restriction, portability or object to processing. You may
        withdraw analytics consent using the buttons above. Clearing this
        site&apos;s browser data removes the local identifier, selection and
        preference, but does not itself delete records already sent to the API.
      </p>
      <p>
        Because there are no user accounts, the controller may be unable to
        locate a particular server record without the anonymous identifier from
        your browser. Email{" "}
        <a href="mailto:privacy@skipthetrip.info">privacy@skipthetrip.info</a>{" "}
        and provide only the minimum information needed for the request. Do not
        send passwords, identity documents or precise location data unless the
        controller explains why additional verification is reasonably necessary.
      </p>
      <p>
        If you are dissatisfied with the response, you may complain to the{" "}
        <a
          href="https://www.dataprotection.ie/"
          rel="noreferrer"
          target="_blank"
        >
          Irish Data Protection Commission
        </a>
        . This notice will be reviewed when the project&apos;s processing or
        providers change.
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
