import { expect, test } from "@playwright/test";
import { login, mockSession } from "./auth-fixtures";
import { factoryLogin, offer, paged } from "./factory-fixtures";

const harvest = {
  id: 2,
  teaGrade: " ctc ",
  estimatedQuantityKg: 25,
  expectedHarvestDate: "2099-01-01",
  collectionLocation: "Eligible depot",
  status: "ACTIVE",
  isActive: true,
};

test("verified factory prepares procurement candidates on mobile and reviews listing details", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(
    "**/backend/factory-profiles/me/verification-history",
    (route) => route.fulfill({ json: [] }),
  );
  await page.route("**/backend/order-requests/my?*", (route) =>
    route.fulfill({ json: paged([]) }),
  );
  await page.route("**/backend/offers/my?*", (route) =>
    route.fulfill({ json: paged([offer]) }),
  );
  await page.route("**/backend/listings?*", (route) => {
    expect(new URL(route.request().url()).searchParams.get("teaGrade")).toBe(
      "CTC",
    );
    return route.fulfill({
      json: paged([
        harvest,
        {
          ...harvest,
          id: 3,
          teaGrade: "CTC Premium",
          collectionLocation: "Partial-grade depot",
        },
        {
          ...harvest,
          id: 4,
          estimatedQuantityKg: 24.999,
          collectionLocation: "Small batch depot",
        },
        {
          ...harvest,
          id: 5,
          status: "RESERVED",
          collectionLocation: "Reserved depot",
        },
      ]),
    });
  });
  await page.route("**/backend/listings/2", (route) =>
    route.fulfill({ json: harvest }),
  );
  await page.route("**/backend/offers?*", (route) =>
    route.fulfill({ json: paged([]) }),
  );
  await factoryLogin(page);
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("link", { name: "Factory dashboard" }).click();
  await page.getByRole("link", { name: "Open procurement workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Procurement workspace" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Compare price offers" }),
  ).toHaveAttribute("href", "/marketplace/offers");
  await expect(
    page.getByRole("link", { name: "Browse harvest listings" }),
  ).toHaveAttribute("href", "/marketplace/listings");
  await expect(page.getByLabel("Your active offer")).toHaveValue("42");
  await expect(page.getByText("1 match on this listing page")).toBeVisible();
  await expect(page.getByText("Eligible depot")).toBeVisible();
  await expect(page.getByText("Partial-grade depot")).toHaveCount(0);
  await expect(page.getByText("Small batch depot")).toHaveCount(0);
  await expect(page.getByText("Reserved depot")).toHaveCount(0);
  expect(
    await page.locator("html").evaluate((html) => html.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.getByRole("link", { name: "Review harvest" }).click();
  await expect(page).toHaveURL(/\/marketplace\/listings\/2$/);
  await expect(page.getByText("Eligible depot")).toBeVisible();
});

test("pending factory can browse but cannot start candidate matching", async ({
  page,
}) => {
  let queries = 0;
  await page.route("**/backend/listings?*", (route) => {
    queries++;
    return route.fulfill({ json: paged([]) });
  });
  await page.route(
    "**/backend/factory-profiles/me/verification-history",
    (route) => route.fulfill({ json: [] }),
  );
  await page.route("**/backend/order-requests/my?*", (route) =>
    route.fulfill({ json: paged([]) }),
  );
  await page.route("**/backend/offers/my?*", (route) =>
    route.fulfill({ json: paged([offer]) }),
  );
  await factoryLogin(page, "PENDING");
  await page.getByRole("link", { name: "Factory dashboard" }).click();
  await page.getByRole("link", { name: "Open procurement workspace" }).click();
  await expect(
    page.getByText(
      "Your factory must be verified to prepare a procurement request.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Browse harvest listings" }),
  ).toBeVisible();
  await expect(page.getByLabel("Your active offer")).toHaveCount(0);
  expect(queries).toBe(0);
});

test("factory workspace excludes anonymous users and other roles", async ({
  page,
}) => {
  await page.goto("/factory/procurement");
  await expect(page).toHaveURL(/\/login$/);
  await mockSession(page, "ADMIN");
  await login(page);
  await expect(page).toHaveURL(/\/admin$/);
  await page.evaluate(() => {
    window.history.pushState({}, "", "/factory/procurement");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole("heading", { name: "Procurement workspace" }),
  ).toHaveCount(0);
});
