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
it("sends only bathroom identity when a favorite originated from an overview report", async () => {
  const summary = {
    ...favorite,
    available: true,
    yesCount: 3,
    noCount: 0,
    reportedAt: "2026-10-20T10:00:00.000Z",
    expiresAt: "2026-10-20T10:30:00.000Z",
  };
  await enablePush(summary, "BAAA");
  const write = vi
    .mocked(fetch)
    .mock.calls.find(([, init]) => init?.method === "PUT");
  expect(JSON.parse(String(write?.[1]?.body)).bathroom).toEqual({
    building: "HH5",
    floor: "G",
    category: "Male",
  });
});

it("does not reconcile a stale tab over a newer persisted favorite", async () => {
  vi.stubGlobal("localStorage", {
    getItem: () => JSON.stringify({ ...favorite, floor: "2" }),
  });
  await syncPushFavorite(favorite);
  await syncPushFavorite(null);
  expect(fetch).not.toHaveBeenCalled();
});

it("creates a browser subscription with the public key and rolls it back if the server refuses it", async () => {
  const created = subscription;
  if (!created) throw new Error("Missing subscription fixture");
  const subscribe = vi.fn(async () => created);
  const registration = {
    pushManager: { getSubscription: async () => null, subscribe },
  };
  const register = vi.fn(async () => registration);
  vi.stubGlobal("navigator", {
    serviceWorker: { register, ready: Promise.resolve(registration) },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 409 })),
  );
  await expect(enablePush(favorite, "BAAA")).rejects.toThrow(
    "Notification request failed",
  );
  expect(register).toHaveBeenCalledWith(
    expect.stringContaining("/sw.js?api="),
    { scope: "/" },
  );
  expect(subscribe).toHaveBeenCalledWith({
    userVisibleOnly: true,
    applicationServerKey: new Uint8Array([4, 0, 0]),
  });
  expect(unsubscribe).toHaveBeenCalledOnce();
  expect(fetch).toHaveBeenCalledWith(
    expect.stringMatching(/\/push\/subscription$/),
    expect.objectContaining({
      method: "PUT",
      cache: "no-store",
      credentials: "include",
      headers: { "content-type": "application/json", "x-push-client": "1" },
    }),
  );
});
it("preserves an existing browser subscription when a preference write fails", async () => {
  vi.stubGlobal("fetch", async () => new Response(null, { status: 503 }));
  await expect(enablePush(favorite, "BAAA")).rejects.toThrow();
  expect(unsubscribe).not.toHaveBeenCalled();
});
it("removes server preferences when browser permission or subscription is gone", async () => {
  permission = "denied";
  await syncPushFavorite(favorite);
  subscription = null;
  permission = "granted";
  await syncPushFavorite(favorite);
  expect(vi.mocked(fetch).mock.calls.map(([, init]) => init?.method)).toEqual([
    "DELETE",
    "DELETE",
  ]);
});
it("keeps server opt-out successful when native unsubscribe fails", async () => {
  unsubscribe.mockRejectedValueOnce(new Error("native failure"));
  await expect(disablePush()).resolves.toBeUndefined();
  expect(fetch).toHaveBeenCalledWith(
    expect.stringMatching(/\/push\/subscription$/),
    expect.objectContaining({
      method: "DELETE",
      headers: { "x-push-client": "1" },
    }),
  );
});

it("ignores a reconciliation if another tab changes the favorite during browser lookup", async () => {
  let persisted = favorite as {
    building: string;
    floor: string;
    category: string;
  };
  vi.stubGlobal("localStorage", { getItem: () => JSON.stringify(persisted) });
  vi.stubGlobal("navigator", {
    serviceWorker: {
      getRegistration: async () => {
        persisted = { ...favorite, floor: "3" };
        return { pushManager: { getSubscription: async () => subscription } };
      },
    },
  });
  await syncPushFavorite(favorite);
  expect(fetch).not.toHaveBeenCalled();
});
