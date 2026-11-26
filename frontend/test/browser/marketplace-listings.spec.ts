import { expect, test } from "@playwright/test";
import { login, mockSession } from "./auth-fixtures";

const listings = [
  {
    id: 21,
    teaGrade: "CTC",
    estimatedQuantityKg: 120,
    expectedHarvestDate: "2099-01-01",
    collectionLocation: "Tetulia collection point",
    qualityDescription: "Fresh leaves",
    status: "ACTIVE",
    isActive: true,
    farmerProfile: {
      gardenName: "Tea Hill",
      division: "Rangpur",
      district: "Panchagarh",
      upazila: "Tetulia",
    },
  },
  {
    id: 22,
    teaGrade: "CTC Premium",
    estimatedQuantityKg: 150,
    expectedHarvestDate: "2099-01-02",
    collectionLocation: "Tetulia depot",
    status: "ACTIVE",
    isActive: true,
  },
];

test("isolated listing UI applies filters, paginates and opens details", async ({
  page,
}) => {
  await mockSession(page, "ADMIN");
  let release!: () => void;
  const delay = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/backend/listings?*", async (route) => {
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    const query = new URL(route.request().url()).searchParams;
    if (query.has("teaGrade")) {
      expect(query.get("teaGrade")).toBe("CTC");
      expect(query.get("district")).toBe("Panchagarh");
    }
    const page = Number(query.get("page"));
    await delay;
    await route.fulfill({
      json: { data: [listings[page - 1]], total: 2, page, limit: 1 },
    });
  });
  await page.route("**/backend/listings/22", (route) =>
    route.fulfill({ json: listings[1] }),
  );
  await login(page);
  await page.getByRole("link", { name: "Marketplace", exact: true }).click();
  await expect(
    page.getByRole("status", { name: "Loading marketplace results" }),
  ).toBeVisible();
  release();
  await expect(page.getByText("Tea Hill · Panchagarh")).toBeVisible();
  await expect(page.getByText("120 kg")).toBeVisible();
  await page.getByLabel("Tea grade").fill("CTC");
  await page.getByLabel("District").fill("Panchagarh");
  await page.getByRole("button", { name: "Search harvests" }).click();
  await expect(page).toHaveURL(/teaGrade=CTC&district=Panchagarh/);
  await page.getByRole("link", { name: "Next page" }).click();
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  await page.getByRole("link", { name: "CTC Premium" }).click();
  await expect(
    page.getByRole("heading", { name: "CTC Premium" }),
  ).toBeVisible();
  await expect(page.getByText("Tetulia depot")).toBeVisible();
});

test("isolated listing UI renders a 403, retries and shows an empty result", async ({
  page,
}) => {
  await mockSession(page, "ADMIN");
  let forbidden = true;
  await page.route("**/backend/listings?*", (route) =>
    forbidden
      ? route.fulfill({ status: 403, json: { message: "Forbidden" } })
      : route.fulfill({ json: { data: [], total: 0, page: 1, limit: 20 } }),
  );
  await login(page);
  await page.getByRole("link", { name: "Marketplace", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "You do not have access to these results.",
  );
  forbidden = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "No listings found" }),
  ).toBeVisible();
});

test("marketplace deep link is protected and mobile navigation exposes grower listings", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/marketplace/listings");
  await expect(page).toHaveURL(/\/login$/);
  await mockSession(page);
  await page.route("**/backend/farmer-profiles/me", (route) =>
    route.fulfill({ status: 404, json: { message: "Not found" } }),
  );
  await page.route("**/backend/listings/my", (route) =>
    route.fulfill({ json: listings }),
  );
  await login(page);
  await expect(page).toHaveURL(/\/grower$/);
  await page.getByRole("button", { name: "Menu" }).click();
  const nav = page.getByRole("dialog", { name: "Navigation" });
  await expect(nav.getByRole("link", { name: "Marketplace" })).toBeVisible();
  await nav.getByRole("link", { name: "My listings" }).click();
  await expect(page).toHaveURL(/\/grower\/listings$/);
  await expect(
    page.getByRole("heading", { name: "My listings" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "CTC", exact: true }),
  ).toBeVisible();
});
