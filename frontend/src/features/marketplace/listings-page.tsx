import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";
import { useSession } from "../auth/session-context";
import { pageNumber, type Listing, type ListingPage } from "./contracts";
import {
  day,
  kg,
  LoadingCards,
  MarketError,
  MarketHeader,
  Pagination,
  Status,
} from "./ui";

function ListingCard({ listing }: { listing: Listing }) {
  return (
    <article className="market-card listing-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2>
          <Link to={"/marketplace/listings/" + listing.id}>
            {listing.teaGrade}
          </Link>
        </h2>
        <Status status={listing.isActive ? listing.status : "Unavailable"} />
      </div>
      {listing.farmerProfile && (
        <p className="text-sm">
          {listing.farmerProfile.gardenName} · {listing.farmerProfile.district}
        </p>
      )}
      <dl className="market-facts">
        <div>
          <dt>Estimated harvest</dt>
          <dd>{kg(listing.estimatedQuantityKg)}</dd>
        </div>
        <div>
          <dt>Expected harvest</dt>
          <dd>{day(listing.expectedHarvestDate)}</dd>
        </div>
        <div>
          <dt>Collection location</dt>
          <dd>{listing.collectionLocation}</dd>
        </div>
      </dl>
    </article>
  );
}

export function ListingsPage({ own = false }: { own?: boolean }) {
  const { request, session } = useSession();
  const [params, setParams] = useSearchParams();
  const teaGrade = params.get("teaGrade")?.trim() || undefined;
  const district = params.get("district")?.trim() || undefined;
  const page = pageNumber(params.get("page"));
  const results = useQuery({
    queryKey: [
      "marketplace",
      session?.account.id,
      own ? "own-listings" : "listings",
      ...(own ? [] : [teaGrade, district, page]),
    ],
    queryFn: async ({ signal }) => {
      if (own) {
        const data = await request<Listing[]>("/listings/my", { signal });
        return { data, total: data.length, page: 1, limit: data.length || 1 };
      }
      return request<ListingPage>("/listings", {
        query: { teaGrade, district, page },
        signal,
      });
    },
  });

  return (
    <>
      <MarketHeader
        title={own ? "My listings" : "Discover tea harvests"}
        description={
          own
            ? "Review your harvest listings and their current status."
            : "Find available tea harvests by grade and district."
        }
      />
      <section
        className="site-width market-content"
        aria-label="Harvest results"
      >
        {!own && (
          <form
            key={params.toString()}
            className="market-filters"
            onSubmit={(event) => {
              event.preventDefault();
              const values = new FormData(event.currentTarget);
              const next = new URLSearchParams();
              for (const field of ["teaGrade", "district"]) {
                const value = String(values.get(field) ?? "").trim();
                if (value) next.set(field, value);
              }
              setParams(next);
            }}
          >
            <label>
              Tea grade
              <input
                name="teaGrade"
                defaultValue={teaGrade}
                placeholder="e.g. CTC"
              />
            </label>
            <label>
              District
              <input
                name="district"
                defaultValue={district}
                placeholder="e.g. Panchagarh"
              />
            </label>
            <button className="button button-green">Search harvests</button>
            {(teaGrade || district) && (
              <Link
                className="button button-outline"
                to="/marketplace/listings"
              >
                Clear filters
              </Link>
            )}
          </form>
        )}
        <div className="market-toolbar">
          <p aria-live="polite">
            {results.data
              ? results.data.total +
                (results.data.total === 1 ? " listing" : " listings")
              : "Harvest listings"}
          </p>
          <button
            type="button"
            className="button button-outline"
            disabled={results.isFetching}
            onClick={() => void results.refetch()}
          >
            Refresh
          </button>
        </div>
        {results.isPending ? (
          <LoadingCards />
        ) : results.isError ? (
          <MarketError
            error={results.error}
            retry={() => void results.refetch()}
          />
        ) : (
          <>
            {results.data.data.length > 0 ? (
              <div className="market-grid">
                {results.data.data.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            ) : (
              <div className="market-card">
                <h2>No listings found</h2>
                <p>
                  {own
                    ? "Your harvest listings will appear here."
                    : "Try a different tea grade or district."}
                </p>
              </div>
            )}
            {!own && (
              <Pagination
                page={results.data.page}
                totalPages={Math.ceil(results.data.total / results.data.limit)}
                to={(next) => {
                  const query = new URLSearchParams(params);
                  query.set("page", String(next));
                  return "/marketplace/listings?" + query;
                }}
              />
            )}
          </>
        )}
      </section>
    </>
  );
}

export function OwnListingsPage() {
  return <ListingsPage own />;
}
