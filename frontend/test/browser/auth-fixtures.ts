import type { Page } from "@playwright/test";
import { Buffer } from "node:buffer";

export const email = "grower@example.test";
export const password = "test-password";
export async function mockSession(
  page: Page,
  role = "GROWER",
  expiry = Math.floor(Date.now() / 1000) + 300,
) {
  const user = { id: 1, fullName: "Test Account", email, role };
  const token =
    "header." +
    Buffer.from(JSON.stringify({ exp: expiry })).toString("base64url") +
    ".signature";
  await page.route("**/backend/auth/login", (route) =>
    route.fulfill({ json: { accessToken: token, user } }),
  );
  await page.route("**/backend/users/me", (route) =>
    route.fulfill({ json: user }),
  );
}
export async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}
