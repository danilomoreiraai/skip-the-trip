import type { FastifyInstance } from "fastify";
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from "fastify-type-provider-zod";

type CaptureException = (
  error: unknown,
  context: { requestId: string; route: string },
) => void;

export function registerErrorHandler(
  app: FastifyInstance,
  captureException?: CaptureException,
) {
  app.setErrorHandler((error, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply
        .status(400)
        .send({ message: "Invalid request", statusCode: 400 });
    }
    if (isResponseSerializationError(error)) {
      request.log.error({ err: error }, "Response serialization failed");
      captureException?.(error, {
        requestId: request.id,
        route: request.routeOptions.url ?? "unknown",
      });
      return reply
        .status(500)
        .send({ message: "Internal server error", statusCode: 500 });
    }
    const candidateStatus =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : 500;
    const statusCode = candidateStatus < 500 ? candidateStatus : 500;
    if (statusCode === 500) {
      request.log.error({ err: error }, "Unhandled request error");
      captureException?.(error, {
        requestId: request.id,
        route: request.routeOptions.url ?? "unknown",
      });
    }
    return reply.status(statusCode).send({
      message:
        statusCode === 500
          ? "Internal server error"
          : error instanceof Error
            ? error.message
            : "Request failed",
      statusCode,
    });
  });
}
