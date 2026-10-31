import { Check, HelpCircle, RefreshCw } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { type Bathroom, isAvailable, type Report } from "../domain/bathroom";
import { motionTokens, springs } from "../lib/motion";
import { Button, Skeleton } from "./ui";
export function StatusPanel({
  bathroom,
  report,
  now,
  loading,
  error,
  onRetry,
}: {
  bathroom: Bathroom | null;
  report?: Report | null;
  now: number;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const reduced = useReducedMotion();
  if (loading) return <Skeleton />;
  if (error)
    return (
      <div className="status-error" role="alert">
        <p>Couldn't load the latest report</p>
        <Button onClick={onRetry}>
          <RefreshCw size={16} />
          Try again
        </Button>
      </div>
    );
  const state = isAvailable(report, now) ? "available" : "unavailable";
  return (
    <AnimatePresence mode="sync">
      <m.div
        key={`${state}-${bathroom ? "selected" : "empty"}`}
        className={`status-panel ${state}`}
        aria-live="polite"
        aria-atomic="true"
        initial={{ opacity: 0, y: reduced ? 0 : motionTokens.distance.sm }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: reduced ? 0 : -motionTokens.distance.sm }}
        transition={springs.gentle}
      >
        {bathroom ? (
          <div className="status-bar percentage-bar">
            <div
              className="percentage-fill"
              style={{ transform: `scaleX(${state === "available" ? 1 : 0})` }}
              aria-hidden="true"
            />
            <div className="percentage-labels single-status">
              {state === "available" ? (
                <span>
                  <Check size={15} />
                  <span>
                    <strong>Safe trip</strong>
                  </span>
                </span>
              ) : (
                <span>
                  <img
                    src="/assets/cleaning.png"
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                  <span>
                    <strong>Unavailable</strong>
                  </span>
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="status-bar">
            <HelpCircle size={20} />
            <h2>Select your bathroom</h2>
          </div>
        )}
        {bathroom && (
          <p className="report-time">
            {report?.reportedAt
              ? `Last report at ${new Date(report.reportedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
              : "No reports yet"}
          </p>
        )}
      </m.div>
    </AnimatePresence>
  );
}
