import type { Page } from "@playwright/test";
import { login, mockSession } from "./auth-fixtures";
import type { Listing } from "../../src/features/marketplace/contracts";

export const listing: Listing = {
  id: 1,
  teaGrade: "First Flush",
  estimatedQuantityKg: 125.5,
  expectedHarvestDate: "2099-03-20",
  collectionLocation: "Tetulia collection point",
  status: "ACTIVE",
  isActive: true,
};

export async function growerLogin(page: Page) {
  await mockSession(page);
  await page.route("**/backend/farmer-profiles/me", (route) =>
    route.fulfill({
      json: {
        gardenName: "Tea garden",
        division: "Rangpur",
        district: "Panchagarh",
        upazila: "Tetulia",
      },
    }),
  );
  await login(page);
}
