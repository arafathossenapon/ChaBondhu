import { expect, test } from "@playwright/test";
import { login, mockSession } from "./auth-fixtures";

const grower = {
  gardenName: "Tea Hill",
  division: "Rangpur",
  district: "Panchagarh",
  upazila: "Tetulia",
};
const factory = {
  factoryName: "Tea Works",
  representativeName: "Factory Owner",
  district: "Panchagarh",
  upazila: "Tetulia",
};

test("a grower completes a missing profile and cannot open the factory area", async ({
  page,
}) => {
  await mockSession(page);
  await page.route("**/backend/farmer-profiles/me", (route) => {
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    return route.fulfill({
      status: 404,
      json: { message: "Farmer profile not found" },
    });
  });
  await page.route("**/backend/farmer-profiles", (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toEqual(grower);
    return route.fulfill({ status: 201, json: grower });
  });
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Complete your profile" }),
  ).toBeVisible();
  await page.getByLabel("Garden name").fill(grower.gardenName);
  await page.getByLabel("Division").fill(grower.division);
  await page.getByLabel("District").fill(grower.district);
  await page.getByLabel("Upazila").fill(grower.upazila);
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(
    page.getByRole("heading", { name: "Profile complete" }),
  ).toBeVisible();
  await page.evaluate(() => {
    window.history.pushState({}, "", "/factory");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page).toHaveURL(/\/grower$/);
  await expect(
    page.getByRole("heading", { name: "Grower profile" }),
  ).toBeVisible();
});

test("a factory completes its profile and sees the pending review state", async ({
  page,
}) => {
  await mockSession(page, "FACTORY");
  await page.route("**/backend/factory-profiles/me", (route) =>
    route.fulfill({
      status: 404,
      json: { message: "Factory profile not found" },
    }),
  );
  await page.route("**/backend/factory-profiles", (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toEqual(factory);
    return route.fulfill({
      status: 201,
      json: { ...factory, verificationStatus: "PENDING" },
    });
  });
  await login(page);
  await page.getByLabel("Factory name").fill(factory.factoryName);
  await page.getByLabel("Representative name").fill(factory.representativeName);
  await page.getByLabel("District").fill(factory.district);
  await page.getByLabel("Upazila").fill(factory.upazila);
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(
    page.getByRole("heading", { name: "Profile complete" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      /Offer publishing and procurement requests remain unavailable while/,
    ),
  ).toBeVisible();
});

test("shows an approved factory as verified", async ({ page }) => {
  await mockSession(page, "FACTORY");
  await page.route("**/backend/factory-profiles/me", (route) =>
    route.fulfill({ json: { ...factory, verificationStatus: "VERIFIED" } }),
  );
  await login(page);
  await expect(
    page.getByText(/Your factory profile was approved/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Resubmit for review" }),
  ).toHaveCount(0);
});

test("shows the owner rejection reason, edits the profile and resubmits for review", async ({
  page,
}) => {
  await mockSession(page, "FACTORY");
  let details = factory;
  await page.route("**/backend/factory-profiles/me", (route) => {
    if (route.request().method() === "PATCH")
      details = route.request().postDataJSON();
    return route.fulfill({
      json: { ...details, verificationStatus: "REJECTED" },
    });
  });
  await page.route(
    "**/backend/factory-profiles/me/verification-history",
    (route) =>
      route.fulfill({
        json: [{ decision: "REJECTED", reason: "Confirm the district." }],
      }),
  );
  await page.route(
    "**/backend/factory-profiles/me/resubmit-verification",
    (route) => {
      expect(route.request().method()).toBe("PATCH");
      expect(details.district).toBe("Thakurgaon");
      return route.fulfill({
        json: { ...details, verificationStatus: "PENDING" },
      });
    },
  );
  await login(page);
  await expect(page.getByText("Reason: Confirm the district.")).toBeVisible();
  await page.getByRole("button", { name: "Edit profile" }).click();
  await page.getByLabel("District").fill("Thakurgaon");
  await page.getByRole("button", { name: "Save profile" }).click();
  await page.getByRole("button", { name: "Resubmit for review" }).click();
  await expect(
    page.getByText("Your profile was resubmitted for review."),
  ).toBeVisible();
  await expect(
    page.getByText(/while your profile is under review/),
  ).toBeVisible();
});

test("a protected API 401 clears the active session", async ({ page }) => {
  await mockSession(page);
  await page.route("**/backend/farmer-profiles/me", (route) =>
    route.fulfill({
      status: 401,
      json: { message: "Unauthorized" },
    }),
  );
  await login(page);
  await expect(page.getByRole("status")).toHaveText(
    "Your session ended. Sign in again.",
  );
  await expect(page).toHaveURL(/\/login$/);
});
