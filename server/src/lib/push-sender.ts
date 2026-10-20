import webpush from "web-push";
import { hashToken } from "../domain/cleaning.js";
import type { PushSender } from "../modules/push/repository.js";
export function createPushSender(config: {
  subject: string;
  publicKey: string;
  privateKey: string;
}): PushSender {
  return async (subscription, payload, ttl) => {
    await webpush.sendNotification(subscription, JSON.stringify(payload), {
      vapidDetails: config,
      TTL: ttl,
      urgency: "high",
      timeout: 10_000,
      topic: hashToken(payload.cycleId).slice(0, 32),
    });
  };
}
