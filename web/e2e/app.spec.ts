import { expect, type Page, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("skip-the-trip:analytics-consent:v1", "accepted");
  });
  const reports = new Map<
    string,
    {
      available: boolean;
      reportedAt: string;
      yesCount: number;
      noCount: number;
    }
  >();
  await page.route("http://localhost:3333/reports**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "POST") {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const vote = request.postDataJSON() as {
        building: string;
        floor: string;
        category: string;
        available: boolean;
      };
      const key = `${vote.building}:${vote.floor}:${vote.category}`;
      const previous = reports.get(key);
      const report = {
        available: vote.available,
        reportedAt: new Date().toISOString(),
        yesCount: (previous?.yesCount ?? 0) + (vote.available ? 1 : 0),
        noCount: (previous?.noCount ?? 0) + (vote.available ? 0 : 1),
      };
      reports.set(key, report);
      await route.fulfill({
        status: 201,
        json: {
          ...vote,
          ...report,
          expiresAt: new Date(
            Date.parse(report.reportedAt) + 30 * 60 * 1000,
          ).toISOString(),
        },
      });
      return;
    }
    const bathroom = {
      building: url.searchParams.get("building"),
      floor: url.searchParams.get("floor"),
      category: url.searchParams.get("category"),
    };
    const report = reports.get(
      `${bathroom.building}:${bathroom.floor}:${bathroom.category}`,
    );
    await route.fulfill({
      json: report
        ? {
            ...bathroom,
            ...report,
            expiresAt: new Date(
              Date.parse(report.reportedAt) + 30 * 60 * 1000,
            ).toISOString(),
          }
        : {
            ...bathroom,
            available: null,
            reportedAt: null,
            expiresAt: null,
            yesCount: 0,
            noCount: 0,
          },
    });
  });
});

async function select(page: Page) {
  await page
    .getByRole("button", { name: "HH5", exact: true })
    .click({ force: true });
  await page.getByRole("button", { name: "3", exact: true }).click();
  await page.getByRole("button", { name: "Accessible", exact: true }).click();
}
test("selection, latest vote, isolation and persistence", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "3", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Yes, available" }),
  ).toBeDisabled();
  await select(page);
  await expect(page.getByText("No recent information")).toBeVisible();
  await page.getByRole("button", { name: "Yes, available" }).click();
  await expect(
    page.getByRole("button", { name: "No, unavailable" }),
  ).toBeDisabled();
  await expect(page.getByText("Safe trip")).toBeVisible();
  await expect(page.getByText(/Vote again in/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "No, unavailable" }),
  ).toBeDisabled();
  await expect(page.getByRole("status", { name: "1 YES votes" })).toHaveText(
    "1",
  );
  await expect(page.getByRole("status", { name: "0 NO votes" })).toHaveText(
    "0",
  );
  await expect(page.locator(".status-bar")).toHaveCount(1);
  await expect(page.getByRole("meter")).toHaveAttribute("value", "100");
  await page.getByRole("button", { name: "Male", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "No, unavailable" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "1", exact: true }).click();
  await page.getByRole("button", { name: "Accessible", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "No, unavailable" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "3", exact: true }).click();
  await page.getByRole("button", { name: "Accessible", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "No, unavailable" }),
  ).toBeDisabled();
  await page.reload();
  await expect(page.getByRole("meter")).toHaveAttribute("value", "100");
  await expect(page.locator(".status-bar")).toHaveCount(1);
  await expect(page.getByText("Safe trip")).toBeVisible();
  await page.getByRole("button", { name: "Male", exact: true }).click();
  await expect(page.getByText("No recent information")).toBeVisible();
  await page.getByRole("button", { name: "Accessible", exact: true }).click();
  await expect(page.getByText("Safe trip")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("expires while the page stays open", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await select(page);
  await page.getByRole("button", { name: "Yes, available" }).click();
  await expect(page.getByText("Safe trip")).toBeVisible();
  await page.clock.fastForward(30 * 60 * 1000 + 1000);
  await expect(page.getByText("No recent information")).toBeVisible();
});
test("load failure can be retried", async ({ page }) => {
  await page.goto("/");
  await page.route("http://localhost:3333/reports?**", async (route) => {
    await route.fulfill({
      status: 503,
      json: { message: "Database unavailable" },
    });
  });
  await select(page);
  await expect(page.getByRole("alert")).toContainText("Couldn't load");
  await page.unroute("http://localhost:3333/reports?**");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("No recent information")).toBeVisible();
});
test("privacy, 404, keyboard and reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip the Trip home" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "HH5", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: /HH1.*Available soon/ }),
  ).toBeDisabled();
  await expect(page.getByText("Available soon").first()).toBeVisible();
  await page.getByRole("link", { name: "Privacy", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Privacy, kept simple." }),
  ).toBeVisible();
  await page.goto("/missing");
  await expect(
    page.getByRole("heading", { name: "This stop doesn’t exist." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to the app" }).click();
  await expect(
    page.getByRole("button", { name: "HH5", exact: true }),
  ).toBeEnabled();
});

test("asks for analytics consent and respects decline", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.removeItem("skip-the-trip:analytics-consent:v1"),
  );
  await page.reload();
  await expect(page.getByRole("dialog")).toContainText(
    "This site uses Google Analytics to count visits. It shows no ads and does not follow you to other sites. Is that okay?",
  );
  await page.getByRole("button", { name: "Decline", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
