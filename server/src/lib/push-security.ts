import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
export type PushSubscriptionData = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};
export function allowedPushEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.hash ||
      url.search
    )
      return false;
    return (
      (url.hostname === "fcm.googleapis.com" &&
        url.pathname.startsWith("/fcm/send/")) ||
      (url.hostname === "updates.push.services.mozilla.com" &&
        url.pathname.startsWith("/wpush/v2/")) ||
      (url.hostname === "web.push.apple.com" && url.pathname.length > 1)
    );
  } catch {
    return false;
  }
}
export function encryptSubscription(value: PushSubscriptionData, key: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "base64"), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((value) => value.toString("base64url"))
    .join(".");
}
export function decryptSubscription(
  value: string,
  key: string,
): PushSubscriptionData {
  const parts = value.split(".");
  if (parts.length !== 3) throw new Error("Invalid encrypted subscription");
  const [iv, tag, encrypted] = parts.map((value) =>
    Buffer.from(value, "base64url"),
  );
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(key, "base64"),
    iv!,
  );
  decipher.setAuthTag(tag!);
  return JSON.parse(
    Buffer.concat([decipher.update(encrypted!), decipher.final()]).toString(
      "utf8",
    ),
  ) as PushSubscriptionData;
}
export class PushRequestError extends Error {
  constructor(readonly statusCode: number) {
    super("Notification preference could not be updated");
  }
}
