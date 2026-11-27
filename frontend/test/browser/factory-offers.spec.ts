import { expect, test, type Page } from "@playwright/test";
import { factoryLogin, offer, paged } from "./factory-fixtures";

async function openOffers(page: Page, status = "VERIFIED") {
  await page.route("**/backend/order-requests/my?*", (route) =>
    route.fulfill({ json: paged([]) }),
  );
  await page.route(
    "**/backend/factory-profiles/me/verification-history",
    (route) => route.fulfill({ json: [] }),
  );
  await factoryLogin(page, status);
  await page.getByRole("link", { name: "Factory dashboard" }).click();
  await page.getByRole("link", { name: "Manage offers" }).click();
}

test("verified factory publishes, edits and withdraws its offer", async ({
  page,
}) => {
  let rows: (typeof offer)[] = [];
  await page.route("**/backend/offers/my?*", (route) =>
    route.fulfill({ json: paged(rows) }),
  );
  await page.route("**/backend/offers", (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toMatchObject({
      teaGrade: "CTC",
      pricePerKg: 32.5,
      validUntil: "2099-12-31",
      minimumQuantityKg: null,
    });
    rows = [offer];
    return route.fulfill({ status: 201, json: offer });
  });
  await page.route("**/backend/offers/42", (route) => {
    expect(route.request().method()).toBe("PATCH");
    expect(route.request().postDataJSON()).toEqual({ pricePerKg: 35.5 });
    rows = [{ ...offer, pricePerKg: 35.5 }];
    return route.fulfill({ json: rows[0] });
  });
  await page.route("**/backend/offers/42/withdraw", (route) => {
    expect(route.request().method()).toBe("PATCH");
    rows = [{ ...rows[0], status: "WITHDRAWN" }];
    return route.fulfill({ json: rows[0] });
  });

  await openOffers(page);
  await page.getByRole("button", { name: "New offer" }).click();
  const dialog = page.getByRole("dialog", { name: "Publish offer" });
  await dialog.getByRole("button", { name: "Publish offer" }).click();
  await expect(dialog.getByText("Enter a tea grade.")).toBeVisible();
  await dialog.getByLabel("Tea grade").fill("CTC");
  await dialog.getByLabel("Price (BDT per kg)").fill("32.5");
  await dialog.getByLabel("Valid until").fill("2000-01-01");
  await dialog.getByRole("button", { name: "Publish offer" }).click();
  await expect(
    dialog.getByText("Choose a date after today in Bangladesh."),
  ).toBeVisible();
  await dialog.getByLabel("Valid until").fill("2099-12-31");
  await dialog.getByRole("button", { name: "Publish offer" }).click();
  await expect(page.getByRole("status")).toHaveText("Offer published.");

  await page.getByRole("button", { name: "Edit offer" }).click();
  const editor = page.getByRole("dialog", { name: "Edit offer" });
  await expect(editor.getByLabel("Tea grade")).toHaveCount(0);
  await editor.getByLabel("Price (BDT per kg)").fill("35.5");
  await editor.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toHaveText("Offer updated.");
  await expect(page.getByText(/BDT\s*35\.50/)).toBeVisible();

  await page.getByRole("button", { name: "Withdraw offer" }).click();
  await page.getByRole("button", { name: "Confirm withdrawal" }).click();
  await expect(page.getByRole("status")).toHaveText("Offer withdrawn.");
  await expect(
    page.getByText("Withdrawn", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit offer" })).toHaveCount(0);
});

test("pending factory can withdraw its active offer but cannot publish or edit", async ({
  page,
}) => {
  let rows = [
    offer,
    { ...offer, id: 43, teaGrade: "Expired batch", validUntil: "2000-01-01" },
  ];
  await page.route("**/backend/offers/my?*", (route) =>
    route.fulfill({ json: paged(rows) }),
  );
  await page.route("**/backend/offers/42/withdraw", (route) => {
    rows = [{ ...offer, status: "WITHDRAWN" }, rows[1]];
    return route.fulfill({ json: rows[0] });
  });
  await openOffers(page, "PENDING");
  await expect(
    page.getByText(/Factory verification is required/),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "New offer" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit offer" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Withdraw offer" }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Withdraw offer" }).click();
  await page.getByRole("button", { name: "Confirm withdrawal" }).click();
  await expect(page.getByRole("status")).toHaveText("Offer withdrawn.");
});

test("offer editor preserves authorization errors from the backend", async ({
  page,
}) => {
  await page.route("**/backend/offers/my?*", (route) =>
    route.fulfill({ json: paged([offer]) }),
  );
  await page.route("**/backend/offers/42", (route) =>
    route.fulfill({
      status: 403,
      json: { message: "You do not own this offer" },
    }),
  );
  await openOffers(page);
  await page.getByRole("button", { name: "Edit offer" }).click();
  await page.getByLabel("Price (BDT per kg)").fill("35");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("alert")).toHaveText("You do not own this offer");
});
test("owned offer status filtering and pagination preserve expiry safety", async ({
  page,
}) => {
  await page.route("**/backend/offers/my?*", (route) => {
    const query = new URL(route.request().url()).searchParams;
    const pageNumber = Number(query.get("page") ?? 1);
    const filtered = query.get("status") === "ACTIVE";
    return route.fulfill({
      json: {
        ...paged(
          pageNumber === 1
            ? [offer]
            : [
                {
                  ...offer,
                  id: 43,
                  teaGrade: "Elapsed batch",
                  validUntil: "2000-01-01",
                },
              ],
        ),
        total: filtered ? 2 : 1,
        page: pageNumber,
        limit: 1,
        totalPages: filtered ? 2 : 1,
      },
    });
  });
  await openOffers(page);
  await page.getByLabel("Stored offer status").selectOption("ACTIVE");
  await page.getByRole("link", { name: "Next page" }).click();
  await expect(page).toHaveURL(/status=ACTIVE&page=2$/);
  const article = page
    .getByRole("article")
    .filter({ hasText: "Elapsed batch" });
  await expect(article.getByText("Expired", { exact: true })).toBeVisible();
  await expect(article.getByRole("button", { name: "Edit offer" })).toHaveCount(
    0,
  );
  await expect(
    article.getByRole("button", { name: "Withdraw offer" }),
  ).toHaveCount(0);
});
