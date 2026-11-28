import { expect, test, type Page } from "@playwright/test";
import { factoryLogin } from "./factory-fixtures";
import { growerLogin } from "./grower-fixtures";

const order = {
  id: 3,
  orderRequestId: 12,
  priceOfferId: 42,
  harvestListing: { id: 1, teaGrade: "First Flush" },
  farmerProfile: { gardenName: "Tea Garden", district: "Panchagarh" },
  factoryProfile: { factoryName: "Tea Works", district: "Panchagarh" },
  agreedPricePerKg: 32.5,
  estimatedQuantityKg: 125.5,
  actualCollectedWeightKg: null,
  proposedCollectionDate: null,
  collectionPoint: null,
  pickupNotes: null,
  estimatedTransportCostBdt: null,
  orderStatus: "ACCEPTED",
  paymentStatus: "PENDING",
  createdAt: "2026-01-01",
};

async function openOrder(page: Page, role: "grower" | "factory") {
  await page.waitForURL("**/" + role);
  // Navigate within the SPA so its in-memory JWT survives.
  await page.evaluate((path) => {
    history.pushState(history.state, "", path);
    window.dispatchEvent(
      new PopStateEvent("popstate", { state: history.state }),
    );
  }, `/${role}/orders/3`);
}

test("factory validates, reviews and schedules a pickup exactly once", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await factoryLogin(page);
  let saved = false;
  let writes = 0;
  let reads = 0;
  let release = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const pickup = {
    orderStatus: "PICKUP_SCHEDULED",
    proposedCollectionDate: "2099-03-20",
    collectionPoint: "Tetulia depot",
    pickupNotes: "Ask for the grower",
    estimatedTransportCostBdt: 450.25,
  };
  await page.route("**/backend/orders/3", (route) => {
    reads++;
    return route.fulfill({ json: saved ? { ...order, ...pickup } : order });
  });
  await page.route("**/backend/orders/3/status", async (route) => {
    writes++;
    expect(route.request().method()).toBe("PATCH");
    expect(route.request().postDataJSON()).toEqual(pickup);
    await pending;
    saved = true;
    await route.fulfill({ json: { ...order, ...pickup } });
  });

  await openOrder(page, "factory");
  await expect(page.getByText("Not scheduled")).toBeVisible();
  await page.getByRole("button", { name: "Schedule pickup" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Review schedule" }).click();
  await expect(dialog.getByText("Enter a valid pickup date.")).toBeVisible();
  await expect(dialog.getByText("Enter the collection point.")).toBeVisible();
  await dialog.getByLabel("Pickup date").fill("2000-01-01");
  await dialog.getByLabel("Collection point").fill("  Tetulia depot ");
  await dialog.getByLabel("Pickup notes").fill("Ask for the grower");
  await dialog.getByLabel("Estimated transport").fill("450.251");
  await dialog.getByRole("button", { name: "Review schedule" }).click();
  await expect(dialog.getByText(/at most two decimal places/)).toBeVisible();
  await dialog.getByLabel("Estimated transport").fill("450.25");
  await dialog.getByRole("button", { name: "Review schedule" }).click();
  await expect(dialog.getByText(/already passed in Bangladesh/)).toBeVisible();
  await dialog.getByRole("button", { name: "Edit schedule" }).click();
  await dialog.getByLabel("Pickup date").fill("2099-03-20");
  await dialog.getByRole("button", { name: "Review schedule" }).click();
  await dialog.getByRole("button", { name: "Confirm pickup" }).click();
  await expect(dialog.getByRole("button", { name: "Saving…" })).toBeDisabled();
  release();
  await expect(
    page.getByText("Pickup scheduled.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Tetulia depot")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Schedule pickup" }),
  ).toHaveCount(0);
  await expect.poll(() => reads).toBeGreaterThanOrEqual(2);
  expect(writes).toBe(1);
});

test("grower sees the saved pickup and pending weight without write controls", async ({
  page,
}) => {
  await growerLogin(page);
  await page.route("**/backend/orders/3", (route) =>
    route.fulfill({
      json: {
        ...order,
        orderStatus: "PICKUP_SCHEDULED",
        proposedCollectionDate: "2099-03-20",
        collectionPoint: "Tetulia depot",
      },
    }),
  );
  await openOrder(page, "grower");
  await expect(page.getByText("20 Mar 2099", { exact: true })).toBeVisible();
  await expect(page.getByText("Tetulia depot")).toBeVisible();
  await expect(page.getByText("Not recorded")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Schedule pickup" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Record collection" }),
  ).toHaveCount(0);
});
