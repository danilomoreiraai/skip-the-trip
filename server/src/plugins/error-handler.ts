import type { FastifyInstance } from "fastify";
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from "fastify-type-provider-zod";
import {
  CleaningInProgressError,
  OperationsError,
} from "../domain/cleaning.js";

type CaptureException = (
  error: unknown,
  context: { requestId: string; route: string },
) => void;

export function registerErrorHandler(
  app: FastifyInstance,
  captureException?: CaptureException,
) {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof CleaningInProgressError)
      return reply.status(409).send({
        code: error.code,
        message: error.message,
        expectedEndAt: error.expectedEndAt.toISOString(),
        statusCode: 409,
      });
    if (error instanceof OperationsError)
      return reply.status(error.statusCode).send({
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
      });
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply
        .status(400)
        .send({ message: "Invalid request", statusCode: 400 });
    }
    if (isResponseSerializationError(error)) {
      request.log.error({ err: error }, "Response serialization failed");
      captureException?.(new Error("Request failed"), {
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
      captureException?.(new Error("Request failed"), {
        requestId: request.id,
        route: request.routeOptions.url ?? "unknown",
      });
    }
    return reply.status(statusCode).send({
      message: statusCode === 500 ? "Internal server error" : "Request failed",
      statusCode,
    });
  });
}
