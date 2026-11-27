import { expect, test } from "@playwright/test";
import { factoryLogin, offer, paged } from "./factory-fixtures";

test("factory overview displays rejected verification, review history and real recent summaries", async ({
  page,
}) => {
  let finish!: () => void;
  const history = new Promise<void>((resolve) => {
    finish = resolve;
  });
  await page.route(
    "**/backend/factory-profiles/me/verification-history",
    async (route) => {
      await history;
      return route.fulfill({
        json: [{ decision: "REJECTED", reason: "Confirm district address" }],
      });
    },
  );
  await page.route("**/backend/offers/my?*", (route) =>
    route.fulfill({ json: paged([offer]) }),
  );
  await page.route("**/backend/order-requests/my?*", (route) =>
    route.fulfill({
      json: paged([
        {
          id: 1,
          status: "PENDING",
          quotedPricePerKg: 27,
          harvestListing: { id: 2, teaGrade: "First Flush" },
        },
      ]),
    }),
  );
  await factoryLogin(page, "REJECTED");
  await page.getByRole("link", { name: "Factory dashboard" }).click();
  await expect(page.getByText("Loading verification history…")).toBeVisible();
  finish();
  await expect(
    page.getByText(
      "Verification was rejected. Reason: Confirm district address",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Update profile or resubmit" }),
  ).toHaveAttribute("href", "/factory");
  await expect(
    page.getByRole("heading", { name: "Verification history" }),
  ).toBeVisible();
  await expect(page.getByText(/CTC.*BDT/)).toBeVisible();
  await expect(page.getByText(/First Flush.*BDT/)).toBeVisible();
  await page.getByRole("link", { name: "Manage offers" }).click();
  await page.getByText("Offer details", { exact: true }).click();
  await expect(page.getByText("Evening batches")).toBeVisible();
});

test("factory dashboard handles review errors and empty procurement", async ({
  page,
}) => {
  let blocked = true;
  await page.route(
    "**/backend/factory-profiles/me/verification-history",
    (route) =>
      blocked
        ? route.fulfill({ status: 403, json: { message: "Forbidden" } })
        : route.fulfill({ json: [] }),
  );
  await page.route("**/backend/offers/my?*", (route) =>
    route.fulfill({ json: paged([]) }),
  );
  await page.route("**/backend/order-requests/my?*", (route) =>
    route.fulfill({ json: paged([]) }),
  );
  await factoryLogin(page, "PENDING");
  await page.getByRole("link", { name: "Factory dashboard" }).click();
  await expect(page.getByText(/Verification is pending/)).toBeVisible();
  await expect(page.getByRole("alert")).toHaveText(
    "You do not have access to these results.",
  );
  blocked = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("No verification decisions yet.")).toBeVisible();
  await expect(page.getByText("No procurement requests yet.")).toBeVisible();
});
