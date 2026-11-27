import { Link, NavLink, Outlet, useSearchParams } from "react-router";
import { pageNumber, type Listing } from "../marketplace/contracts";
import {
  day,
  kg,
  LoadingCards,
  MarketError,
  Pagination,
  Status,
} from "../marketplace/ui";
import { listingState, useGrowerListings } from "./listings";

const states = [
  ["ACTIVE", "Active"],
  ["RESERVED", "Reserved"],
  ["SOLD", "Sold"],
  ["EXPIRED", "Expired"],
  ["Withdrawn", "Withdrawn"],
  ["Unavailable", "Unavailable"],
] as const;

export function GrowerWorkspace() {
  return (
    <div className="site-width grower-workspace">
      <nav className="grower-nav" aria-label="Grower dashboard">
        <NavLink end to="/grower/dashboard">
          Overview
        </NavLink>
        <NavLink to="/grower/listings">My listings</NavLink>
        <NavLink to="/grower/requests">Incoming requests</NavLink>
        <NavLink end to="/grower">
          Grower profile
        </NavLink>
      </nav>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}

export function ListingCollection({ entries }: { entries: Listing[] }) {
  return (
    <ul className="grower-lists">
      {entries.map((listing) => (
        <li key={listing.id} className="market-card grower-listing">
          <div>
            <h3 className="text-lg font-semibold">
              <Link
                className="text-tea underline-offset-4 hover:underline"
                to={"/grower/listings/" + listing.id}
              >
                {listing.teaGrade}
              </Link>
            </h3>
            <p className="text-sm break-words">{listing.collectionLocation}</p>
          </div>
          <p className="text-sm">
            <strong>{kg(listing.estimatedQuantityKg)}</strong> ·{" "}
            {day(listing.expectedHarvestDate)}
          </p>
          <Status status={listingState(listing)} />
        </li>
      ))}
    </ul>
  );
}

export function Dashboard() {
  const listings = useGrowerListings();
  return (
    <>
      <header className="grower-heading">
        <h1>Grower dashboard</h1>
        <p>
          Review your harvest listings and see what’s available, reserved, or
          sold.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link className="button button-leaf" to="/grower/listings/new">
            Post a harvest
          </Link>
          <Link className="button hero-secondary" to="/grower/listings">
            Manage listings
          </Link>
          <Link className="button hero-secondary" to="/marketplace/listings">
            Browse marketplace
          </Link>
        </div>
      </header>
      <section className="grower-section" aria-labelledby="listing-summary">
        <div className="market-toolbar">
          <h2 id="listing-summary">Listing overview</h2>
          <button
            className="button button-outline"
            disabled={listings.isFetching}
            onClick={() => void listings.refetch()}
          >
            Refresh
          </button>
        </div>
        {listings.isPending ? (
          <LoadingCards />
        ) : listings.isError ? (
          <MarketError
            error={listings.error}
            retry={() => void listings.refetch()}
          />
        ) : (
          <>
            <dl className="grower-metrics">
              <div>
                <dt>Total listings</dt>
                <dd>{listings.data.length}</dd>
              </div>
              {states.map(([state, name]) => (
                <div key={state}>
                  <dt>{name}</dt>
                  <dd>
                    {
                      listings.data.filter(
                        (listing) => listingState(listing) === state,
                      ).length
                    }
                  </dd>
                </div>
              ))}
            </dl>
            <div className="space-y-3">
              <h2>Recently posted</h2>
              {listings.data.length > 0 ? (
                <ListingCollection entries={listings.data.slice(0, 3)} />
              ) : (
                <p className="market-card">
                  You haven’t posted any harvests yet.
                </p>
              )}
            </div>
          </>
        )}
      </section>
    </>
  );
}

export function ManageListings() {
  const listings = useGrowerListings();
  const [search] = useSearchParams();
  const pageSize = 8;
  const count = listings.data?.length ?? 0;
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const page = Math.min(pageNumber(search.get("page")), pages);
  return (
    <>
      <header className="grower-heading">
        <h1>My listings</h1>
        <p>View your harvest details and track marketplace status.</p>
        <Link className="button button-leaf" to="/grower/listings/new">
          Post a harvest
        </Link>
      </header>
      <section className="grower-section" aria-label="Your harvest listings">
        <div className="market-toolbar">
          <p aria-live="polite">
            {listings.isSuccess
              ? `${count} ${count === 1 ? "listing" : "listings"}`
              : "Harvest listings"}
          </p>
          <button
            className="button button-outline"
            disabled={listings.isFetching}
            onClick={() => void listings.refetch()}
          >
            Refresh
          </button>
        </div>
        {listings.isPending ? (
          <LoadingCards />
        ) : listings.isError ? (
          <MarketError
            error={listings.error}
            retry={() => void listings.refetch()}
          />
        ) : count === 0 ? (
          <div className="market-card">
            <h2>No listings yet</h2>
            <p>Your harvest listings will appear here.</p>
          </div>
        ) : (
          <>
            <ListingCollection
              entries={listings.data.slice(
                (page - 1) * pageSize,
                page * pageSize,
              )}
            />
            <Pagination
              page={page}
              totalPages={pages}
              to={(next) => "/grower/listings?page=" + next}
            />
          </>
        )}
      </section>
    </>
  );
}
