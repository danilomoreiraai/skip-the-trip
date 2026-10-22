import { expect, test } from "@playwright/test";

test("new flows keep the compact app shell and usable controls at every width", async ({
  context,
  page,
}, testInfo) => {
  await context.addInitScript(() =>
    localStorage.setItem("skip-the-trip:analytics-consent:v1", "declined"),
  );
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
      },
    }),
  );
  await context.route("**/reports?**", (route) =>
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
  await page.goto("/");
  for (const width of [320, 375, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`device-choice-${width}.png`),
    });
  }
  await page.getByRole("button", { name: "Mac", exact: true }).click();
  await expect(page.locator(".overview-bathroom")).toHaveCount(12);
  for (const width of [1440, 375, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(
        async () => (await page.locator(".site-shell").boundingBox())?.width,
      )
      .toBeLessThanOrEqual(520);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`overview-${width}.png`),
    });
    for (const button of await page
      .locator(".overview-bathroom button")
      .all()) {
      const box = await button.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  }
  await page
    .getByRole("button", {
      name: "Save favorite: HH5 floor 1 Female",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("region", { name: "Your favorite", exact: true }),
  ).toContainText("No recent information");
  await page
    .getByRole("button", { name: "Change device", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "How are you joining?" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("favorite-startup-320.png"),
  });
  await page
    .getByRole("button", { name: "Mobile device", exact: true })
    .click();
  await page.getByRole("button", { name: "Consult", exact: true }).click();
  await page
    .getByRole("button", { name: "Vote: HH5 floor 1 Female", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Female", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "1", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
