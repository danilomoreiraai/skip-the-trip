import { Component, type ErrorInfo, type ReactNode } from "react";
import { observability } from "../lib/observability";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    observability.captureException(error, {
      componentStack: info.componentStack,
    });
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="fatal-error" role="alert">
          <span>Service interruption</span>
          <h1>We hit an unexpected stop.</h1>
          <p>Your local reports are safe. Reload the page to try again.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload application
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
