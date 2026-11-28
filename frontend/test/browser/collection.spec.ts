import { expect, test } from "@playwright/test";
import { factoryLogin } from "./factory-fixtures";

test.beforeEach(async ({ page }) => {
  await factoryLogin(page);
});

const scheduled = {
  id: 7,
  orderRequestId: 4,
  priceOfferId: 2,
  harvestListing: { id: 1, teaGrade: "First Flush" },
  farmerProfile: { gardenName: "Tea Garden", district: "Panchagarh" },
  factoryProfile: { factoryName: "Tea Works", district: "Panchagarh" },
  agreedPricePerKg: 32.5,
  estimatedQuantityKg: 125.5,
  actualCollectedWeightKg: null,
  proposedCollectionDate: "2099-03-20",
  collectionPoint: "Tetulia depot",
  pickupNotes: null,
  estimatedTransportCostBdt: null,
  orderStatus: "PICKUP_SCHEDULED",
  paymentStatus: "PENDING",
  createdAt: "2026-01-01",
};

async function openOrder(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    history.pushState(history.state, "", "/factory/orders/7");
    window.dispatchEvent(
      new PopStateEvent("popstate", { state: history.state }),
    );
  });
}

test("factory records exact measured weight once and refreshes the order", async ({
  page,
}) => {
  const completedCollection = {
    ...scheduled,
    orderStatus: "COLLECTED",
    actualCollectedWeightKg: 138.125,
  };
  let saved = false;
  let gets = 0;
  let writes = 0;
  let release = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/backend/orders/7", (route) => {
    gets++;
    return route.fulfill({ json: saved ? completedCollection : scheduled });
  });
  await page.route("**/backend/orders/7/status", async (route) => {
    writes++;
    expect(route.request().method()).toBe("PATCH");
    expect(route.request().postDataJSON()).toEqual({
      orderStatus: "COLLECTED",
      actualCollectedWeightKg: 138.125,
    });
    await pending;
    saved = true;
    await route.fulfill({ json: completedCollection });
  });
  await openOrder(page);
  await page.getByRole("button", { name: "Record collection" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/Tetulia depot/)).toBeVisible();
  await expect(dialog.getByText(/125.5 kg estimated harvest/)).toBeVisible();
  for (const invalid of ["0", "-1", "138.1256", "10000000"]) {
    await dialog.getByLabel("Actual collected weight (kg)").fill(invalid);
    await dialog
      .getByRole("button", { name: "Review collected weight" })
      .click();
    await expect(
      dialog.getByText(/with up to three decimal places/),
    ).toBeVisible();
  }
  await dialog.getByLabel("Actual collected weight (kg)").fill("138.125");
  await dialog.getByRole("button", { name: "Review collected weight" }).click();
  await expect(dialog.getByText("138.125 kg")).toBeVisible();
  await dialog.getByRole("button", { name: "Confirm collection" }).click();
  await expect(dialog.getByRole("button", { name: "Saving…" })).toBeDisabled();
  release();
  await expect(page.getByText("Collection recorded.")).toBeVisible();
  await expect(
    page.getByRole("article").getByText("125.5 kg", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Pickup and collection" })
      .getByText("138.125 kg", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Record collection" }),
  ).toHaveCount(0);
  await expect.poll(() => gets).toBeGreaterThanOrEqual(2);
  expect(writes).toBe(1);
});

test("a stale collection action refreshes after conflict and keeps server feedback", async ({
  page,
}) => {
  let conflict = false;
  await page.route("**/backend/orders/7", (route) =>
    route.fulfill({
      json: conflict
        ? { ...scheduled, orderStatus: "COLLECTED", actualCollectedWeightKg: 1 }
        : scheduled,
    }),
  );
  await page.route("**/backend/orders/7/status", (route) => {
    conflict = true;
    return route.fulfill({
      status: 409,
      json: { message: "Order cannot move to the requested status" },
    });
  });
  await openOrder(page);
  await page.getByRole("button", { name: "Record collection" }).click();
  await page.getByLabel("Actual collected weight (kg)").fill("1");
  await page.getByRole("button", { name: "Review collected weight" }).click();
  await page.getByRole("button", { name: "Confirm collection" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page
      .getByRole("region", { name: "Pickup and collection" })
      .getByRole("alert"),
  ).toHaveText("Order cannot move to the requested status");
  await expect(
    page
      .getByRole("region", { name: "Pickup and collection" })
      .getByText("1 kg", { exact: true }),
  ).toBeVisible();
});

test("unavailable order shows an error and never exposes a factory write action", async ({
  page,
}) => {
  await page.route("**/backend/orders/7", (route) =>
    route.fulfill({ status: 404, json: { message: "Order not found" } }),
  );
  await openOrder(page);
  await expect(page.getByRole("alert")).toHaveText("Order not found");
  await expect(
    page.getByRole("button", { name: "Schedule pickup" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Record collection" }),
  ).toHaveCount(0);
});
