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
}) => {
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
    page.getByRole("heading", { name: "How are you joining?" }),
  ).toBeVisible();
  available = false;
  await expect(card).toContainText("Unavailable", { timeout: 10000 });
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
