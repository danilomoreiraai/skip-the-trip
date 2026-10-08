import { expect, type Page, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("skip-the-trip:analytics-consent:v1", "accepted");
    let geolocationAttempts = 0;
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition(
          success: PositionCallback,
          error?: PositionErrorCallback | null,
        ) {
          geolocationAttempts += 1;
          if (
            window.location.search.includes("geo-retry") &&
            geolocationAttempts === 1
          ) {
            error?.({
              code: 2,
              message: "Position unavailable",
              PERMISSION_DENIED: 1,
              POSITION_UNAVAILABLE: 2,
              TIMEOUT: 3,
            });
            return;
          }
          success({
            coords: {
              latitude: 51.907327,
              longitude: -8.513503,
              accuracy: 20,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
            },
            timestamp: Date.now(),
          } as GeolocationPosition);
        },
      },
    });
  });
  let authorized = false;
  await page.route(
    "http://localhost:3333/locations/HH5/verify-location",
    async (route) => {
      authorized = true;
      await route.fulfill({
        json: {
          authorized: true,
          expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        },
      });
    },
  );
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
      if (!authorized) {
        await route.fulfill({
          status: 403,
          json: {
            code: "LOCATION_VERIFICATION_REQUIRED",
            message: "Confirm your location to vote.",
            statusCode: 403,
          },
        });
        return;
      }
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
async function authorizePendingVote(page: Page) {
  await expect(
    page.getByRole("dialog", { name: "Confirm your location to vote" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm location" }).click();
}

test("keeps the vote controls visually separated", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await select(page);

  const yesBox = await page
    .getByRole("button", { name: "Yes, available" })
    .boundingBox();
  const noBox = await page
    .getByRole("button", { name: "No, unavailable" })
    .boundingBox();

  expect(yesBox).not.toBeNull();
  expect(noBox).not.toBeNull();
  expect(
    (noBox?.x ?? 0) - ((yesBox?.x ?? 0) + (yesBox?.width ?? 0)),
  ).toBeGreaterThanOrEqual(32);
});

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
  await authorizePendingVote(page);
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

test("shows location rejection above an opaque mobile dialog", async ({
  page,
}) => {
  await page.route(
    "http://localhost:3333/locations/HH5/verify-location",
    async (route) => {
      await route.fulfill({
        status: 403,
        json: {
          code: "INSUFFICIENT_ACCURACY",
          message:
            "We could not confirm your location accurately enough. Try again.",
          statusCode: 403,
        },
      });
    },
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await select(page);
  await page.getByRole("button", { name: "Yes, available" }).click();
  await authorizePendingVote(page);

  const dialog = page.getByRole("dialog", {
    name: "Confirm your location to vote",
  });
  const toast = page.getByRole("status").filter({
    hasText: "We could not confirm your location accurately enough.",
  });
  await expect(dialog).toBeVisible();
  await expect(toast).toBeVisible();
  await expect
    .poll(async () => {
      const toastZIndex = Number(
        await toast.evaluate((node) => getComputedStyle(node).zIndex),
      );
      const dialogZIndex = Number(
        await dialog.evaluate((node) => getComputedStyle(node).zIndex),
      );
      return toastZIndex > dialogZIndex;
    })
    .toBe(true);
  await expect
    .poll(() =>
      dialog.evaluate((node) => getComputedStyle(node).backgroundColor),
    )
    .not.toBe("rgba(0, 0, 0, 0)");
});

test("retries with network location when high accuracy is unavailable", async ({
  page,
}) => {
  await page.goto("/?geo-retry=1");
  await select(page);
  await page.getByRole("button", { name: "Yes, available" }).click();
  await authorizePendingVote(page);

  await expect(
    page.getByRole("dialog", { name: "Confirm your location to vote" }),
  ).toBeHidden();
  await expect(page.getByRole("status", { name: "1 YES votes" })).toHaveText(
    "1",
  );
});

test("refreshes an open counter when a third person votes", async ({
  page,
}) => {
  let reads = 0;
  await page.route(
    "http://localhost:3333/reports?building=HH5&floor=G&category=Male",
    async (route) => {
      reads += 1;
      await route.fulfill({
        json: {
          building: "HH5",
          floor: "G",
          category: "Male",
          available: true,
          reportedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          yesCount: reads === 1 ? 2 : 3,
          noCount: 0,
        },
      });
    },
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "HH5", exact: true })
    .click({ force: true });
  await page.getByRole("button", { name: "G", exact: true }).click();
  await page.getByRole("button", { name: "Male", exact: true }).click();

  await expect(page.getByRole("status", { name: "2 YES votes" })).toHaveText(
    "2",
  );
  await expect(page.getByRole("status", { name: "3 YES votes" })).toHaveText(
    "3",
    { timeout: 7_000 },
  );
});
test("expires while the page stays open", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await select(page);
  await page.getByRole("button", { name: "Yes, available" }).click();
  await authorizePendingVote(page);
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
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("analytics-test-cleared")) {
      localStorage.removeItem("skip-the-trip:analytics-consent:v1");
      sessionStorage.setItem("analytics-test-cleared", "yes");
    }
  });
  await page.reload();
  await expect(page.getByRole("dialog")).toContainText(
    "This site uses Google Analytics to count visits. It shows no ads and does not follow you to other sites. Is that okay?",
  );
  await page.getByRole("button", { name: "Decline", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
