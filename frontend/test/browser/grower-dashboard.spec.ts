import { expect, test } from "@playwright/test";
import { growerLogin, listing } from "./grower-fixtures";

test("grower overview displays owner counts and offers local pagination and refresh", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let fetches = 0;
  const rows = Array.from({ length: 10 }, (_, index) => ({
    ...listing,
    id: index + 1,
    teaGrade: "Harvest " + (index + 1),
    status: index === 9 ? "EXPIRED" : "ACTIVE",
  }));
  await page.route("**/backend/listings/my", (route) => {
    fetches++;
    return route.fulfill({ json: rows });
  });
  await growerLogin(page);
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("link", { name: "Grower dashboard" }).click();
  await expect(
    page.getByRole("heading", { name: "Grower dashboard" }),
  ).toBeVisible();
  await expect(
    page.locator(".grower-metrics div").filter({ hasText: "Total listings" }),
  ).toContainText("10");
  await expect(
    page.getByRole("heading", { name: "Recently posted" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Manage listings" }).click();
  await page.getByRole("link", { name: "Next page" }).click();
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  await expect(page.getByText("Expired", { exact: true })).toBeVisible();
  const before = fetches;
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect.poll(() => fetches).toBeGreaterThan(before);
  await page.getByRole("link", { name: "Harvest 10" }).click();
  await expect(
    page.getByRole("heading", { name: "Harvest 10", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Expired", { exact: true })).toBeVisible();
  expect(
    await page.locator("html").evaluate((html) => html.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

test("grower listings show loading, retry and empty states", async ({
  page,
}) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let fail = true;
  await page.route("**/backend/listings/my", async (route) => {
    await pending;
    return fail
      ? route.fulfill({ status: 403, json: { message: "Forbidden" } })
      : route.fulfill({ json: [] });
  });
  await growerLogin(page);
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "My listings" })
    .click();
  await expect(
    page.getByRole("status", { name: "Loading marketplace results" }),
  ).toBeVisible();
  release();
  await expect(page.getByRole("alert")).toHaveText(
    "You do not have access to these results.",
  );
  fail = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "No listings yet" }),
  ).toBeVisible();
});
