import { expect, test } from "@playwright/test";
import { email, login, mockSession, password } from "./auth-fixtures";

test("validates registration, handles duplicate email and confirms account creation", async ({
  page,
}) => {
  await page.goto("/register");
  const submit = page.getByRole("button", { name: "Create account" });
  await submit.click();
  await expect(page.getByText("Use at least eight characters.")).toBeVisible();
  await expect(page.getByLabel("Full name")).toBeFocused();
  const account = {
    fullName: "Tea Grower",
    email,
    password,
    phoneNumber: "01700123456",
    role: "GROWER",
  };
  let submissions = 0;
  await page.route("**/backend/auth/register", (route) => {
    expect(route.request().postDataJSON()).toEqual(account);
    submissions++;
    return submissions === 1
      ? route.fulfill({
          status: 409,
          json: { message: "Email is already registered" },
        })
      : route.fulfill({ status: 201, json: { id: 1 } });
  });
  await page.getByLabel("Full name").fill(account.fullName);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByLabel("Phone number").fill(account.phoneNumber);
  await page.getByLabel("Account type").selectOption("GROWER");
  await submit.click();
  await expect(page.getByText("Email is already registered")).toBeVisible();
  await submit.click();
  await expect(page.getByRole("status")).toHaveText(
    "Account created. Sign in to continue.",
  );
  await expect(page.getByLabel("Email address")).toHaveValue(email);
});

test("shows incorrect credentials without creating a session", async ({
  page,
}) => {
  await page.route("**/backend/auth/login", (route) =>
    route.fulfill({
      status: 401,
      json: { message: "Incorrect email or password" },
    }),
  );
  await login(page);
  await expect(page.getByRole("alert")).toHaveText(
    "Incorrect email or password",
  );
  await expect(page).toHaveURL(/\/login$/);
});

test("routes an admin, preserves session for SPA navigation and clears it on sign-out", async ({
  page,
}) => {
  await mockSession(page, "ADMIN");
  await login(page);
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("link", { name: "ChaBondhu home" }).first().click();
  await page.getByRole("link", { name: "My account" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("status")).toHaveText("You signed out.");
});

test("protects anonymous routes and requires login after a reload", async ({
  page,
}) => {
  await page.goto("/factory");
  await expect(page).toHaveURL(/\/login$/);
  await mockSession(page, "ADMIN");
  await login(page);
  await expect(page).toHaveURL(/\/admin$/);
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
});

test("rejects an expired token before opening a protected route", async ({
  page,
}) => {
  await mockSession(page, "GROWER", Math.floor(Date.now() / 1000) - 10);
  await login(page);
  await expect(page.getByRole("alert")).toHaveText(
    "The server returned an expired or invalid session.",
  );
});
