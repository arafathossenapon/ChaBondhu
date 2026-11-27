import { useState } from "react";
import { WithdrawListing } from "./withdraw-listing";
import { Link, useLocation, useParams } from "react-router";
import { LoadingCards, MarketError, Status, day, kg } from "../marketplace/ui";
import { validId } from "../marketplace/contracts";
import { canEdit, listingState, useGrowerListings } from "./listings";

export function GrowerListingDetail() {
  const { id } = useParams();
  const notice: unknown = useLocation().state?.notice;
  const [withdrawnId, setWithdrawnId] = useState<number>();
  const listings = useGrowerListings();
  const listing = validId(id)
    ? listings.data?.find((entry) => entry.id === Number(id))
    : undefined;
  return (
    <>
      <header className="grower-heading">
        <h1>{listing?.teaGrade ?? "Harvest listing"}</h1>
        <Link className="button hero-secondary" to="/grower/listings">
          Back to my listings
        </Link>
      </header>
      <section className="grower-section" aria-label="Listing details">
        {withdrawnId !== undefined && withdrawnId === listing?.id ? (
          <p role="status">Listing withdrawn.</p>
        ) : (
          typeof notice === "string" && <p role="status">{notice}</p>
        )}
        {listings.isPending ? (
          <LoadingCards />
        ) : listings.isError ? (
          <MarketError
            error={listings.error}
            retry={() => void listings.refetch()}
          />
        ) : !listing ? (
          <div className="market-card">
            <h2>Listing unavailable</h2>
            <p>This listing could not be found among your harvests.</p>
          </div>
        ) : (
          <article className="market-card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2>Harvest information</h2>
              <Status status={listingState(listing)} />
            </div>
            <dl className="market-facts">
              <div>
                <dt>Estimated quantity</dt>
                <dd>{kg(listing.estimatedQuantityKg)}</dd>
              </div>
              <div>
                <dt>Expected harvest</dt>
                <dd>{day(listing.expectedHarvestDate)}</dd>
              </div>
              {listing.lastHarvestDate && (
                <div>
                  <dt>Last harvest</dt>
                  <dd>{day(listing.lastHarvestDate)}</dd>
                </div>
              )}
              <div>
                <dt>Collection location</dt>
                <dd>{listing.collectionLocation}</dd>
              </div>
            </dl>
            {listing.qualityDescription && (
              <div>
                <h3 className="font-semibold">Quality</h3>
                <p>{listing.qualityDescription}</p>
              </div>
            )}
            {listing.notes && (
              <div>
                <h3 className="font-semibold">Notes</h3>
                <p>{listing.notes}</p>
              </div>
            )}
            {canEdit(listing) && (
              <Link
                className="button button-green"
                to={"/grower/listings/" + listing.id + "/edit"}
              >
                Edit listing
              </Link>
            )}
            <WithdrawListing
              key={listing.id}
              listing={listing}
              refresh={() => void listings.refetch()}
              onWithdrawn={() => setWithdrawnId(listing.id)}
            />
          </article>
        )}
      </section>
    </>
  );
}
