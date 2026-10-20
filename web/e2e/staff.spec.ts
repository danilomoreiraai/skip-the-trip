import { expect, test } from "@playwright/test";

test("staff login starts and ends an attributed cleaning cycle; public votes stay paused", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("skip-the-trip:analytics-consent:v1", "declined"),
  );
  let authenticated = false;
  let cleaning: Record<string, unknown> | null = null;
  const bathrooms = ["G", "1", "2", "3"].flatMap((floor) =>
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
  );
  await page.route("**/staff/session", (route) => {
    const method = route.request().method();
    if (method === "POST") authenticated = true;
    if (method === "DELETE") {
      authenticated = false;
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({
      status: authenticated ? 200 : 401,
      json: authenticated
        ? {
            authenticated: true,
            building: "HH5",
            csrfToken: "b".repeat(64),
            expiresAt: new Date(Date.now() + 28_800_000).toISOString(),
          }
        : { message: "Staff access required" },
    });
  });
  await page.route("**/locations/HH5/status", (route) =>
    route.fulfill({
      json: {
        building: "HH5",
        generatedAt: new Date().toISOString(),
        bathrooms,
        cleaning: cleaning ? [cleaning] : [],
      },
    }),
  );
  await page.route("**/staff/cleaning", (route) => {
    const body = route.request().postDataJSON();
    cleaning = {
      building: "HH5",
      floor: "G",
      category: "Male",
      id: "550e8400-e29b-41d4-a716-446655440099",
      state: body.action === "end" ? "ended" : "active",
      startedAt: new Date().toISOString(),
      expectedEndAt: new Date(
        Date.now() + body.minutes * 60_000 || Date.now() + 900_000,
      ).toISOString(),
      endedAt: body.action === "end" ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
      version: body.action === "end" ? 2 : 1,
    };
    return route.fulfill({ json: cleaning });
  });
  await page.route("**/reports?**", (route) =>
    route.fulfill({ json: { ...bathrooms[0], cleaning } }),
  );
  await page.goto("/staff");
  await expect(
    page.getByRole("heading", { name: "Cleaner access", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Invitation code", { exact: true })
    .fill("a".repeat(64));
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("button", { name: "Start cleaning · 15 min", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Cleaning reported by the team" }),
  ).toBeVisible();
  await page.goto("/HH5");
  await expect(page.locator(".overview-bathroom").first()).toContainText(
    "Cleaning reported by the team",
  );
  await page
    .getByRole("button", { name: "Contribute: HH5 floor G Male", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Yes, available", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "No, unavailable", exact: true }),
  ).toBeDisabled();
  await page.goto("/staff");
  await page.getByRole("button", { name: "End cleaning", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Cleaning ended by the team" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Cleaner access", exact: true }),
  ).toBeVisible();
});
test("staff feature disabled exposes no login or operational controls", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("skip-the-trip:analytics-consent:v1", "declined"),
  );
  await page.route("**/staff/session", (route) =>
    route.fulfill({ status: 404, json: { message: "Not found" } }),
  );
  await page.goto("/staff");
  await expect(
    page.getByText("Cleaner access is not enabled yet.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Invitation code", { exact: true })).toHaveCount(
    0,
  );
});
