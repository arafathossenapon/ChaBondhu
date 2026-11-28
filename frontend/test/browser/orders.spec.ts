import { expect, test, type Page } from "@playwright/test";
import { factoryLogin, offer, paged } from "./factory-fixtures";
import { growerLogin, listing } from "./grower-fixtures";

// The app intentionally keeps its JWT in memory across client-side navigation.
async function openRoute(page: Page, to: string) {
  await page.evaluate((path) => {
    window.history.pushState(window.history.state, "", path);
    window.dispatchEvent(
      new PopStateEvent("popstate", { state: window.history.state }),
    );
  }, to);
}

const row = {
  id: 12,
  harvestListingId: 1,
  priceOfferId: 42,
  quotedPricePerKg: 32.5,
  status: "PENDING",
  closureReason: null,
  createdAt: "2026-01-01",
  harvestListing: {
    teaGrade: listing.teaGrade,
    estimatedQuantityKg: listing.estimatedQuantityKg,
  },
  factoryProfile: { factoryName: "Tetulia Tea Works", district: "Panchagarh" },
};

test("verified factory reviews matching offers and submits the exact IDs", async ({
  page,
}) => {
  await factoryLogin(page);
  await page.route("**/backend/listings/1", (route) =>
    route.fulfill({ json: listing }),
  );
  await page.route("**/backend/offers/my?*", (route) =>
    route.fulfill({
      json: paged([
        { ...offer, teaGrade: " first flush " },
        {
          ...offer,
          id: 43,
          teaGrade: listing.teaGrade,
          minimumQuantityKg: 200,
        },
        {
          ...offer,
          id: 44,
          teaGrade: listing.teaGrade,
          validUntil: "2000-01-01",
        },
      ]),
    }),
  );
  let submissions = 0;
  await page.route("**/backend/order-requests", (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toEqual({
      harvestListingId: 1,
      priceOfferId: 42,
    });
    submissions += 1;
    return submissions === 1
      ? route.fulfill({
          status: 409,
          json: { message: "A pending request already exists." },
        })
      : route.fulfill({ status: 201, json: row });
  });
  await openRoute(page, "/factory/requests/new?listing=1");
  await expect(
    page.getByRole("button", { name: "Review request" }),
  ).toBeDisabled();
  const select = page.getByLabel("Your matching offer");
  await expect(select.locator("option")).toHaveCount(2);
  await select.selectOption("42");
  await page.getByRole("button", { name: "Review request" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Send request" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "A pending request already exists.",
  );
  await dialog.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("Request #12 sent to the grower.")).toBeVisible();
  expect(submissions).toBe(2);
});

test("unverified factory cannot open the request form", async ({ page }) => {
  await factoryLogin(page, "PENDING");
  await openRoute(page, "/factory/requests/new?listing=1");
  await expect(
    page.getByText("A verified factory profile is required."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review request" }),
  ).toHaveCount(0);
});

test("factory can withdraw its pending request from its own queue", async ({
  page,
}) => {
  await factoryLogin(page);
  let status = "PENDING";
  await page.route("**/backend/order-requests/my?*", (route) =>
    route.fulfill({ json: paged([{ ...row, status }]) }),
  );
  await page.route("**/backend/order-requests/12/withdraw", (route) => {
    expect(route.request().method()).toBe("PATCH");
    status = "WITHDRAWN";
    return route.fulfill({ json: { ...row, status } });
  });
  await openRoute(page, "/factory/requests");
  await page.getByRole("button", { name: "Withdraw", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Withdraw request" })
    .click();
  await expect(page.getByText("Request #12 withdrawn.")).toBeVisible();
  await expect(page.getByText("Withdrawn", { exact: true })).toBeVisible();
});

test("grower accepts and rejects requests with confirmations and sees refreshed results", async ({
  page,
}) => {
  await growerLogin(page);
  await page.waitForURL("**/grower");
  await page.route("**/backend/listings/my", (route) =>
    route.fulfill({ json: [listing] }),
  );
  let rows = [row, { ...row, id: 13 }];
  await page.route("**/backend/listings/1/order-requests?*", (route) =>
    route.fulfill({ json: paged(rows) }),
  );
  await page.route("**/backend/order-requests/13/reject", (route) => {
    rows = rows.map((item) =>
      item.id === 13 ? { ...item, status: "REJECTED" } : item,
    );
    return route.fulfill({ json: rows[1] });
  });
  await page.route("**/backend/order-requests/12/accept", (route) => {
    rows = rows.map((item) =>
      item.id === 12 ? { ...item, status: "ACCEPTED" } : item,
    );
    return route.fulfill({ json: { request: rows[0], order: { id: 3 } } });
  });
  await openRoute(page, "/grower/requests");
  await page.getByLabel("Your harvest listing").selectOption("1");
  await page
    .getByRole("article")
    .filter({ hasText: "Request #13" })
    .getByRole("button", { name: "Reject" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Reject request" })
    .click();
  await expect(page.getByText("Rejected", { exact: true })).toBeVisible();
  await page
    .getByRole("article")
    .filter({ hasText: "Request #12" })
    .getByRole("button", { name: "Accept" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Accept request" })
    .click();
  await expect(page.getByText("Accepted", { exact: true })).toBeVisible();
});

const order = {
  id: 3,
  orderRequestId: 12,
  priceOfferId: 42,
  harvestListing: { id: 1, teaGrade: listing.teaGrade },
  farmerProfile: { gardenName: "Tea garden", district: "Panchagarh" },
  factoryProfile: row.factoryProfile,
  agreedPricePerKg: 32.5,
  estimatedQuantityKg: 125.5,
  actualCollectedWeightKg: 120,
  proposedCollectionDate: null,
  collectionPoint: null,
  pickupNotes: null,
  estimatedTransportCostBdt: null,
  orderStatus: "COMPLETED",
  paymentStatus: "CONFIRMED",
  createdAt: "2026-01-01",
};

for (const role of ["grower", "factory"] as const) {
  test(`${role} sees order history and read-only details on mobile`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await (role === "grower" ? growerLogin(page) : factoryLogin(page));
    await page.waitForURL("**/" + role);
    await page.route("**/backend/orders/my?*", (route) =>
      route.fulfill({ json: paged([order]) }),
    );
    await page.route("**/backend/orders/3", (route) =>
      route.fulfill({ json: order }),
    );
    await openRoute(page, `/${role}/orders`);
    await expect(
      page.getByRole("heading", { name: "My orders" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "View order #3" }).click();
    await expect(page.getByRole("heading", { name: "Order #3" })).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Pickup and collection" })
        .getByText("Actual collected weight"),
    ).toBeVisible();
    await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(390);
  });
}

test("role guard protects factory requests and order history shows loading, error, retry and empty", async ({
  page,
}) => {
  await growerLogin(page);
  await page.waitForURL("**/grower");
  await openRoute(page, "/factory/requests");
  await page.waitForURL("**/grower");
  await expect(
    page.getByRole("heading", { name: "My order requests" }),
  ).toHaveCount(0);
  let canRecover = false;
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/backend/orders/my?*", async (route) => {
    if (!canRecover) {
      await held;
      return route.fulfill({ status: 403, json: { message: "Forbidden" } });
    }
    return route.fulfill({ json: paged([]) });
  });
  await openRoute(page, "/grower/orders");
  await expect(
    page.getByRole("status", { name: "Loading marketplace results" }),
  ).toBeVisible();
  release();
  await expect(page.getByRole("alert")).toHaveText(
    "You do not have access to these results.",
  );
  canRecover = true;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("No orders on this page.")).toBeVisible();
});
