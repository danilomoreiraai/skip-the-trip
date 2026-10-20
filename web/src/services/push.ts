import { z } from "zod";
import { type Bathroom, bathroomSchema } from "../domain/bathroom";
import { env } from "../env";

let writes: Promise<void> = Promise.resolve();
function serialize(operation: () => Promise<void>) {
  const next = writes.then(operation, operation);
  writes = next.catch(() => {});
  return next;
}
const base = `${env.VITE_API_URL.replace(/\/$/, "")}/push`;
const configSchema = z.object({
  enabled: z.boolean(),
  publicKey: z.string().nullable(),
});
const preferenceSchema = z.object({
  subscribed: z.boolean(),
  bathroom: bathroomSchema.nullable(),
});
export function supportsPush() {
  return (
    globalThis.isSecureContext &&
    typeof Notification !== "undefined" &&
    typeof PushManager !== "undefined" &&
    "serviceWorker" in navigator
  );
}
async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`${base}${path}`, {
    ...init,
    credentials: "include",
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok)
    throw new Error("Notification request failed. Please try again.");
  return response;
}
export async function getPushConfig() {
  return configSchema.parse(await (await request("/config")).json());
}
export async function getPushPreference() {
  return preferenceSchema.parse(await (await request("/subscription")).json());
}
async function save(favorite: Bathroom, subscription: PushSubscription) {
  await request("/subscription", {
    method: "PUT",
    headers: { "content-type": "application/json", "x-push-client": "1" },
    body: JSON.stringify({
      bathroom: favorite,
      subscription: subscription.toJSON(),
    }),
  });
}
function applicationKey(value: string) {
  const raw = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
export async function enablePush(favorite: Bathroom, publicKey: string) {
  if (!supportsPush())
    throw new Error(
      "Notifications are not supported here. On iPhone/iPad, add the app to the Home Screen first.",
    );
  if ((await Notification.requestPermission()) !== "granted")
    throw new Error(
      "Notification permission was not granted. You can keep using the app.",
    );
  return serialize(async () => {
    await navigator.serviceWorker.register(
      `/sw.js?api=${encodeURIComponent(env.VITE_API_URL)}`,
      { scope: "/" },
    );
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationKey(publicKey),
      }));
    try {
      await save(favorite, subscription);
    } catch (error) {
      if (!existing) await subscription.unsubscribe().catch(() => false);
      throw error;
    }
  });
}
export function disablePush() {
  return serialize(removeSubscription);
}
async function removeSubscription() {
  await request("/subscription", {
    method: "DELETE",
    headers: { "x-push-client": "1" },
  });
  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager.getSubscription();
    await subscription?.unsubscribe().catch(() => false);
  }
}
export function syncPushFavorite(favorite: Bathroom | null) {
  return serialize(async () => {
    if (!favorite || !supportsPush() || Notification.permission !== "granted")
      return removeSubscription();
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return removeSubscription();
    await save(favorite, subscription);
  });
}
