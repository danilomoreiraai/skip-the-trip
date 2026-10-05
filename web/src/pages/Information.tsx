import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
export function Privacy() {
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
        Your Yes/No report, bathroom location, anonymous installation ID and
        timestamp are sent to the Skip The Trip API and stored in its database.
        Your current building, floor and bathroom selection is also kept in
        session storage on this device.
      </p>
      <h2>No accounts or behavioral tracking</h2>
      <p>
        This prototype has no login, advertising pixels, session recording or
        tracking cookies. A configured production deployment may send technical
        error and performance diagnostics to its observability provider. These
        diagnostics exclude your bathroom selection and vote location.
      </p>
      <h2>Removing your data</h2>
      <p>
        You can remove the anonymous installation ID and current selection
        through your browser’s site settings. Closing the tab ends the selection
        session. A report stops determining availability after 30 minutes, but
        server-side retention and deletion rules still need to be finalized
        before a public release.
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
