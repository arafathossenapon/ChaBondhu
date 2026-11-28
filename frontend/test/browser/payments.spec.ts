import { expect, test, type Page } from "@playwright/test";
import { factoryLogin, paged } from "./factory-fixtures";
import { growerLogin } from "./grower-fixtures";

const amountBdt = "12345678901234567.89";
const amountLabel = "BDT 12,345,678,901,234,567.89";
const paymentDate = "2026-11-27";
const base = "**/backend/payments/order/7";
const attempt = {
  id: 8,
  method: "CASH",
  provider: null,
  reference: "FIXTURE-8",
  paymentDate,
  createdAt: "2026-11-27T18:30:00Z",
  decision: null,
  decidedAt: null,
  rejectionReason: null,
};
const order = {
  id: 7,
  orderRequestId: 12,
  priceOfferId: 42,
  harvestListing: { id: 1, teaGrade: "CTC" },
  farmerProfile: { gardenName: "Tea garden", district: "Panchagarh" },
  factoryProfile: { factoryName: "Tea Works", district: "Panchagarh" },
  agreedPricePerKg: 32.5,
  estimatedQuantityKg: 125.5,
  actualCollectedWeightKg: 120.125,
  proposedCollectionDate: "2026-11-25",
  collectionPoint: "Tetulia depot",
  pickupNotes: null,
  estimatedTransportCostBdt: null,
  createdAt: "2026-01-01",
};

async function openOrder(page: Page, role: "grower" | "factory") {
  await page.waitForURL("**/" + role);
  await page.evaluate((path) => {
    history.pushState(history.state, "", path);
    dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
  }, `/${role}/orders/7`);
}
async function setup(
  page: Page,
  state: { paymentStatus: string; orderStatus: string; attempts: unknown[] },
) {
  await page.route("**/backend/orders/7", (route) =>
    route.fulfill({
      json: {
        ...order,
        orderStatus: state.orderStatus,
        paymentStatus: state.paymentStatus,
      },
    }),
  );
  await page.route(base + "/amount", (route) =>
    route.fulfill({
      json: {
        orderId: 7,
        amountBdt,
        currency: "BDT",
        paymentStatus: state.paymentStatus,
      },
    }),
  );
  await page.route(base + "/history?*", (route) =>
    state.attempts.length
      ? route.fulfill({ json: paged(state.attempts) })
      : route.fulfill({ status: 404, json: { message: "Payment not found" } }),
  );
}
const panel = (page: Page) =>
  page.getByRole("region", { name: "Payment settlement" });

test("factory validates payment, reconciles a lost response, and retries the exact key and body", async ({
  page,
}) => {
  await factoryLogin(page);
  const state = {
    paymentStatus: "PENDING",
    orderStatus: "COLLECTED",
    attempts: [] as unknown[],
  };
  await setup(page, state);
  let amountReads = 0;
  await page.route(base + "/amount", (route) => {
    amountReads++;
    return route.fulfill({
      json: {
        orderId: 7,
        amountBdt,
        currency: "BDT",
        paymentStatus: state.paymentStatus,
      },
    });
  });
  const keys: Array<string | undefined> = [];
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(base + "/attempts", async (route) => {
    keys.push(route.request().headers()["idempotency-key"]);
    expect(route.request().postDataJSON()).toEqual({
      method: "BANK_TRANSFER",
      paymentDate,
      provider: "DEMO BANK",
      reference: "TX-123",
    });
    if (keys.length === 1) {
      await held;
      return route.abort("failed");
    }
    state.paymentStatus = "SUBMITTED";
    state.attempts = [attempt];
    return route.fulfill({
      status: 201,
      json: { paymentId: 2, orderId: 7, amountBdt, currency: "BDT", attempt },
    });
  });

  await openOrder(page, "factory");
  await expect(
    panel(page).getByText(amountLabel, { exact: true }),
  ).toBeVisible();
  await expect(
    panel(page).getByText("120.125 kg", { exact: true }),
  ).toBeVisible();
  await expect(
    panel(page).getByText("No payment attempts on this page."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Complete order" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Submit payment details" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Payment method").selectOption("BANK_TRANSFER");
  await dialog.getByRole("button", { name: "Review submission" }).click();
  await expect(dialog.getByText("Enter a valid payment date.")).toBeVisible();
  await expect(
    dialog.getByText("Enter the transaction reference."),
  ).toBeVisible();
  await dialog.getByLabel("Payment date").fill(paymentDate);
  await dialog.getByLabel("Bank provider").fill(" demo bank ");
  await dialog.getByLabel("Transaction reference").fill(" tx-123 ");
  await dialog.getByRole("button", { name: "Review submission" }).click();
  await dialog.getByRole("button", { name: "Confirm submission" }).click();
  await expect(
    dialog.getByRole("button", { name: "Submitting…" }),
  ).toBeDisabled();
  release();
  await expect(
    dialog.getByRole("button", { name: "Retry same attempt" }),
  ).toBeEnabled();
  expect(amountReads).toBeGreaterThanOrEqual(2);
  await dialog.getByRole("button", { name: "Retry same attempt" }).click();
  await expect(
    panel(page).getByText("Payment details submitted."),
  ).toBeVisible();
  await expect(
    panel(page).getByRole("heading", { name: "Attempt #8" }),
  ).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
});

test("grower rejects with a reason and confirms a new attempt while preserving history", async ({
  page,
}) => {
  await growerLogin(page);
  const state = {
    paymentStatus: "SUBMITTED",
    orderStatus: "COLLECTED",
    attempts: [attempt] as unknown[],
  };
  await setup(page, state);
  let rejected: unknown;
  await page.route(base + "/attempts/8/reject", (route) => {
    expect(route.request().postDataJSON()).toEqual({
      rejectionReason: "Receipt could not be matched.",
    });
    rejected = {
      ...attempt,
      decision: "REJECTED",
      rejectionReason: "Receipt could not be matched.",
    };
    state.paymentStatus = "REJECTED";
    state.attempts = [rejected];
    return route.fulfill({ json: rejected });
  });
  await page.route(base + "/attempts/9/confirm", (route) => {
    expect(route.request().postDataJSON()).toEqual({});
    const confirmed = { ...attempt, id: 9, decision: "CONFIRMED" };
    state.paymentStatus = "CONFIRMED";
    state.attempts = [confirmed, rejected];
    return route.fulfill({ json: confirmed });
  });
  await openOrder(page, "grower");
  await expect(panel(page).getByText("FIXTURE-8")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Submit payment details" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Reject payment" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Reject payment" }).click();
  await expect(dialog.getByText(/Enter a rejection reason/)).toBeVisible();
  await dialog
    .getByLabel("Rejection reason")
    .fill(" Receipt could not be matched. ");
  await dialog.getByRole("button", { name: "Reject payment" }).click();
  await expect(
    panel(page).getByText("Receipt could not be matched."),
  ).toBeVisible();
  state.paymentStatus = "SUBMITTED";
  state.attempts = [{ ...attempt, id: 9 }, rejected];
  await page.getByRole("link", { name: "Back to my orders" }).click();
  await openOrderAfterHistory(page);
  await page.getByRole("button", { name: "Confirm receipt" }).click();
  await dialog.getByRole("button", { name: "Confirm receipt" }).click();
  await expect(panel(page).getByText("Receipt confirmed.")).toBeVisible();
  await expect(
    panel(page).getByText("Receipt could not be matched."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Complete order" }),
  ).toHaveCount(0);
});

async function openOrderAfterHistory(page: Page) {
  await page.waitForURL("**/grower/orders");
  await page.evaluate(() => {
    history.pushState(history.state, "", "/grower/orders/7");
    dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
  });
}

test("factory completes explicitly only after confirmed payment", async ({
  page,
}) => {
  await factoryLogin(page);
  const state = {
    paymentStatus: "CONFIRMED",
    orderStatus: "COLLECTED",
    attempts: [{ ...attempt, decision: "CONFIRMED" }],
  };
  await setup(page, state);
  let completed = 0;
  await page.route("**/backend/orders/7/status", (route) => {
    completed++;
    expect(route.request().postDataJSON()).toEqual({
      orderStatus: "COMPLETED",
    });
    state.orderStatus = "COMPLETED";
    return route.fulfill({
      json: {
        ...order,
        orderStatus: state.orderStatus,
        paymentStatus: state.paymentStatus,
      },
    });
  });
  await openOrder(page, "factory");
  await expect(
    page.getByRole("button", { name: "Confirm receipt" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Complete order" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText(/mark the harvest listing as sold/),
  ).toBeVisible();
  expect(completed).toBe(0);
  await dialog.getByRole("button", { name: "Complete order" }).click();
  await expect(page.getByText("Order completed.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Complete order" }),
  ).toHaveCount(0);
  expect(completed).toBe(1);
});

test("payment loading, forbidden history, and unavailable amount remain distinct", async ({
  page,
}) => {
  await factoryLogin(page);
  await setup(page, {
    paymentStatus: "PENDING",
    orderStatus: "COLLECTED",
    attempts: [],
  });
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(base + "/amount", async (route) => {
    await held;
    return route.fulfill({
      status: 409,
      json: { message: "Order has no payable amount" },
    });
  });
  await page.route(base + "/history?*", (route) =>
    route.fulfill({ status: 403, json: { message: "Forbidden" } }),
  );
  await openOrder(page, "factory");
  await expect(
    panel(page)
      .getByRole("status", { name: "Loading marketplace results" })
      .first(),
  ).toBeVisible();
  release();
  await expect(
    panel(page).getByText("Order has no payable amount"),
  ).toBeVisible();
  await expect(panel(page).getByRole("alert")).toHaveText(
    "You do not have access to these results.",
  );
  await expect(
    page.getByRole("button", { name: "Submit payment details" }),
  ).toHaveCount(0);
});
