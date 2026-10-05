import { Check, LoaderCircle, X } from "lucide-react";
import {
  AnimatePresence,
  type HTMLMotionProps,
  m,
  useReducedMotion,
} from "motion/react";
import type { ReactNode } from "react";
import { motionTokens, springs } from "../lib/motion";
export function Button({
  children,
  className = "",
  ...props
}: HTMLMotionProps<"button">) {
  return (
    <m.button
      type="button"
      className={`button ${className}`}
      whileHover={
        props.disabled ? undefined : { scale: motionTokens.scale.pop }
      }
      whileTap={
        props.disabled ? undefined : { scale: motionTokens.scale.press }
      }
      transition={springs.snappy}
      {...props}
    >
      {children}
    </m.button>
  );
}
export function Spinner() {
  return <LoaderCircle className="spinner" size={18} aria-label="Loading" />;
}
export function Selector<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
  renderIcon,
}: {
  label: string;
  options: readonly T[];
  value?: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  renderIcon?: (value: T) => ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <fieldset
      className={`selector ${disabled ? "locked" : ""}`}
      disabled={disabled}
    >
      <legend>{label}</legend>
      <div className={`options ${renderIcon ? "category-options" : ""}`}>
        {options.map((option, index) => (
          <m.div
            key={option}
            initial={reduced ? false : { opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? 0 : -motionTokens.distance.xs }}
            transition={{
              delay: reduced ? 0 : index * 0.06,
              duration: motionTokens.duration.fast,
              ease: motionTokens.easing.smooth,
            }}
          >
            <button
              type="button"
              aria-pressed={value === option}
              className={`option ${value === option ? "selected" : ""}`}
              onClick={() => onChange(option)}
            >
              {renderIcon?.(option)}
              <span>{option}</span>
              {renderIcon && value === option && (
                <Check className="category-check" size={14} />
              )}
            </button>
          </m.div>
        ))}
      </div>
    </fieldset>
  );
}
export function Skeleton() {
  return (
    <div
      className="status-skeleton"
      role="status"
      aria-label="Loading latest report"
    >
      <div className="shimmer skeleton-title" />
      <div className="shimmer skeleton-line" />
      <div className="shimmer skeleton-line short" />
    </div>
  );
}
export function AppSkeleton() {
  return (
    <main className="app-skeleton" role="status" aria-label="Loading page">
      <div className="shimmer skeleton-chip" />
      <div className="shimmer skeleton-heading" />
      <div className="shimmer skeleton-control" />
      <div className="skeleton-grid">
        <div className="shimmer skeleton-tile" />
        <div className="shimmer skeleton-tile" />
        <div className="shimmer skeleton-tile" />
      </div>
      <span className="sr-only">Loading</span>
    </main>
  );
}
export function Toast({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      <m.div
        key={message}
        className="toast"
        role="status"
        initial={{ opacity: 0, y: motionTokens.distance.md }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: motionTokens.distance.sm }}
        transition={springs.snappy}
      >
        <Check size={18} />
        <span>{message}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss notification"
        >
          <X size={17} />
        </button>
      </m.div>
    </AnimatePresence>
  );
}
