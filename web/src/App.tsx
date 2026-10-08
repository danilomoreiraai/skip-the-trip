import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Accessibility } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { lazy, Suspense, useEffect, useState } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { StatusPanel } from "./components/StatusPanel";
import { AppSkeleton, Button, Selector, Spinner, Toast } from "./components/ui";
import {
  type Bathroom,
  bathroomKey,
  bathroomSchema,
  buildings,
  categories,
  floors,
  isBuildingAvailable,
} from "./domain/bathroom";
import { env } from "./env";
import {
  type AnalyticsConsent,
  getAnalyticsConsent,
  initializeGoogleAnalytics,
  setAnalyticsConsent,
  trackPageView,
} from "./lib/analytics";
import { motionTokens, springs } from "./lib/motion";
import { observability } from "./lib/observability";
import {
  getVoteCooldown,
  type VoteCooldowns,
  withVoteCooldown,
} from "./lib/vote-cooldown";
import {
  getReport,
  LocationVerificationError,
  LocationVerificationRequiredError,
  loadSelection,
  saveSelection,
  submitReport,
  VoteCooldownError,
  verifyLocation,
} from "./services/reports";

const Privacy = lazy(() =>
  import("./pages/Information").then((module) => ({ default: module.Privacy })),
);
const NotFound = lazy(() =>
  import("./pages/Information").then((module) => ({
    default: module.NotFound,
  })),
);
function CategoryIcon({ category }: { category: string }) {
  if (category === "Accessible")
    return (
      <Accessibility className="bathroom-icon" size={40} strokeWidth={1.8} />
    );
  return (
    <span
      className={`bathroom-icon person-icon ${category.toLowerCase()}`}
      aria-hidden="true"
    />
  );
}
function Home() {
  const reduced = useReducedMotion();
  const [selection, setSelection] = useState<Partial<Bathroom>>(loadSelection);
  const [now, setNow] = useState(Date.now);
  const [toast, setToast] = useState("");
  const [voteCooldowns, setVoteCooldowns] = useState<VoteCooldowns>({});
  const [pendingVote, setPendingVote] = useState<{
    location: Bathroom;
    available: boolean;
    idempotencyKey: string;
  } | null>(null);
  const [verifyingLocation, setVerifyingLocation] = useState(false);
  const client = useQueryClient();
  const parsed = bathroomSchema.safeParse(selection);
  const bathroom = parsed.success ? parsed.data : null;
  const key = bathroom ? bathroomKey(bathroom) : "none";
  const voteCooldownUntil = getVoteCooldown(voteCooldowns, bathroom);
  const query = useQuery({
    queryKey: ["report", key],
    queryFn: () => {
      if (!bathroom) throw new Error("Select a bathroom");
      return getReport(bathroom);
    },
    enabled: Boolean(bathroom),
    retry: false,
    refetchInterval: bathroom ? 5_000 : false,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });
  const mutation = useMutation({
    mutationFn: ({
      location,
      available,
      idempotencyKey,
    }: {
      location: Bathroom;
      available: boolean;
      idempotencyKey: string;
    }) => submitReport(location, available, idempotencyKey),
    onSuccess: (report, variables) => {
      client.setQueryData(["report", bathroomKey(variables.location)], report);
      setNow(Date.now());
      setVoteCooldowns((current) =>
        withVoteCooldown(current, variables.location, Date.now() + 5 * 60_000),
      );
      observability.trackEvent("report.submitted", {
        "report.available": variables.available,
      });
      setToast("Thanks! Your update helps the next person.");
      setPendingVote(null);
    },
    onError: (error, variables) => {
      observability.captureException(error, { operation: "submit-report" });
      if (error instanceof LocationVerificationRequiredError) {
        setPendingVote(variables);
      } else if (error instanceof VoteCooldownError) {
        setVoteCooldowns((current) =>
          withVoteCooldown(
            current,
            variables.location,
            Date.now() + error.retryAfterSeconds * 1000,
          ),
        );
        setToast(
          `Please wait ${error.retryAfterSeconds}s before voting again.`,
        );
      } else {
        setToast("Could not save your update. Please try again.");
      }
    },
  });
  const requestLocationAndVote = async () => {
    if (!pendingVote) return;
    setVerifyingLocation(true);
    try {
      const getPosition = (options: PositionOptions) =>
        new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, options);
        });
      let position: GeolocationPosition;
      try {
        position = await getPosition({
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 10_000,
        });
      } catch (error) {
        if (
          typeof error !== "object" ||
          error === null ||
          !("code" in error) ||
          error.code === 1
        ) {
          throw error;
        }
        position = await getPosition({
          enableHighAccuracy: false,
          maximumAge: 60_000,
          timeout: 20_000,
        });
      }
      await verifyLocation("HH5", position.coords);
      mutation.mutate(pendingVote);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof error.code === "number"
      ) {
        setToast(
          error.code === 1
            ? "Allow location access to vote. You can continue viewing bathroom statuses."
            : "We could not retrieve your location. Try again.",
        );
      } else if (error instanceof LocationVerificationError) {
        setToast(error.message);
      } else {
        setToast("We could not confirm your location. Try again.");
      }
    } finally {
      setVerifyingLocation(false);
    }
  };
  const vote = (location: Bathroom, available: boolean) =>
    mutation.mutate({
      location,
      available,
      idempotencyKey: crypto.randomUUID(),
    });
  useEffect(() => {
    saveSelection(selection);
  }, [selection]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const changeSelection = (next: Partial<Bathroom>) => {
    mutation.reset();
    setSelection(next);
    observability.trackEvent("selection.changed", {
      "selection.complete": bathroomSchema.safeParse(next).success,
    });
  };
  const progress = selection.category
    ? 100
    : selection.floor
      ? 72
      : selection.building
        ? 42
        : 12;
  return (
    <m.main
      className="home-layout"
      initial={{ opacity: 0, y: reduced ? 0 : motionTokens.distance.md }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduced ? 0 : -motionTokens.distance.sm }}
      transition={{
        duration: motionTokens.duration.normal,
        ease: motionTokens.easing.smooth,
      }}
    >
      <section className="app-card" aria-label="Bathroom availability checker">
        <div className="product-intro">
          <span className="eyebrow">Live building utility</span>
          <h1>Is it worth the trip?</h1>
          <p>Three quick choices. One useful answer.</p>
        </div>
        <div
          className="journey-progress"
          aria-label={`${progress}% complete`}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <m.span
            animate={{ scaleX: progress / 100 }}
            transition={springs.gentle}
          />
        </div>
        <Selector
          label="Select building"
          options={buildings}
          value={selection.building}
          disabled={mutation.isPending}
          isOptionDisabled={(building) => !isBuildingAvailable(building)}
          getOptionHint={(building) =>
            isBuildingAvailable(building) ? undefined : "Available soon"
          }
          onChange={(building) => changeSelection({ building })}
        />
        <Selector
          label="Select floor"
          options={floors}
          value={selection.floor}
          disabled={!selection.building || mutation.isPending}
          onChange={(floor) =>
            changeSelection({ building: selection.building, floor })
          }
        />
        <Selector
          label="Select user"
          options={categories}
          value={selection.category}
          disabled={!selection.floor || mutation.isPending}
          onChange={(category) => changeSelection({ ...selection, category })}
          renderIcon={(category) => <CategoryIcon category={category} />}
        />
        <h2 className="availability-label">Available ?</h2>
        <div className="vote-section">
          <div className="vote-buttons">
            <Button
              className="vote-yes"
              aria-label="Yes, available"
              disabled={
                !bathroom ||
                query.isPending ||
                query.isError ||
                mutation.isPending ||
                now < voteCooldownUntil
              }
              onClick={() => {
                if (bathroom) vote(bathroom, true);
              }}
            >
              {mutation.isPending && mutation.variables.available ? (
                <Spinner />
              ) : null}
              Yes
              {bathroom && !query.isPending && !query.isError && (
                <span
                  key={`yes-${key}-${query.data?.yesCount ?? 0}`}
                  className="vote-badge yes-badge"
                  role="status"
                  aria-label={`${query.data?.yesCount ?? 0} YES votes`}
                >
                  {query.data?.yesCount ?? 0}
                </span>
              )}
            </Button>
            <Button
              className="vote-no"
              aria-label="No, unavailable"
              disabled={
                !bathroom ||
                query.isPending ||
                query.isError ||
                mutation.isPending ||
                now < voteCooldownUntil
              }
              onClick={() => {
                if (bathroom) vote(bathroom, false);
              }}
            >
              {mutation.isPending && !mutation.variables.available ? (
                <Spinner />
              ) : null}
              No
              {bathroom && !query.isPending && !query.isError && (
                <span
                  key={`no-${key}-${query.data?.noCount ?? 0}`}
                  className="vote-badge no-badge"
                  role="status"
                  aria-label={`${query.data?.noCount ?? 0} NO votes`}
                >
                  {query.data?.noCount ?? 0}
                </span>
              )}
            </Button>
          </div>
          {bathroom && now < voteCooldownUntil && (
            <p className="cooldown-note" role="status">
              Vote again in {Math.ceil((voteCooldownUntil - now) / 1000)}s
            </p>
          )}
          <StatusPanel
            bathroom={bathroom}
            report={query.data}
            now={now}
            loading={Boolean(bathroom) && query.isPending}
            error={query.isError}
            onRetry={() => {
              void query.refetch();
            }}
          />
        </div>
      </section>
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
      {pendingVote && (
        <section
          className="location-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="location-dialog-title"
        >
          <h2 id="location-dialog-title">Confirm your location to vote</h2>
          <p>
            We discard your coordinates after verification. Verification lasts 4
            hours.
          </p>
          <div>
            <button
              type="button"
              disabled={verifyingLocation}
              onClick={() => void requestLocationAndVote()}
            >
              {verifyingLocation
                ? "Confirming your location…"
                : "Confirm location"}
            </button>
            <button
              type="button"
              disabled={verifyingLocation}
              onClick={() => setPendingVote(null)}
            >
              Cancel
            </button>
          </div>
        </section>
      )}
    </m.main>
  );
}
export function App() {
  const location = useLocation();
  const [analyticsConsent, setConsent] = useState<AnalyticsConsent | null>(
    getAnalyticsConsent,
  );
  const changeAnalyticsConsent = (consent: AnalyticsConsent) => {
    setAnalyticsConsent(consent);
    setConsent(consent);
  };
  useEffect(() => {
    initializeGoogleAnalytics(analyticsConsent, env.VITE_GOOGLE_ANALYTICS_ID);
    trackPageView(
      analyticsConsent,
      env.VITE_GOOGLE_ANALYTICS_ID,
      `${location.pathname}${location.search}`,
    );
  }, [analyticsConsent, location.pathname, location.search]);
  return (
    <div className="experience" data-theme="signal-core">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <m.div className="site-shell" layout transition={springs.gentle}>
        <header className="site-header">
          <Link to="/" className="brand" aria-label="Skip the Trip home">
            <span className="brand-dots">
              <i />
              <i />
              <i />
            </span>
            <span className="brand-name">SKIP THE TRIP</span>
            <span className="brand-edition">Signal Core</span>
          </Link>
        </header>
        <Suspense fallback={<AppSkeleton />}>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<Home />} />
              <Route
                path="/privacy"
                element={
                  <Privacy
                    consent={analyticsConsent}
                    onConsentChange={changeAnalyticsConsent}
                  />
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AnimatePresence>
        </Suspense>
        <footer className="site-footer">
          <span>Local demo · Reports valid for 30 min</span>
          <Link to="/privacy">Privacy</Link>
        </footer>
      </m.div>
      {analyticsConsent === null && (
        <section
          className="consent-popup"
          role="dialog"
          aria-modal="true"
          aria-labelledby="analytics-consent-title"
        >
          <p id="analytics-consent-title">
            This site uses Google Analytics to count visits. It shows no ads and
            does not follow you to other sites. Is that okay?
          </p>
          <div>
            <button
              type="button"
              onClick={() => changeAnalyticsConsent("accepted")}
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => changeAnalyticsConsent("declined")}
            >
              Decline
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
