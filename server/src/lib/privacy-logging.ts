import type { FastifyRequest } from "fastify";

/** Allowlist diagnostics: never serialize request URLs, headers or arbitrary errors. */
export function privacyLogger(level: string) {
  return {
    level,
    serializers: {
      req: (request: FastifyRequest) => ({ method: request.method }),
      err: () => ({ type: "Error", message: "Request failed", stack: "" }),
    },
  };
}
