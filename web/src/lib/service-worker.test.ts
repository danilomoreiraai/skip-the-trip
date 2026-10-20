import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it } from "vitest";

function worker() {
  const handlers = new Map<string, (event: unknown) => void>();
  const displayed: Array<Record<string, unknown>> = [];
  const opened: string[] = [];
  let active = true;
  let subscribed = true;
  const payload = {
    type: "cleaning-started",
    cycleId: "550e8400-e29b-41d4-a716-446655440099",
    building: "HH5",
    floor: "G",
    category: "Male",
    issuedAt: new Date().toISOString(),
    expectedEndAt: new Date(Date.now() + 900_000).toISOString(),
  };
  const self = {
    location: {
      href: "https://skipthetrip.info/sw.js",
      origin: "https://skipthetrip.info",
    },
    addEventListener: (name: string, handler: (event: unknown) => void) =>
      handlers.set(name, handler),
    registration: {
      getNotifications: async ({ tag }: { tag: string }) =>
        displayed.filter((value) => value.tag === tag),
      showNotification: async (title: string, value: Record<string, unknown>) =>
        displayed.push({ title, ...value }),
    },
    clients: {
      matchAll: async () => [],
      openWindow: async (url: string) => opened.push(url),
      claim: async () => {},
    },
    skipWaiting: async () => {},
  };
  runInNewContext(
    readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8"),
    {
      self,
      URL,
      Date,
      Promise,
      fetch: async (url: string) => ({
        ok: true,
        json: async () =>
          url.endsWith("/push/subscription")
            ? {
                subscribed,
                bathroom: { building: "HH5", floor: "G", category: "Male" },
              }
            : {
                generatedAt: new Date().toISOString(),
                cleaning: [
                  {
                    ...payload,
                    id: payload.cycleId,
                    state: active ? "active" : "ended",
                    endedAt: active ? null : new Date().toISOString(),
                  },
                ],
              },
      }),
    },
  );
  async function dispatch(name: string, event: Record<string, unknown>) {
    let pending: Promise<unknown> | undefined;
    handlers.get(name)?.({
      ...event,
      waitUntil(value: Promise<unknown>) {
        pending = value;
      },
    });
    await pending;
  }
  return {
    displayed,
    opened,
    payload,
    stop: () => {
      active = false;
    },
    unsubscribe: () => {
      subscribed = false;
    },
    push: (value = payload) =>
      dispatch("push", { data: { json: () => value } }),
    click: () =>
      dispatch("notificationclick", {
        notification: {
          data: { url: "/HH5?floor=G&category=Male" },
          close() {},
        },
      }),
  };
}
it("displays a fresh, still-active subscribed cleaning once and opens a live building link", async () => {
  const value = worker();
  await value.push();
  await value.push();
  expect(value.displayed).toHaveLength(1);
  expect(value.displayed[0]).toMatchObject({
    title: "Cleaning reported by the team",
    tag: "cleaning-550e8400-e29b-41d4-a716-446655440099",
  });
  await value.click();
  expect(value.opened).toEqual([
    "https://skipthetrip.info/HH5?floor=G&category=Male",
  ]);
});
it("discards expired, ended, unsubscribed and malformed push messages", async () => {
  const ended = worker();
  ended.stop();
  await ended.push();
  expect(ended.displayed).toHaveLength(0);
  const removed = worker();
  removed.unsubscribe();
  await removed.push();
  expect(removed.displayed).toHaveLength(0);
  const stale = worker();
  await stale.push({
    ...stale.payload,
    issuedAt: new Date(Date.now() - 61_000).toISOString(),
  });
  expect(stale.displayed).toHaveLength(0);
  await stale.push({ ...stale.payload, building: "HH1" });
  expect(stale.displayed).toHaveLength(0);
});
