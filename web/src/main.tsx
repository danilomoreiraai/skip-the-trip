import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LazyMotion, MotionConfig } from "motion/react";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { initializeObservability } from "./lib/observability";
import "./index.css";

const loadMotion = () =>
  import("./motion-features").then((module) => module.animationFeatures);
const queryClient = new QueryClient();
const root = document.getElementById("root");
if (!root) throw new Error("Root element is missing");
void initializeObservability().catch((error: unknown) => {
  console.error("Observability initialization failed", error);
});
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <LazyMotion features={loadMotion} strict>
            <MotionConfig reducedMotion="user">
              <App />
            </MotionConfig>
          </LazyMotion>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
