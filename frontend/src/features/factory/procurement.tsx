import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";
import { useSession } from "../auth/session-context";
import { pageNumber, type ListingPage } from "../marketplace/contracts";
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

export function ProcurementPage() {
  const profile = useOwnProfile("factory");

  return (
    <>
      <header className="grower-heading">
        <h1>Procurement workspace</h1>
        <p>
          Review harvests and buying prices, then check which listings match one
          of your active offers.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link className="button button-leaf" to="/marketplace/listings">
            Browse harvest listings
          </Link>
          <Link className="button hero-secondary" to="/marketplace/offers">
            Compare price offers
          </Link>
        </div>
      </header>
      <section className="grower-section" aria-labelledby="candidate-title">
        <h2 id="candidate-title">Find matching harvests</h2>
        <p>
          Matches are based on availability, tea grade, and minimum quantity.
          Final eligibility is checked when a procurement request is submitted.
        </p>
        {profile.isPending ? (
          <LoadingCards />
        ) : profile.isError ? (
          <MarketError
            error={profile.error}
            retry={() => void profile.refetch()}
          />
        ) : profile.data?.status !== "VERIFIED" ? (
          <div className="market-card space-y-3">
            <p>
              {profile.data
                ? "Your factory must be verified to prepare a procurement request."
                : "Complete your factory profile and obtain verification to prepare a procurement request."}
            </p>
            <Link className="button button-outline" to="/factory">
              Factory profile and verification
            </Link>
          </div>
        ) : (
          <MatchByOffer />
        )}
      </section>
    </>
  );
}

function MatchByOffer() {
  const [params, setParams] = useSearchParams();
  const own = useOwnedOffers(
    { page: pageNumber(params.get("offerPage")), status: "ACTIVE" },
    true,
  );

  function pageLink(key: string, page: number) {
    const next = new URLSearchParams(params);
    next.set(key, String(page));
    if (key === "offerPage") {
      next.delete("offer");
      next.delete("listingPage");
    }
    return "/factory/procurement?" + next;
  }

  if (own.isPending) return <LoadingCards />;
  if (own.isError)
    return <MarketError error={own.error} retry={() => void own.refetch()} />;
  const offers = own.data.data.filter(isAvailable);
  const selected =
    offers.find((item) => String(item.id) === params.get("offer")) ?? offers[0];

  return (
    <>
      <div className="market-card space-y-3">
        {selected ? (
          <div className="market-filters">
            <label>
              Your active offer
              <select
                value={selected.id}
                onChange={(event) => {
                  const next = new URLSearchParams(params);
                  next.set("offer", event.target.value);
                  next.delete("listingPage");
                  setParams(next);
                }}
              >
                {offers.map((offer) => (
                  <option key={offer.id} value={offer.id}>
                    {offer.teaGrade} · {bdt(offer.pricePerKg)} / kg · through{" "}
                    {day(offer.validUntil)} · #{offer.id}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <p>
            No available offers on this page.{" "}
            <Link className="underline" to="/factory/offers">
              Manage offers
            </Link>
          </p>
        )}
        <Pagination
          page={own.data.page}
          totalPages={own.data.totalPages}
          to={(page) => pageLink("offerPage", page)}
        />
      </div>
      {selected && (
        <CandidateListings
          key={selected.id}
          offer={selected}
          page={pageNumber(params.get("listingPage"))}
          toPage={(page) => pageLink("listingPage", page)}
        />
      )}
    </>
  );
}

function CandidateListings({
  offer,
  page,
  toPage,
}: {
  offer: OwnedOffer;
  page: number;
  toPage: (next: number) => string;
}) {
  const { request, session } = useSession();
  const grade = offer.teaGrade.trim();
  const results = useQuery({
    queryKey: [
      "marketplace",
      session?.account.id,
      "listings",
      grade,
      undefined,
      page,
    ],
    queryFn: ({ signal }) =>
      request<ListingPage>("/listings", {
        query: { teaGrade: grade, page },
        signal,
      }),
  });
  if (results.isPending) return <LoadingCards />;
  if (results.isError)
    return (
      <MarketError error={results.error} retry={() => void results.refetch()} />
    );

  const matches = results.data.data.filter(
    (listing) =>
      listing.status === "ACTIVE" &&
      listing.isActive &&
      listing.teaGrade.trim().toLowerCase() === grade.toLowerCase() &&
      (offer.minimumQuantityKg === null ||
        listing.estimatedQuantityKg >= offer.minimumQuantityKg),
  );

  return (
    <div className="space-y-4">
      <div className="market-toolbar">
        <p>
          {matches.length} {matches.length === 1 ? "match" : "matches"} on this
          listing page
        </p>
        <button
          className="button button-outline"
          disabled={results.isFetching}
          onClick={() => void results.refetch()}
        >
          Refresh candidates
        </button>
      </div>
      {matches.length ? (
        <ul className="grower-lists">
          {matches.map((listing) => (
            <li className="market-card grower-listing" key={listing.id}>
              <div>
                <h3 className="text-lg font-semibold">{listing.teaGrade}</h3>
                <p>
                  {listing.farmerProfile?.gardenName
                    ? listing.farmerProfile.gardenName + " · "
                    : ""}
                  {listing.collectionLocation}
                </p>
              </div>
              <div>
                <p>
                  {kg(listing.estimatedQuantityKg)} ·{" "}
                  {day(listing.expectedHarvestDate)}
                </p>
                <Status status={listing.status} />
              </div>
              <Link
                className="button button-green"
                to={"/marketplace/listings/" + listing.id}
              >
                Review harvest
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="market-card">
          No harvests on this page match the offer’s grade and minimum quantity.
        </div>
      )}
      <Pagination
        page={results.data.page}
        totalPages={Math.ceil(results.data.total / results.data.limit)}
        to={toPage}
      />
    </div>
  );
}
