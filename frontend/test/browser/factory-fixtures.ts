import type { Page } from "@playwright/test";
import { login, mockSession } from "./auth-fixtures";

export const profile = {
  factoryName: "Tetulia Tea Works",
  representativeName: "Factory Owner",
  district: "Panchagarh",
  upazila: "Tetulia",
};
export const offer = {
  id: 42,
  factoryProfileId: 3,
  teaGrade: "CTC",
  pricePerKg: 32.5,
  validUntil: "2099-12-31",
  status: "ACTIVE",
  notes: "Evening batches",
  minimumQuantityKg: 25,
  estimatedTransportCostBdt: 350,
  qualityRequirements: "Fresh leaves",
};
export const paged = (data: unknown[]) => ({
  data,
  total: data.length,
  page: 1,
  limit: 20,
  totalPages: data.length ? 1 : 0,
});

export async function factoryLogin(page: Page, status = "VERIFIED") {
  await mockSession(page, "FACTORY");
  await page.route("**/backend/factory-profiles/me", (route) =>
    route.fulfill({ json: { ...profile, verificationStatus: status } }),
  );
  await login(page);
  await page.waitForURL("**/factory");
}
