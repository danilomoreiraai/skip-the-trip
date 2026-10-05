import { Check, HelpCircle, RefreshCw } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { type Bathroom, isRecent, type Report } from "../domain/bathroom";
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
  const yes = report?.yesCount ?? 0;
  const no = report?.noCount ?? 0;
  const total = yes + no;
  const percentage = total ? Math.round((yes / total) * 100) : 0;
  const recent = isRecent(report, now);
  const state = recent
    ? report?.available
      ? "available"
      : "unavailable"
    : "unknown";
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
        {bathroom && recent && total > 0 ? (
          <div className="status-bar percentage-bar">
            <meter
              className="sr-only"
              min={0}
              max={100}
              value={percentage}
              aria-label="YES vote percentage"
            >
              {percentage}% YES
            </meter>
            <div
              className="percentage-fill"
              style={{ transform: `scaleX(${yes / total})` }}
              aria-hidden="true"
            />
            <div
              className={`percentage-labels ${yes === 0 || no === 0 ? "single-status" : ""}`}
            >
              {yes > 0 && (
                <span>
                  <Check size={15} />
                  <span>
                    <strong>Safe trip</strong>
                  </span>
                </span>
              )}
              {no > 0 && (
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
            <h2>
              {bathroom ? "No recent information" : "Select your bathroom"}
            </h2>
          </div>
        )}
        {bathroom && (
          <p className="report-time">
            {report
              ? `${recent ? "Reported" : "Last report"} at ${new Date(report.reportedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}${recent ? "" : " · Expired"}`
              : "Be the first to report"}
          </p>
        )}
      </m.div>
    </AnimatePresence>
  );
}
