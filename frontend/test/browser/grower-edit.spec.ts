import { expect, test } from "@playwright/test";
import { growerLogin, listing } from "./grower-fixtures";

test("validates required fields and prevents overlapping publish requests", async ({
  page,
}) => {
  let rows: (typeof listing)[] = [];
  let submissions = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/backend/listings/my", (route) =>
    route.fulfill({ json: rows }),
  );
  await page.route("**/backend/listings", async (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    expect(route.request().postDataJSON()).toEqual({
      teaGrade: listing.teaGrade,
      estimatedQuantityKg: 125.5,
      expectedHarvestDate: listing.expectedHarvestDate,
      collectionLocation: listing.collectionLocation,
    });
    submissions++;
    await pending;
    rows = [listing];
    await route.fulfill({ status: 201, json: listing });
  });
  await growerLogin(page);
  await page.getByRole("link", { name: "Grower dashboard" }).click();
  await page.getByRole("link", { name: "Post a harvest" }).click();
  await page.getByRole("button", { name: "Publish listing" }).click();
  await expect(page.getByText("Enter a tea grade.")).toBeVisible();
  expect(submissions).toBe(0);
  await page.getByLabel("Tea grade").fill(listing.teaGrade);
  await page
    .getByLabel("Estimated quantity (kg)")
    .fill(String(listing.estimatedQuantityKg));
  await page
    .getByLabel("Expected harvest date")
    .fill(listing.expectedHarvestDate);
  await page.getByLabel("Collection location").fill(listing.collectionLocation);
  await page.locator("form").evaluate((form: HTMLFormElement) => {
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect(page.getByRole("button", { name: "Saving…" })).toBeDisabled();
  await expect.poll(() => submissions).toBe(1);
  release();
  await expect(page.getByRole("status")).toHaveText("Listing published.");
  await expect(
    page.getByRole("heading", { name: "First Flush" }),
  ).toBeVisible();
  expect(submissions).toBe(1);
});

test("edits an owned active listing and shows backend validation feedback", async ({
  page,
}) => {
  let row = listing;
  let rejected = true;
  await page.route("**/backend/listings/my", (route) =>
    route.fulfill({ json: [row] }),
  );
  await page.route("**/backend/listings/1", (route) => {
    expect(route.request().method()).toBe("PATCH");
    expect(route.request().postDataJSON().teaGrade).toBe("Spring harvest");
    if (rejected)
      return route.fulfill({
        status: 400,
        json: { message: "Bad Request Payload" },
      });
    row = { ...row, teaGrade: "Spring harvest" };
    return route.fulfill({ json: row });
  });
  await growerLogin(page);
  await page.getByRole("link", { name: "My listings", exact: true }).click();
  await page.getByRole("link", { name: "First Flush" }).click();
  await page.getByRole("link", { name: "Edit listing" }).click();
  await expect(page.getByLabel("Tea grade")).toHaveValue("First Flush");
  await page.getByLabel("Tea grade").fill("Spring harvest");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("alert")).toHaveText("Bad Request Payload");
  rejected = false;
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toHaveText("Listing updated.");
  await expect(
    page.getByRole("heading", { name: "Spring harvest" }),
  ).toBeVisible();
});

test("blocks editing non-owned or reserved listings, including direct routes", async ({
  page,
}) => {
  await page.route("**/backend/listings/my", (route) =>
    route.fulfill({ json: [{ ...listing, status: "RESERVED" }] }),
  );
  let mutations = 0;
  await page.route("**/backend/listings/*", (route) => {
    if (route.request().method() === "PATCH") mutations++;
    return route.fallback();
  });
  await growerLogin(page);
  await page.getByRole("link", { name: "My listings", exact: true }).click();
  await page.getByRole("link", { name: "First Flush" }).click();
  await expect(page.getByRole("link", { name: "Edit listing" })).toHaveCount(0);
  for (const [id, error] of [
    [1, "Only active, available listings can be edited."],
    [2, "This listing is unavailable in your harvests."],
  ] as const) {
    await page.evaluate((listingId) => {
      window.history.pushState(
        {},
        "",
        "/grower/listings/" + listingId + "/edit",
      );
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, id);
    await expect(page.getByRole("alert")).toHaveText(error);
  }
  expect(mutations).toBe(0);
});
