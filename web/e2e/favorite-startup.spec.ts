import { expect, test } from "@playwright/test";

const favorite = { building: "HH5", floor: "1", category: "Female" };
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    localStorage.setItem("skip-the-trip:analytics-consent:v1", "declined");
  });
});
test("startup explains how to save a favorite without requesting status", async ({
  page,
}) => {
  const reads: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/reports?")) reads.push(request.url());
  });
  await page.goto("/");
  await expect(
    page.getByRole("region", { name: "Favorite setup" }),
  ).toContainText("appear here whenever you open the app");
  await expect(
    page.getByRole("button", { name: "Mac", exact: true }),
  ).toBeVisible();
  expect(reads).toEqual([]);
});
test("saved favorite shows live status before device choice and handles refresh errors", async ({
  context,
  page,
}, testInfo) => {
  await context.addInitScript(
    (value) =>
      localStorage.setItem("skip-the-trip:favorite:v1", JSON.stringify(value)),
    favorite,
  );
  let available = true;
  let failed = false;
  let expired = false;
  await page.route("**/reports?**", (route) =>
    route.fulfill(
      failed
        ? {
            status: 503,
            json: { message: "Unavailable" },
          }
        : {
            json: {
              ...favorite,
              available,
              reportedAt: new Date(Date.now() - 1000).toISOString(),
              expiresAt: new Date(
                Date.now() + (expired ? -1 : 60000),
              ).toISOString(),
              yesCount: 1,
              noCount: 0,
            },
          },
    ),
  );
  await page.goto("/");
  const card = page.getByRole("region", { name: "Your favorite" });
  await expect(card).toContainText("Available");
  await expect(
    card.locator(".favorite-location > span[aria-hidden]"),
  ).toHaveText("HH5 F1");
  await expect(
    card.locator(
      ".favorite-strip h1,.favorite-strip h2,.favorite-strip h3,.favorite-strip p,.favorite-strip time",
    ),
  ).toHaveCount(0);
  await expect(card.locator(".favorite-strip")).toHaveClass(/available/);
  for (const width of [320, 375, 1440]) {
    await page.setViewportSize({ width, height: 812 });
    const strip = card.locator(".favorite-strip");
    const box = await strip.boundingBox();
    expect(box?.height).toBeLessThanOrEqual(60);
    await expect(strip).toHaveCSS("background-color", "rgb(0, 166, 107)");
    await expect(card.locator(".favorite-status")).toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)",
    );
    const timestamp = card.locator(".favorite-updated time");
    await expect(timestamp).toBeVisible();
    expect((await timestamp.boundingBox())?.y).toBeGreaterThanOrEqual(
      (box?.y ?? 0) + (box?.height ?? 0),
    );
    const parts = await strip.locator(":scope > *").all();
    for (const part of parts) {
      const partBox = await part.boundingBox();
      expect(
        Math.abs((partBox?.y ?? 0) - ((box?.y ?? 0) + 6)),
      ).toBeLessThanOrEqual(1);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`favorite-available-${width}.png`),
    });
  }
  await expect(
    page.getByRole("heading", { name: "How are you joining?" }),
  ).toBeVisible();
  available = false;
  await expect(card).toContainText("Unavailable", { timeout: 10000 });
  await expect(
    card.locator(".favorite-strip.unavailable .favorite-status img"),
  ).toBeVisible();
  await expect(card.locator(".favorite-strip")).toHaveCSS(
    "background-color",
    "rgb(255, 86, 45)",
  );
  await page.screenshot({
    path: testInfo.outputPath("favorite-unavailable.png"),
  });
  expired = true;
  await expect(card).toContainText("No recent information", { timeout: 10000 });
  failed = true;
  await expect(card.getByRole("alert")).toContainText(
    "Couldn't load your favorite",
    { timeout: 10000 },
  );
  failed = false;
  expired = false;
  await card.getByRole("button", { name: "Try again" }).click();
  await expect(card).toContainText("Unavailable");
  await page.setViewportSize({ width: 320, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("a favorite saved in another tab appears at startup and survives device choice", async ({
  context,
  page,
}) => {
  await context.route("**/reports?**", (route) =>
    route.fulfill({
      json: {
        ...favorite,
        available: true,
        reportedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        yesCount: 1,
        noCount: 0,
      },
    }),
  );
  await context.route("**/locations/HH5/status", (route) =>
    route.fulfill({
      json: {
        building: "HH5",
        generatedAt: new Date().toISOString(),
        bathrooms: [],
      },
    }),
  );
  await page.goto("/");
  const other = await context.newPage();
  await other.goto("/");
  await other.evaluate(
    (value) =>
      localStorage.setItem("skip-the-trip:favorite:v1", JSON.stringify(value)),
    favorite,
  );
  await other.close();
  const card = page.getByRole("region", { name: "Your favorite", exact: true });
  await expect(card).toContainText("Available");
  await page.getByRole("button", { name: "Mac", exact: true }).click();
  await expect(card).toContainText("Available");
  await page.reload();
  await expect(card).toContainText("Available");
  await page
    .getByRole("button", { name: "Remove favorite", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Favorite setup" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Choose favorite", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "HH5 overview" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Change device", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Favorite setup" }),
  ).toBeVisible();
  await expect(card).toHaveCount(0);
});
