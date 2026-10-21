import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    localStorage.setItem("skip-the-trip:analytics-consent:v1", "declined");
    if (!sessionStorage.getItem("push-fixture")) {
      localStorage.setItem(
        "skip-the-trip:favorite:v1",
        JSON.stringify({ building: "HH5", floor: "G", category: "Male" }),
      );
      sessionStorage.setItem("push-fixture", "yes");
    }
    const value = {
      toJSON: () => ({
        endpoint: "https://fcm.googleapis.com/fcm/send/fixture",
        keys: { auth: "a".repeat(22), p256dh: "B" + "a".repeat(86) },
      }),
      unsubscribe: async () => true,
    };
    const registration = {
      pushManager: {
        getSubscription: async () => value,
        subscribe: async () => value,
      },
    };
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        register: async () => registration,
        ready: Promise.resolve(registration),
        getRegistration: async () => registration,
      },
    });
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: () => {},
    });
    let granted = window.location.search.includes("denied")
      ? "default"
      : "granted";
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: {
        get permission() {
          return granted;
        },
        requestPermission: async () => {
          granted = window.location.search.includes("denied")
            ? "denied"
            : "granted";
          return granted;
        },
      },
    });
  });
  await context.route("**/locations/HH5/status", (route) =>
    route.fulfill({
      json: {
        building: "HH5",
        generatedAt: new Date().toISOString(),
        bathrooms: ["G", "1", "2", "3"].flatMap((floor) =>
          ["Male", "Accessible", "Female"].map((category) => ({
            building: "HH5",
            floor,
            category,
            available: null,
            reportedAt: null,
            expiresAt: null,
            yesCount: 0,
            noCount: 0,
          })),
        ),
        cleaning: [],
      },
    }),
  );
  await context.route("**/push/config", (route) =>
    route.fulfill({ json: { enabled: true, publicKey: "BAAA" } }),
  );
});
test("explicit push opt-in follows a changed favorite and cancels when it is removed", async ({
  page,
}) => {
  let bathroom: object | null = null;
  await page.route("**/push/subscription", (route) => {
    const method = route.request().method();
    if (method === "PUT") bathroom = route.request().postDataJSON().bathroom;
    if (method === "DELETE") bathroom = null;
    return method === "GET"
      ? route.fulfill({ json: { subscribed: Boolean(bathroom), bathroom } })
      : route.fulfill({ status: 204 });
  });
  await page.goto("/HH5");
  await page
    .getByRole("button", { name: "Enable cleaning notifications", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Turn off cleaning notifications",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Save favorite: HH5 floor 1 Female",
      exact: true,
    })
    .click();
  await expect
    .poll(() => bathroom)
    .toMatchObject({ floor: "1", category: "Female" });
  await page
    .getByRole("button", { name: "Remove favorite", exact: true })
    .click();
  await expect.poll(() => bathroom).toBeNull();
  await expect(page.getByRole("region", { name: "Your favorite" })).toHaveCount(
    0,
  );
});
test("denied notification permission keeps consultation available and creates no subscription", async ({
  page,
}) => {
  let writes = 0;
  await page.route("**/push/subscription", (route) => {
    if (route.request().method() !== "GET") writes++;
    return route.fulfill({ json: { subscribed: false, bathroom: null } });
  });
  await page.goto("/HH5?permission=denied");
  await page
    .getByRole("button", { name: "Enable cleaning notifications", exact: true })
    .click();
  await expect(
    page.getByText(
      "Notification permission was not granted. You can keep using the app.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "HH5 overview" }),
  ).toBeVisible();
  expect(writes).toBe(0);
});

test("the latest browser favorite survives refocusing an older tab", async ({
  page,
  context,
}) => {
  let bathroom = { building: "HH5", floor: "G", category: "Male" };
  await context.route("**/push/subscription", (route) => {
    const method = route.request().method();
    if (method === "PUT") {
      const incoming = route.request().postDataJSON().bathroom;
      if (Object.keys(incoming).sort().join(",") !== "building,category,floor")
        return route.fulfill({
          status: 400,
          json: { message: "Unknown properties" },
        });
      bathroom = incoming;
    }
    return method === "GET"
      ? route.fulfill({ json: { subscribed: true, bathroom } })
      : route.fulfill({ status: 204 });
  });
  await page.goto("/HH5");
  await expect(
    page.getByRole("button", {
      name: "Turn off cleaning notifications",
      exact: true,
    }),
  ).toBeVisible();
  const second = await context.newPage();
  await second.goto("/HH5");
  await second
    .getByRole("button", {
      name: "Save favorite: HH5 floor 1 Female",
      exact: true,
    })
    .click();
  await expect
    .poll(() => bathroom)
    .toMatchObject({ floor: "1", category: "Female" });
  await page.bringToFront();
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(
    page.getByRole("region", { name: "Your favorite" }),
  ).toContainText("Floor 1");
  await second.bringToFront();
  await second.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("visibilitychange"));
  });
  await expect
    .poll(() => bathroom)
    .toMatchObject({ floor: "1", category: "Female" });
});
