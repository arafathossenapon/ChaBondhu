import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { ApiError } from "../../shared/api/api-error";
import { useSession } from "../auth/session-context";
import { RequestLink } from "../orders/submit";
import { SameGradeOffers } from "./offers";
import { validId, type Listing } from "./contracts";
import { day, kg, LoadingCards, MarketError, MarketHeader, Status } from "./ui";

export function ListingDetail() {
  const { id } = useParams();
  const { request, session } = useSession();
  const valid = validId(id);
  const listing = useQuery({
    queryKey: ["marketplace", session?.account.id, "listing", id],
    enabled: valid,
    queryFn: ({ signal }) => request<Listing>("/listings/" + id, { signal }),
  });
  const notFound =
    !valid ||
    (listing.error instanceof ApiError && listing.error.status === 404);
  const data = listing.data;
  const grower = data?.farmerProfile;

  return (
    <>
      <MarketHeader
        title={data ? data.teaGrade : "Harvest details"}
        description="Harvest, grower, and collection information."
      />
      <section
        className="site-width market-content"
        aria-label="Harvest details"
      >
        <Link className="button button-outline" to="/marketplace/listings">
          Back to harvest listings
        </Link>
        {notFound ? (
          <div className="market-card">
            <h2>Listing unavailable</h2>
            <p>This listing could not be found.</p>
          </div>
        ) : listing.isPending ? (
          <LoadingCards />
        ) : listing.isError ? (
          <MarketError
            error={listing.error}
            retry={() => void listing.refetch()}
          />
        ) : (
          data && (
            <article className="market-card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2>Harvest information</h2>
                <Status status={data.isActive ? data.status : "Unavailable"} />
              </div>
              <dl className="market-facts">
                <div>
                  <dt>Estimated harvest</dt>
                  <dd>{kg(data.estimatedQuantityKg)}</dd>
                </div>
                <div>
                  <dt>Expected harvest</dt>
                  <dd>{day(data.expectedHarvestDate)}</dd>
                </div>
                {data.lastHarvestDate && (
                  <div>
                    <dt>Last harvest</dt>
                    <dd>{day(data.lastHarvestDate)}</dd>
                  </div>
                )}
                {grower && (
                  <div>
                    <dt>Grower</dt>
                    <dd>
                      {grower.gardenName} · {grower.upazila}, {grower.district},{" "}
                      {grower.division}
                    </dd>
                  </div>
                )}
                <div>
                  <dt>Collection location</dt>
                  <dd>{data.collectionLocation}</dd>
                </div>
              </dl>
              {session?.account.role === "FACTORY" &&
                data.isActive &&
                data.status === "ACTIVE" && <RequestLink listing={data} />}
              {data.qualityDescription && (
                <div>
                  <h3 className="font-semibold">Quality</h3>
                  <p>{data.qualityDescription}</p>
                </div>
              )}
              {data.notes && (
                <div>
                  <h3 className="font-semibold">Grower notes</h3>
                  <p>{data.notes}</p>
                </div>
              )}
            </article>
          )
        )}
        {listing.isSuccess && !notFound && data?.teaGrade.trim() && (
          <SameGradeOffers teaGrade={data.teaGrade} />
        )}
      </section>
    </>
  );
}
