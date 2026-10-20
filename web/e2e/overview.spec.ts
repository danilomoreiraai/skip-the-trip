import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("skip-the-trip:analytics-consent:v1", "declined"),
  );
  await page.route("**/locations/HH5/status", (route) =>
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
      },
    }),
  );
  await page.route("**/reports?**", (route) =>
    route.fulfill({
      json: {
        building: "HH5",
        floor: "1",
        category: "Female",
        available: null,
        reportedAt: null,
        expiresAt: null,
        yesCount: 0,
        noCount: 0,
      },
    }),
  );
});
test("direct HH5 route groups bathrooms, persists an explicit favorite and removes it", async ({
  page,
}) => {
  await page.goto("/HH5");
  await expect(
    page.getByRole("heading", { name: "HH5 overview" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Ground floor", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".overview-bathroom")).toHaveCount(12);
  await page
    .getByRole("button", {
      name: "Save favorite: HH5 floor 1 Female",
      exact: true,
    })
    .click();
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Your favorite" }),
  ).toContainText("Female");
  await page
    .getByRole("button", { name: "Remove favorite", exact: true })
    .click();
  await page.reload();
  await expect(page.getByRole("region", { name: "Your favorite" })).toHaveCount(
    0,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("initial device mode can be switched and the explicit choice survives reload", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  if (isMobile) {
    await expect(
      page.getByRole("button", { name: "Yes, available", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Consult", exact: true }).click();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "HH5 overview" }),
    ).toBeVisible();
  } else {
    await expect(
      page.getByRole("heading", { name: "HH5 overview" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Contribute", exact: true }).click();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Yes, available", exact: true }),
    ).toBeVisible();
  }
});
test("a failed refresh makes stale information explicit", async ({ page }) => {
  await page.goto("/HH5");
  await expect(page.locator(".overview-bathroom")).toHaveCount(12);
  await page.route("**/locations/HH5/status", (route) =>
    route.fulfill({ status: 503, json: { message: "Unavailable" } }),
  );
  await page
    .getByRole("button", { name: "Refresh status", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("may be out of date");
});
