import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  disablePush,
  enablePush,
  getPushConfig,
  getPushPreference,
  supportsPush,
  syncPushFavorite,
} from "./push";

const favorite = { building: "HH5", floor: "G", category: "Male" } as const;
let permission = "granted";
let unsubscribe = vi.fn();
let subscription: {
  toJSON: () => object;
  unsubscribe: typeof unsubscribe;
} | null;
beforeEach(() => {
  permission = "granted";
  unsubscribe = vi.fn(async () => true);
  subscription = {
    toJSON: () => ({
      endpoint: "https://fcm.googleapis.com/fcm/send/test",
      keys: { auth: "a".repeat(22), p256dh: "B" + "a".repeat(86) },
    }),
    unsubscribe,
  };
  const registration = {
    pushManager: {
      getSubscription: async () => subscription,
      subscribe: async () => subscription,
    },
  };
  vi.stubGlobal("Notification", {
    get permission() {
      return permission;
    },
    requestPermission: async () => permission,
  });
  vi.stubGlobal("PushManager", () => {});
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("navigator", {
    serviceWorker: {
      register: async () => registration,
      ready: Promise.resolve(registration),
      getRegistration: async () => registration,
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (url: string, init?: RequestInit) =>
        new Response(
          url.endsWith("/config")
            ? JSON.stringify({ enabled: true, publicKey: "BAAA" })
            : init?.method
              ? null
              : JSON.stringify({ subscribed: true, bathroom: favorite }),
          { status: init?.method ? 204 : 200 },
        ),
    ),
  );
});
afterEach(() => vi.unstubAllGlobals());
it("requires explicit notification permission before registering a favorite and never treats analytics as permission", async () => {
  expect(supportsPush()).toBe(true);
  expect(await getPushConfig()).toEqual({ enabled: true, publicKey: "BAAA" });
  await enablePush(favorite, "BAAA");
  const write = vi
    .mocked(fetch)
    .mock.calls.find(([, init]) => init?.method === "PUT");
  expect(write?.[1]).toMatchObject({ credentials: "include" });
  expect(JSON.parse(String(write?.[1]?.body)).bathroom).toEqual(favorite);
  permission = "denied";
  vi.mocked(fetch).mockClear();
  await expect(enablePush(favorite, "BAAA")).rejects.toThrow(
    "Notification permission was not granted",
  );
  expect(fetch).not.toHaveBeenCalled();
});
it("updates an existing subscription for a changed favorite and deletes it when the favorite is removed", async () => {
  expect(await getPushPreference()).toMatchObject({ subscribed: true });
  await syncPushFavorite({ ...favorite, floor: "2" });
  const write = vi
    .mocked(fetch)
    .mock.calls.find(([, init]) => init?.method === "PUT");
  expect(JSON.parse(String(write?.[1]?.body)).bathroom.floor).toBe("2");
  await syncPushFavorite(null);
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  expect(
    vi.mocked(fetch).mock.calls.some(([, init]) => init?.method === "DELETE"),
  ).toBe(true);
});
it("keeps unsupported devices and server failures explicit without leaking push credentials", async () => {
  vi.stubGlobal("isSecureContext", false);
  expect(supportsPush()).toBe(false);
  await expect(enablePush(favorite, "BAAA")).rejects.toThrow(
    "Notifications are not supported",
  );
  vi.stubGlobal(
    "fetch",
    async () => new Response('{"message":"private-endpoint"}', { status: 503 }),
  );
  await expect(getPushConfig()).rejects.toThrow("Notification request failed");
  await expect(getPushPreference()).rejects.toThrow(
    "Notification request failed",
  );
  await expect(disablePush()).rejects.toThrow("Notification request failed");
});
it("serializes a favorite change before a subsequent opt-out so an in-flight update cannot re-enable alerts", async () => {
  const changed = syncPushFavorite({ ...favorite, floor: "1" });
  const removed = disablePush();
  await Promise.all([changed, removed]);
  expect(vi.mocked(fetch).mock.calls.map(([, init]) => init?.method)).toEqual([
    "PUT",
    "DELETE",
  ]);
});
