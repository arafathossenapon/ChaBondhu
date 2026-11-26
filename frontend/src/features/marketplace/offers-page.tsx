import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { pageNumber } from "./contracts";
import { isAvailable, OfferCards, useOffers } from "./offers";
import { LoadingCards, MarketError, MarketHeader, Pagination } from "./ui";

const sorts = {
  "pricePerKg:ASC": "Price: low to high",
  "pricePerKg:DESC": "Price: high to low",
  "validUntil:ASC": "Expiring soonest",
  "validUntil:DESC": "Latest expiry",
  "minimumQuantityKg:ASC": "Minimum quantity: low to high",
  "minimumQuantityKg:DESC": "Minimum quantity: high to low",
  "createdAt:DESC": "Newest offers",
  "createdAt:ASC": "Oldest offers",
};

function priceBound(value: string) {
  return (
    value === "" ||
    (/^\d+(\.\d{1,2})?$/.test(value) && Number(value) <= 9999999999.99)
  );
}

export function OffersPage() {
  const [params, setParams] = useSearchParams();
  const [validation, setValidation] = useState("");
  const teaGrade = params.get("teaGrade")?.trim().slice(0, 100) || undefined;
  const minPrice = params.get("minPrice") || "";
  const maxPrice = params.get("maxPrice") || "";
  const rawSort =
    (params.get("sortBy") || "") + ":" + (params.get("sortOrder") || "");
  const sort = Object.hasOwn(sorts, rawSort) ? rawSort : "pricePerKg:DESC";
  const [sortBy, sortOrder] = sort.split(":");
  const page = pageNumber(params.get("page"));
  const valid =
    priceBound(minPrice) &&
    priceBound(maxPrice) &&
    (!minPrice || !maxPrice || Number(minPrice) <= Number(maxPrice));
  const offers = useOffers({
    teaGrade,
    minPrice: valid ? minPrice || undefined : undefined,
    maxPrice: valid ? maxPrice || undefined : undefined,
    sortBy,
    sortOrder,
    page,
  });

  return (
    <>
      <MarketHeader
        title="Compare factory offers"
        description="Explore current buying prices by tea grade across verified factory publications."
      />
      <section className="site-width market-content" aria-label="Offer results">
        <form
          key={params.toString()}
          className="market-filters"
          onSubmit={(event) => {
            event.preventDefault();
            const values = new FormData(event.currentTarget);
            const low = String(values.get("minPrice") ?? "").trim();
            const high = String(values.get("maxPrice") ?? "").trim();
            if (
              !priceBound(low) ||
              !priceBound(high) ||
              (low && high && Number(low) > Number(high))
            ) {
              setValidation(
                "Enter prices with up to two decimal places and a minimum no greater than the maximum.",
              );
              return;
            }
            setValidation("");
            const [field, order] = String(values.get("sort")).split(":");
            const next = new URLSearchParams({
              sortBy: field,
              sortOrder: order,
            });
            const grade = String(values.get("teaGrade") ?? "").trim();
            if (grade) next.set("teaGrade", grade);
            if (low) next.set("minPrice", low);
            if (high) next.set("maxPrice", high);
            setParams(next);
          }}
        >
          <label>
            Tea grade
            <input
              name="teaGrade"
              maxLength={100}
              defaultValue={teaGrade}
              placeholder="Exact grade, e.g. CTC"
            />
          </label>
          <label>
            Min BDT / kg
            <input
              name="minPrice"
              inputMode="decimal"
              defaultValue={minPrice}
            />
          </label>
          <label>
            Max BDT / kg
            <input
              name="maxPrice"
              inputMode="decimal"
              defaultValue={maxPrice}
            />
          </label>
          <label>
            Sort offers
            <select name="sort" defaultValue={sort}>
              {Object.entries(sorts).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button className="button button-green">Apply filters</button>
          <Link
            className="button button-outline"
            onClick={() => setValidation("")}
            to="/marketplace/offers"
          >
            Clear filters
          </Link>
        </form>
        {(validation || !valid) && (
          <p role="alert" className="field-error">
            {validation ||
              "The URL contains an invalid price range. Update the filters. Results exclude that range."}
          </p>
        )}
        <div className="market-toolbar">
          <p aria-live="polite">
            {offers.data
              ? offers.data.total +
                (offers.data.total === 1 ? " offer" : " offers")
              : "Current offers"}
          </p>
          <button
            type="button"
            className="button button-outline"
            disabled={offers.isFetching}
            onClick={() => void offers.refetch()}
          >
            Refresh
          </button>
        </div>
        {offers.isPending ? (
          <LoadingCards />
        ) : offers.isError ? (
          <MarketError
            error={offers.error}
            retry={() => void offers.refetch()}
          />
        ) : (
          <>
            <OfferCards offers={offers.data.data.filter(isAvailable)} />
            <Pagination
              page={offers.data.page}
              totalPages={offers.data.totalPages}
              to={(page) => {
                const query = new URLSearchParams(params);
                query.set("page", String(page));
                return "/marketplace/offers?" + query;
              }}
            />
          </>
        )}
      </section>
    </>
  );
}
