import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import {
  type KeyboardEvent,
  lazy,
  type ReactNode,
  Suspense,
  type SyntheticEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Link,
  Route,
  Routes,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import { FavoriteButton, FavoriteSummary } from "./components/Favorite";
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
import {
  type GeolocationFailureCategory,
  reportGeolocationFailure,
} from "./lib/geolocation-monitoring";
import { motionTokens, springs } from "./lib/motion";
import { observability } from "./lib/observability";
import {
  getVoteCooldown,
  type VoteCooldowns,
  withVoteCooldown,
} from "./lib/vote-cooldown";
import { Overview } from "./pages/Overview";
import {
  loadFavorite,
  loadView,
  saveFavorite,
  saveView,
  type View,
} from "./services/preferences";
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
function ModalDialog({
  className,
  labelledBy,
  onCancel,
  returnFocusTo,
  children,
}: {
  className: string;
  labelledBy: string;
  onCancel: (event: SyntheticEvent<HTMLDialogElement>) => void;
  returnFocusTo?: HTMLElement | null;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const containFocus = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== "Tab") return;
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        "button:not(:disabled)",
      ),
    );
    const first = buttons[0];
    const last = buttons.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  useEffect(() => {
    const dialog = ref.current;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>("[data-modal-initial-focus]")?.focus();
    return () => {
      if (dialog?.open) dialog.close();
      const focusTarget = returnFocusTo?.isConnected
        ? returnFocusTo
        : previouslyFocused;
      if (focusTarget?.isConnected) focusTarget.focus();
    };
  }, [returnFocusTo]);
  return (
    <dialog
      ref={ref}
      className={className}
      aria-labelledby={labelledBy}
      onCancel={onCancel}
      onKeyDown={containFocus}
    >
      {children}
    </dialog>
  );
}
const categoryIcons: Record<Bathroom["category"], string> = {
  Female: "/assets/bathroom-female.png",
  Male: "/assets/bathroom-male.png",
  Accessible: "/assets/bathroom-accessible.png",
};
function CategoryIcon({ category }: { category: Bathroom["category"] }) {
  return (
    <img
      className="bathroom-icon"
      src={categoryIcons[category]}
      alt=""
      aria-hidden="true"
      width={48}
      height={48}
    />
  );
}
function Home({
  favorite,
  onFavoriteChange,
}: {
  favorite: Bathroom | null;
  onFavoriteChange: (value: Bathroom | null) => void;
}) {
  const reduced = useReducedMotion();
  const [selection, setSelection] = useState<Partial<Bathroom>>(() => {
    const saved = loadSelection();
    return bathroomSchema.safeParse(saved).success
      ? saved
      : (favorite ?? saved);
  });
  const [now, setNow] = useState(Date.now);
  const [toast, setToast] = useState("");
  const [voteCooldowns, setVoteCooldowns] = useState<VoteCooldowns>({});
  const [pendingVote, setPendingVote] = useState<{
    location: Bathroom;
    available: boolean;
    idempotencyKey: string;
  } | null>(null);
  const [verifyingLocation, setVerifyingLocation] = useState(false);
  const locationJustVerified = useRef(false);
  const voteTrigger = useRef<HTMLButtonElement | null>(null);
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
      locationJustVerified.current = false;
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
        if (locationJustVerified.current) {
          void reportGeolocationFailure("authorization_cookie_failure");
        }
        locationJustVerified.current = false;
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
      locationJustVerified.current = true;
      mutation.mutate(pendingVote);
    } catch (error) {
      locationJustVerified.current = false;
      let failure: GeolocationFailureCategory = "unexpected";
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof error.code === "number"
      ) {
        failure =
          error.code === 1
            ? "permission_denied"
            : error.code === 2
              ? "position_unavailable"
              : "timeout";
        setToast(
          error.code === 1
            ? "Allow location access to vote. You can continue viewing bathroom statuses."
            : "We could not retrieve your location. Try again.",
        );
      } else if (error instanceof LocationVerificationError) {
        failure =
          error.code === "INSUFFICIENT_ACCURACY"
            ? "insufficient_accuracy"
            : error.code === "OUTSIDE_ALLOWED_AREA"
              ? "outside_allowed_area"
              : "unexpected";
        setToast(error.message);
      } else {
        if (error instanceof TypeError) failure = "network_failure";
        setToast("We could not confirm your location. Try again.");
      }
      void reportGeolocationFailure(failure);
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
        {bathroom && (
          <FavoriteButton
            bathroom={bathroom}
            favorite={favorite}
            onChange={onFavoriteChange}
          />
        )}
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
              onClick={(event) => {
                voteTrigger.current = event.currentTarget;
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
              onClick={(event) => {
                voteTrigger.current = event.currentTarget;
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
      {toast && !pendingVote && (
        <Toast message={toast} onClose={() => setToast("")} />
      )}
      {pendingVote && (
        <ModalDialog
          className="location-dialog"
          labelledBy="location-dialog-title"
          returnFocusTo={voteTrigger.current}
          onCancel={(event) => {
            if (verifyingLocation) event.preventDefault();
            else setPendingVote(null);
          }}
        >
          {toast && <Toast message={toast} onClose={() => setToast("")} />}
          <h2 id="location-dialog-title">Confirm your location to vote</h2>
          <p>
            We discard your coordinates after verification. Verification lasts 4
            hours.
          </p>
          <div>
            <button
              type="button"
              data-modal-initial-focus
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
        </ModalDialog>
      )}
    </m.main>
  );
}
function PublicHome({ buildingRoute = false }: { buildingRoute?: boolean }) {
  const [selectionVersion, setSelectionVersion] = useState(0);
  const [search, setSearch] = useSearchParams();
  const [view, setView] = useState<View>(() =>
    search.get("view") === "contribute"
      ? "contribute"
      : search.get("view") === "overview" || buildingRoute
        ? "overview"
        : loadView(),
  );
  const [favorite, setFavorite] = useState(loadFavorite);
  const changeFavorite = (value: Bathroom | null) => {
    saveFavorite(value);
    setFavorite(value);
  };
  const changeView = (value: View) => {
    saveView(value);
    setView(value);
    setSearch(
      (previous) => {
        previous.set("view", value);
        return previous;
      },
      { replace: true },
    );
  };
  const contribute = (bathroom: Bathroom) => {
    saveSelection(bathroom);
    setSelectionVersion((value) => value + 1);
    changeView("contribute");
  };
  return (
    <>
      <nav className="view-switch" aria-label="View mode">
        <button
          type="button"
          aria-pressed={view === "overview"}
          onClick={() => changeView("overview")}
        >
          Consult
        </button>
        <button
          type="button"
          aria-pressed={view === "contribute"}
          onClick={() => changeView("contribute")}
        >
          Contribute
        </button>
        <Link
          to="/HH5"
          onClick={() => {
            if (buildingRoute) changeView("overview");
          }}
        >
          HH5 building page
        </Link>
      </nav>
      <FavoriteSummary
        favorite={favorite}
        onChange={changeFavorite}
        onOpen={() => {
          if (favorite) contribute(favorite);
        }}
      />
      {view === "overview" ? (
        <Overview
          favorite={favorite}
          onFavoriteChange={changeFavorite}
          onContribute={contribute}
        />
      ) : (
        <Home
          key={selectionVersion}
          favorite={favorite}
          onFavoriteChange={changeFavorite}
        />
      )}
    </>
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
              <Route path="/" element={<PublicHome />} />
              <Route path="/HH5" element={<PublicHome buildingRoute />} />
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
        <ModalDialog
          className="consent-popup"
          labelledBy="analytics-consent-title"
          onCancel={(event) => event.preventDefault()}
        >
          <p id="analytics-consent-title">
            This site uses Google Analytics to count visits. It shows no ads and
            does not follow you to other sites. Is that okay?
          </p>
          <div>
            <button
              type="button"
              data-modal-initial-focus
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
        </ModalDialog>
      )}
    </div>
  );
}
