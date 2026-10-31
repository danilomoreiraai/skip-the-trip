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
            available: true,
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
        available: true,
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
    for (const card of await page.locator(".overview-bathroom").all()) {
      const box = await card.boundingBox();
      const icon = await card.locator(".bathroom-icon").boundingBox();
      const star = await card.locator(".favorite-button svg").boundingBox();
      const status = await card
        .locator(".overview-indicator > svg")
        .boundingBox();
      if (!box || !icon || !star || !status)
        throw new Error("Missing card geometry");
      const center = box.x + box.width / 2;
      expect(Math.abs(icon.x + icon.width / 2 - center)).toBeLessThanOrEqual(1);
      expect(
        Math.abs(
          (star.x + star.width / 2 + status.x + status.width / 2) / 2 - center,
        ),
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(star.y + star.height / 2 - status.y - status.height / 2),
      ).toBeLessThanOrEqual(1);
    }
    await expect(page.locator(".overview-floor-code")).toHaveText([
      "GF",
      "F1",
      "F2",
      "F3",
    ]);
    await page.screenshot({
      path: testInfo.outputPath(`overview-${width}.png`),
      fullPage: true,
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
  ).toContainText("No reports yet");
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
