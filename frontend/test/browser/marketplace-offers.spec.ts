import { expect, test } from "@playwright/test";
import { login, mockSession } from "./auth-fixtures";

const offer = {
  id: 42,
  teaGrade: "CTC",
  pricePerKg: 32.5,
  status: "ACTIVE",
  validUntil: "2099-12-31",
  qualityRequirements: "Fresh leaves",
  minimumQuantityKg: 25,
  estimatedTransportCostBdt: 350,
  factoryProfile: {
    id: 3,
    factoryName: "Tetulia Tea Works",
    district: "Panchagarh",
  },
};

test("isolated factory comparison sends filters and conceals expired or withdrawn offers", async ({
  page,
}) => {
  await mockSession(page, "FACTORY");
  await page.route("**/backend/factory-profiles/me", (route) =>
    route.fulfill({
      json: {
        factoryName: "Test Factory",
        representativeName: "Owner",
        district: "Panchagarh",
        upazila: "Tetulia",
        verificationStatus: "PENDING",
      },
    }),
  );
  await page.route("**/backend/offers?*", (route) =>
    route.fulfill({
      json: {
        data: [
          offer,
          {
            ...offer,
            id: 43,
            validUntil: "2000-01-01",
            factoryProfile: {
              ...offer.factoryProfile,
              factoryName: "Expired record",
            },
          },
          {
            ...offer,
            id: 44,
            status: "WITHDRAWN",
            factoryProfile: {
              ...offer.factoryProfile,
              factoryName: "Withdrawn record",
            },
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      },
    }),
  );
  await page.route("**/backend/offers/42", (route) =>
    route.fulfill({ json: offer }),
  );
  await login(page);
  await page.getByRole("link", { name: "Marketplace", exact: true }).click();
  await page.getByRole("link", { name: "Factory offers" }).click();
  await expect(
    page.getByRole("link", { name: "Tetulia Tea Works" }),
  ).toBeVisible();
  await expect(page.getByText(/BDT\s*32\.50/)).toBeVisible();
  await expect(page.getByText("Expired record")).toHaveCount(0);
  await expect(page.getByText("Withdrawn record")).toHaveCount(0);
  await page.getByLabel("Tea grade").fill("CTC");
  await page.getByLabel("Min BDT / kg").fill("25.5");
  await page.getByLabel("Max BDT / kg").fill("45");
  await page.getByLabel("Sort offers").selectOption("pricePerKg:ASC");
  const filtered = page.waitForRequest((req) => {
    const url = new URL(req.url());
    return (
      url.pathname === "/backend/offers" &&
      url.searchParams.get("minPrice") === "25.5"
    );
  });
  await page.getByRole("button", { name: "Apply filters" }).click();
  const params = new URL((await filtered).url()).searchParams;
  expect(params.get("teaGrade")).toBe("CTC");
  expect(params.get("maxPrice")).toBe("45");
  expect(params.get("sortBy")).toBe("pricePerKg");
  expect(params.get("sortOrder")).toBe("ASC");
  await page.getByRole("link", { name: "Tetulia Tea Works" }).click();
  await expect(page.getByText("Fresh leaves")).toBeVisible();
  await expect(page.getByText(/BDT\s*350\.00/)).toBeVisible();
});

test("listing details present same-grade offers as market context", async ({
  page,
}) => {
  await mockSession(page, "ADMIN");
  await page.route("**/backend/listings?*", (route) =>
    route.fulfill({
      json: {
        data: [
          {
            id: 21,
            teaGrade: "CTC",
            estimatedQuantityKg: 120,
            expectedHarvestDate: "2099-01-01",
            collectionLocation: "Depot",
            status: "ACTIVE",
            isActive: true,
          },
        ],
        total: 1,
        limit: 20,
        page: 1,
      },
    }),
  );
  await page.route("**/backend/listings/21", (route) =>
    route.fulfill({
      json: {
        id: 21,
        teaGrade: "CTC",
        estimatedQuantityKg: 120,
        expectedHarvestDate: "2099-01-01",
        collectionLocation: "Depot",
        status: "ACTIVE",
        isActive: true,
      },
    }),
  );
  await page.route("**/backend/offers?*", (route) => {
    const params = new URL(route.request().url()).searchParams;
    expect(params.get("teaGrade")).toBe("CTC");
    expect(params.get("limit")).toBe("3");
    return route.fulfill({
      json: { data: [offer], total: 1, page: 1, limit: 3, totalPages: 1 },
    });
  });
  await login(page);
  await page.getByRole("link", { name: "Marketplace", exact: true }).click();
  await page.getByRole("link", { name: "CTC", exact: true }).click();
  await expect(page.getByText(/market prices and are not bids/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Tetulia Tea Works" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Compare offers for CTC" }),
  ).toHaveAttribute("href", "/marketplace/offers?teaGrade=CTC");
});

test("a marketplace API 401 signs the user out", async ({ page }) => {
  await mockSession(page, "ADMIN");
  await page.route("**/backend/listings?*", (route) =>
    route.fulfill({ status: 401, json: { message: "Unauthorized" } }),
  );
  await login(page);
  await page.getByRole("link", { name: "Marketplace", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("status")).toHaveText(
    "Your session ended. Sign in again.",
  );
});
