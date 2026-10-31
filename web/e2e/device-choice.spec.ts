import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    localStorage.setItem("skip-the-trip:analytics-consent:v1", "declined");
    localStorage.setItem("skip-the-trip:view:v1", "contribute");
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
});

test("requires a manual choice before loading status even with a contribution link", async ({
  page,
}) => {
  const reads: string[] = [];
  page.on("request", (request) => {
    if (
      ["/locations/HH5/status", "/reports"].includes(
        new URL(request.url()).pathname,
      )
    )
      reads.push(request.url());
  });
  await page.goto("/HH5?view=contribute");
  await expect(
    page.getByRole("heading", { name: "How are you joining?" }),
  ).toBeVisible();
  const mobile = page.getByRole("button", {
    name: "Mobile device",
    exact: true,
  });
  const mac = page.getByRole("button", { name: "Mac", exact: true });
  await expect(mobile).toBeVisible();
  await expect(mac).toBeVisible();
  await expect(page.getByText("Consult & vote")).toBeVisible();
  await expect(page.getByText("Consult only")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "How are you joining?" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(mobile).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(mac).toBeFocused();
  for (const card of [mobile, mac]) {
    const box = await card.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(reads).toEqual([]);
  await page.setViewportSize({ width: 320, height: 812 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await expect(mobile).toBeVisible();
  await expect(mac).toBeVisible();
  await page.getByRole("link", { name: "Privacy", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Privacy notice", exact: true }),
  ).toBeVisible();
});

test("Mac stays in consultation through links, favorites and reload then can change device", async ({
  page,
}) => {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      /\/reports|verify-location/.test(request.url())
    )
      writes.push(request.url());
  });
  await page.goto("/?view=contribute");
  await page.getByRole("button", { name: "Mac", exact: true }).click();
  await expect(page.locator(".overview-bathroom")).toHaveCount(12);
  await expect(
    page.getByRole("button", { name: /Contribute|Vote:/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Yes, available", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Save favorite: HH5 floor 1 Female",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Open favorite", exact: true })
    .click();
  await expect(
    page.getByRole("article").filter({
      has: page.getByRole("button", {
        name: "Unsave favorite: HH5 floor 1 Female",
        exact: true,
      }),
    }),
  ).toBeFocused();
  await page.goto("/HH5?view=contribute");
  await expect(
    page.getByRole("heading", { name: "HH5 overview" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Contribute|Vote:/ }),
  ).toHaveCount(0);
  expect(writes).toEqual([]);
  await page
    .getByRole("button", { name: "Change device", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mobile device", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Yes, available", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Yes, available", exact: true }),
  ).toBeVisible();
});

test("manual mobile choice permits voting but still requires location confirmation", async ({
  page,
}) => {
  await page.route("**/reports", (route) =>
    route.fulfill({
      status: 403,
      json: {
        code: "LOCATION_VERIFICATION_REQUIRED",
        message: "Confirm your location to vote.",
        statusCode: 403,
      },
    }),
  );
  await page.goto("/?view=contribute");
  await page
    .getByRole("button", { name: "Mobile device", exact: true })
    .click();
  await page
    .locator(".home-layout")
    .getByRole("button", { name: "HH5", exact: true })
    .click();
  await page.getByRole("button", { name: "1", exact: true }).click();
  await page.getByRole("button", { name: "Female", exact: true }).click();
  await page
    .getByRole("button", { name: "Yes, available", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Confirm your location to vote" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: "Change device", exact: true })
    .click();
  await page.getByRole("button", { name: "Mac", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "HH5 overview" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Contribute|Vote:/ }),
  ).toHaveCount(0);
});

test("blocked session storage still permits choosing and changing the experience", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", {
      get() {
        throw new Error("blocked");
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Mac", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "HH5 overview" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Change device", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mobile device", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Yes, available", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "How are you joining?" }),
  ).toBeVisible();
});

for (const pendingStep of ["geolocation", "verification"] as const) {
  test(`changing to Mac cancels a pending ${pendingStep} from an earlier contribution screen`, async ({
    page,
  }) => {
    await page.addInitScript((step) => {
      Object.defineProperty(navigator, "geolocation", {
        value: {
          getCurrentPosition(success: PositionCallback) {
            Object.assign(window, {
              finishPendingLocation: () =>
                success({
                  coords: {
                    latitude: 51.907327,
                    longitude: -8.513503,
                    accuracy: 20,
                  },
                  timestamp: Date.now(),
                } as GeolocationPosition),
            });
            if (step === "verification") {
              (
                window as unknown as { finishPendingLocation: () => void }
              ).finishPendingLocation();
            }
          },
        },
      });
    }, pendingStep);
    const writes: string[] = [];
    let finishVerification: (() => Promise<void>) | undefined;
    await page.route("**/reports", (route) => {
      writes.push("vote");
      return route.fulfill({
        status: 403,
        json: {
          code: "LOCATION_VERIFICATION_REQUIRED",
          message: "Confirm your location to vote.",
          statusCode: 403,
        },
      });
    });
    await page.route("**/locations/HH5/verify-location", (route) => {
      writes.push("verify");
      const respond = () =>
        route.fulfill({
          json: {
            authorized: true,
            expiresAt: new Date(Date.now() + 14400000).toISOString(),
          },
        });
      if (pendingStep === "verification") finishVerification = respond;
      else return respond();
    });
    await page.goto("/?view=overview");
    await page
      .getByRole("button", { name: "Mobile device", exact: true })
      .click();
    await page.getByRole("button", { name: "Consult", exact: true }).click();
    await page.getByRole("link", { name: "HH5 building page" }).click();
    await expect(page).toHaveURL(/\/HH5$/);
    await expect(
      page.getByRole("heading", { name: "Mobile device", exact: true }),
    ).toBeFocused();
    await page.getByRole("button", { name: "Contribute", exact: true }).click();
    await expect(page).toHaveURL(/\/HH5\?view=contribute$/);
    await page
      .locator(".home-layout")
      .getByRole("button", { name: "HH5", exact: true })
      .click();
    await page.getByRole("button", { name: "1", exact: true }).click();
    await page.getByRole("button", { name: "Female", exact: true }).click();
    await page
      .getByRole("button", { name: "Yes, available", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm location", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Confirming your location…",
        exact: true,
      }),
    ).toBeDisabled();
    if (pendingStep === "verification")
      await expect.poll(() => Boolean(finishVerification)).toBe(true);
    await page.goBack();
    await expect(page).toHaveURL(/\/\?view=overview$/);
    await page
      .getByRole("button", { name: "Change device", exact: true })
      .click();
    await page.getByRole("button", { name: "Mac", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "HH5 overview" }),
    ).toBeVisible();
    if (pendingStep === "geolocation")
      await page.evaluate(() => {
        (
          window as unknown as { finishPendingLocation: () => void }
        ).finishPendingLocation();
      });
    else await finishVerification?.();
    await page.evaluate(async () => {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    });
    expect(writes).toEqual(
      pendingStep === "geolocation" ? ["vote"] : ["vote", "verify"],
    );
    await expect(
      page.getByRole("button", { name: /Contribute|Vote:/ }),
    ).toHaveCount(0);
  });
}

for (const entry of ["/", "/?view=overview", "/HH5?view=overview"]) {
  test(`mobile choice always enters Contribute from ${entry} and after changing device`, async ({
    page,
  }) => {
    await page.addInitScript(() =>
      localStorage.setItem("skip-the-trip:view:v1", "overview"),
    );
    await page.goto(entry);
    await page
      .getByRole("button", { name: "Mobile device", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Contribute", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", { name: "Yes, available", exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(/view=contribute/);
    await page.getByRole("button", { name: "Consult", exact: true }).click();
    await page
      .getByRole("button", { name: "Change device", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Mobile device", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Contribute", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", { name: "Yes, available", exact: true }),
    ).toBeVisible();
  });
}
