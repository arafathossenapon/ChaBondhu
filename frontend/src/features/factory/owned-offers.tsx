import { Link, useSearchParams } from "react-router";
import { pageNumber } from "../marketplace/contracts";
import { bdt, isAvailable } from "../marketplace/offers";
import {
  day,
  kg,
  LoadingCards,
  MarketError,
  Pagination,
  Status,
} from "../marketplace/ui";
import { useOwnProfile } from "../profiles/own-profile";
import { type OwnedOffer, useOwnedOffers } from "./data";

const statuses = ["ACTIVE", "EXPIRED", "WITHDRAWN"] as const;

function OfferDetails({ offer }: { offer: OwnedOffer }) {
  return (
    <article className="market-card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">{offer.teaGrade}</h3>
        <Status
          status={
            offer.status === "ACTIVE" && !isAvailable(offer)
              ? "EXPIRED"
              : offer.status
          }
        />
      </div>
      <p className="offer-price">
        {bdt(offer.pricePerKg)} <span>/ kg</span>
      </p>
      <p>Valid through {day(offer.validUntil)} · Bangladesh time</p>
      <details>
        <summary className="cursor-pointer font-semibold text-tea">
          Offer details
        </summary>
        <dl className="market-facts">
          <div>
            <dt>Minimum quantity</dt>
            <dd>
              {offer.minimumQuantityKg === null
                ? "None specified"
                : kg(offer.minimumQuantityKg)}
            </dd>
          </div>
          <div>
            <dt>Estimated transport</dt>
            <dd>
              {offer.estimatedTransportCostBdt === null
                ? "None specified"
                : bdt(offer.estimatedTransportCostBdt)}
            </dd>
          </div>
          {offer.qualityRequirements && (
            <div>
              <dt>Quality requirements</dt>
              <dd>{offer.qualityRequirements}</dd>
            </div>
          )}
          {offer.notes && (
            <div>
              <dt>Notes</dt>
              <dd>{offer.notes}</dd>
            </div>
          )}
        </dl>
      </details>
    </article>
  );
}

export function OwnedOffersPage() {
  const profile = useOwnProfile("factory");
  const [search, setSearch] = useSearchParams();
  const status = statuses.find((value) => value === search.get("status"));
  const offers = useOwnedOffers(
    { page: pageNumber(search.get("page")), status },
    !!profile.data,
  );
  return (
    <>
      <header className="grower-heading">
        <h1>My offers</h1>
        <p>Review the offers published by your factory.</p>
      </header>
      <section className="grower-section" aria-label="Factory-owned offers">
        {profile.isPending ? (
          <LoadingCards />
        ) : profile.isError ? (
          <MarketError
            error={profile.error}
            retry={() => void profile.refetch()}
          />
        ) : !profile.data ? (
          <div className="market-card">
            <p>Create a factory profile to use offer management.</p>
            <Link className="button button-green mt-3" to="/factory">
              Set up factory profile
            </Link>
          </div>
        ) : (
          <>
            <div className="market-filters">
              <label>
                Offer status
                <select
                  value={status ?? ""}
                  onChange={(event) =>
                    setSearch(
                      event.target.value ? { status: event.target.value } : {},
                    )
                  }
                >
                  <option value="">All statuses</option>
                  {statuses.map((value) => (
                    <option key={value} value={value}>
                      {value.toLowerCase()}
                    </option>
                  ))}
                </select>
              </label>
              <button
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
                {offers.data.data.length ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {offers.data.data.map((offer) => (
                      <OfferDetails key={offer.id} offer={offer} />
                    ))}
                  </div>
                ) : (
                  <p className="market-card">No offers found for this view.</p>
                )}
                <Pagination
                  page={offers.data.page}
                  totalPages={offers.data.totalPages}
                  to={(page) =>
                    "/factory/offers?" +
                    new URLSearchParams({
                      ...(status ? { status } : {}),
                      page: String(page),
                    })
                  }
                />
              </>
            )}
          </>
        )}
      </section>
    </>
  );
}
