import { z } from "zod";

export const geolocationFailureCategorySchema = z.enum([
  "permission_denied",
  "position_unavailable",
  "timeout",
  "insufficient_accuracy",
  "outside_allowed_area",
  "network_failure",
  "authorization_cookie_failure",
  "unexpected",
]);

export const geolocationFailureEventSchema = z
  .object({
    category: geolocationFailureCategorySchema,
    context: z.enum(["browser", "standalone"]),
  })
  .strict();
