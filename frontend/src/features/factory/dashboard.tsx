import { useQuery } from "@tanstack/react-query";
import { Link, NavLink, Outlet } from "react-router";
import { useSession } from "../auth/session-context";
import { bdt, isAvailable } from "../marketplace/offers";
import { LoadingCards, MarketError, Status } from "../marketplace/ui";
import { profileKey, useOwnProfile } from "../profiles/own-profile";
import { reviewHistory } from "../profiles/profile-contracts";
import { useOwnedOffers, useRecentRequests } from "./data";

export function FactoryWorkspace() {
  return (
    <div className="site-width grower-workspace">
      <nav className="grower-nav" aria-label="Factory workspace">
        <NavLink end to="/factory/dashboard">
          Overview
        </NavLink>
        <NavLink to="/factory/offers">My offers</NavLink>
        <NavLink end to="/factory">
          Factory profile
        </NavLink>
      </nav>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}

export function FactoryDashboard() {
  const { session, request } = useSession();
  const profile = useOwnProfile("factory");
  const reviews = useQuery({
    queryKey: [...profileKey(session?.account.id, "factory"), "reviews"],
    enabled: !!profile.data,
    queryFn: async ({ signal }) =>
      reviewHistory.parse(
        await request("/factory-profiles/me/verification-history", { signal }),
      ),
  });
  const offers = useOwnedOffers(
    { status: "ACTIVE", page: 1, limit: 4 },
    !!profile.data,
  );
  const requests = useRecentRequests();
  const status = profile.data?.status;
  const rejection = reviews.data?.find(
    (entry) => entry.decision === "REJECTED",
  )?.reason;
  const active = offers.data?.data.filter(isAvailable) ?? [];

  return (
    <>
      <header className="grower-heading">
        <h1>Factory dashboard</h1>
        <p>
          Review your verification, buying offers and recent procurement
          requests.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link className="button button-leaf" to="/factory/offers">
            Manage offers
          </Link>
          <Link className="button hero-secondary" to="/marketplace/listings">
            Browse harvests
          </Link>
        </div>
      </header>
      <section className="grower-section" aria-labelledby="factory-summary">
        <h2 id="factory-summary">Factory profile</h2>
        {profile.isPending ? (
          <LoadingCards />
        ) : profile.isError ? (
          <MarketError
            error={profile.error}
            retry={() => void profile.refetch()}
          />
        ) : !profile.data ? (
          <div className="market-card space-y-3">
            <p>Complete your factory profile before publishing offers.</p>
            <Link className="button button-green" to="/factory">
              Set up factory profile
            </Link>
          </div>
        ) : (
          <div className="market-card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold">
                {profile.data.details.factoryName}
              </h3>
              {status && <Status status={status} />}
            </div>
            <p>
              {profile.data.details.representativeName} ·{" "}
              {profile.data.details.upazila}, {profile.data.details.district}
            </p>
            {status === "PENDING" && (
              <p>
                Verification is pending. Publishing and editing offers are
                available after approval.
              </p>
            )}
            {status === "VERIFIED" && (
              <p>
                Your factory is verified and can publish and edit eligible
                offers.
              </p>
            )}
            {status === "REJECTED" && (
              <div className="space-y-2">
                <p>
                  Verification was rejected.
                  {rejection && " Reason: " + rejection}
                </p>
                <Link className="button button-outline" to="/factory">
                  Update profile or resubmit
                </Link>
              </div>
            )}
            <h3 className="font-semibold">Verification history</h3>
            {reviews.isPending ? (
              <p role="status">Loading verification history…</p>
            ) : reviews.isError ? (
              <MarketError
                error={reviews.error}
                retry={() => void reviews.refetch()}
              />
            ) : reviews.data.length ? (
              <ol className="space-y-2">
                {reviews.data.map((entry, index) => (
                  <li key={index}>
                    <Status status={entry.decision} />
                    {entry.reason && (
                      <span className="ml-2">{entry.reason}</span>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p>No verification decisions yet.</p>
            )}
          </div>
        )}
      </section>
      {profile.data && (
        <section className="grower-section" aria-labelledby="active-offers">
          <h2 id="active-offers">Recent active offers</h2>
          {offers.isPending ? (
            <LoadingCards />
          ) : offers.isError ? (
            <MarketError
              error={offers.error}
              retry={() => void offers.refetch()}
            />
          ) : active.length ? (
            <ul className="market-card space-y-3">
              {active.map((offer) => (
                <li key={offer.id}>
                  <strong>{offer.teaGrade}</strong> · {bdt(offer.pricePerKg)} /
                  kg
                </li>
              ))}
            </ul>
          ) : (
            <p className="market-card">
              No currently available offers in the latest results.
            </p>
          )}
        </section>
      )}
      <section className="grower-section" aria-labelledby="recent-requests">
        <h2 id="recent-requests">Recent procurement requests</h2>
        {requests.isPending ? (
          <LoadingCards />
        ) : requests.isError ? (
          <MarketError
            error={requests.error}
            retry={() => void requests.refetch()}
          />
        ) : requests.data.data.length ? (
          <ul className="market-card space-y-3">
            {requests.data.data.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <span>
                  {entry.harvestListing.teaGrade} ·{" "}
                  {bdt(entry.quotedPricePerKg)} / kg
                </span>
                <Status status={entry.status} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="market-card">No procurement requests yet.</p>
        )}
      </section>
    </>
  );
}
