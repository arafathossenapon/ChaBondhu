import { expect, test } from "@playwright/test";
import { growerLogin, listing } from "./grower-fixtures";

test("owner can keep or confirm withdrawal and sees the returned status", async ({
  page,
}) => {
  let row = listing;
  let mutations = 0;
  let reads = 0;
  await page.route("**/backend/listings/my", (route) => {
    reads++;
    return route.fulfill({ json: [row] });
  });
  await page.route("**/backend/listings/1/cancel", (route) => {
    expect(route.request().method()).toBe("PATCH");
    expect(route.request().postData()).toBeNull();
    mutations++;
    row = { ...row, status: "CANCELLED" };
    return route.fulfill({ json: row });
  });
  await growerLogin(page);
  await page.getByRole("link", { name: "My listings", exact: true }).click();
  await page.getByRole("link", { name: "First Flush" }).click();
  const trigger = page.getByRole("button", { name: "Withdraw listing" });
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "Withdraw harvest listing?",
  });
  await expect(dialog).toContainText("closes any pending requests");
  await dialog.getByRole("button", { name: "Keep listing" }).click();
  await expect(dialog).toBeHidden();
  expect(mutations).toBe(0);
  const before = reads;
  await trigger.click();
  await dialog.getByRole("button", { name: "Confirm withdrawal" }).click();
  await expect(page.getByRole("status")).toHaveText("Listing withdrawn.");
  await expect(page.getByText("Withdrawn", { exact: true })).toBeVisible();
  await expect(trigger).toHaveCount(0);
  await expect.poll(() => reads).toBeGreaterThan(before);
  expect(mutations).toBe(1);
});

test("a reservation conflict refreshes the status and removes the withdrawal action", async ({
  page,
}) => {
  let row = listing;
  await page.route("**/backend/listings/my", (route) =>
    route.fulfill({ json: [row] }),
  );
  await page.route("**/backend/listings/1/cancel", (route) => {
    row = { ...row, status: "RESERVED" };
    return route.fulfill({
      status: 409,
      json: { message: "Cannot cancel a reserved or sold listing" },
    });
  });
  await growerLogin(page);
  await page.getByRole("link", { name: "My listings", exact: true }).click();
  await page.getByRole("link", { name: "First Flush" }).click();
  await page.getByRole("button", { name: "Withdraw listing" }).click();
  const dialog = page.getByRole("dialog");
  const confirm = dialog.getByRole("button", { name: "Confirm withdrawal" });
  await confirm.click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Cannot cancel a reserved or sold listing",
  );
  await expect(confirm).toBeDisabled();
  await dialog.getByRole("button", { name: "Keep listing" }).click();
  await expect(page.getByText("Reserved", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Withdraw listing" }),
  ).toHaveCount(0);
});
