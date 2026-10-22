import { expect, test } from "@playwright/test";

test.skip(
  !process.env.PREVIEW_BASE_URL,
  "Run against a deployed prefix preview",
);
test.use({ baseURL: process.env.PREVIEW_BASE_URL });

test("preview isolates preferences and keeps navigation, assets and API under its prefix", async ({
  context,
  page,
}) => {
  await context.addInitScript(() => {
    localStorage.setItem(
      "skip-the-trip:analytics-consent:v1:/teste2_0/",
      "declined",
    );
    localStorage.setItem(
      "skip-the-trip:favorite:v1",
      JSON.stringify({ building: "HH5", floor: "3", category: "Male" }),
    );
    sessionStorage.setItem("skip-the-trip:device:v1", "mobile");
  });
  const previewBase =
    process.env.PREVIEW_BASE_URL ?? "http://localhost:8082/teste2_0/";
  const webRelease = await page.request.get(
    new URL("release.json", previewBase).href,
  );
  const apiRelease = await page.request.get(
    new URL("api/release", previewBase).href,
  );
  expect(webRelease.ok()).toBe(true);
  expect(apiRelease.ok()).toBe(true);
  expect(await apiRelease.json()).toEqual(await webRelease.json());
  const escaped: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (/^\/(assets\/|api\/|favicon\.svg)/.test(url.pathname))
      escaped.push(url.pathname);
  });
  await page.goto(process.env.PREVIEW_BASE_URL?.replace(/\/$/, "") ?? "/");
  await expect(
    page.getByText("Version 2.0 · Test environment", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Favorite setup" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "How are you joining?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mac", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "HH5 overview" }),
  ).toBeVisible();
  await expect(page.locator(".overview-bathroom")).toHaveCount(12);
  await page
    .getByRole("button", {
      name: "Save favorite: HH5 floor 1 Female",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("region", { name: "Your favorite", exact: true }),
  ).toContainText("Female");
  await page.getByRole("link", { name: "HH5 building page" }).click();
  await expect(page).toHaveURL(/\/teste2_0\/HH5$/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "HH5 overview" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Privacy", exact: true }).click();
  await expect(page).toHaveURL(/\/teste2_0\/privacy$/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Privacy notice" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Skip the Trip home" }).click();
  await expect(
    page.getByRole("region", { name: "Your favorite", exact: true }),
  ).toContainText("Female");
  await page
    .getByRole("button", { name: "Change device", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mobile device", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open favorite", exact: true })
    .click();
  await expect(page.locator(".bathroom-icon").first()).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".bathroom-icon")
        .first()
        .evaluate(
          (element: HTMLImageElement) =>
            element.complete && element.naturalWidth > 0,
        ),
    )
    .toBe(true);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("skip-the-trip:favorite:v1") ?? "null")
          .floor,
    ),
  ).toBe("3");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(escaped).toEqual([]);
});
