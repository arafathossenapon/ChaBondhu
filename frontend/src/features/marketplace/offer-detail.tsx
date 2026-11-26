import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { ApiError } from "../../shared/api/api-error";
import { useSession } from "../auth/session-context";
import { validId } from "./contracts";
import { bdt, isAvailable, type Offer } from "./offers";
import { day, kg, LoadingCards, MarketError, MarketHeader, Status } from "./ui";

export function OfferDetail() {
  const { id } = useParams();
  const { session, request } = useSession();
  const valid = validId(id);
  const query = useQuery({
    queryKey: ["marketplace", session?.account.id, "offer", id],
    enabled: valid,
    queryFn: ({ signal }) => request<Offer>("/offers/" + id, { signal }),
  });
  const offer = query.data;
  const unavailable =
    !valid ||
    (query.error instanceof ApiError && query.error.status === 404) ||
    (offer && !isAvailable(offer));
  return (
    <>
      <MarketHeader
        title="Factory offer"
        description="Buying price and conditions for this tea grade."
      />
      <section className="site-width market-content" aria-label="Offer details">
        <Link className="button button-outline" to="/marketplace/offers">
          Back to factory offers
        </Link>
        {unavailable ? (
          <div className="market-card">
            <h2>Offer unavailable</h2>
            <p>The offer may have expired or been withdrawn.</p>
          </div>
        ) : query.isPending ? (
          <LoadingCards />
        ) : query.isError ? (
          <MarketError error={query.error} retry={() => void query.refetch()} />
        ) : (
          offer && (
            <article className="market-card space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2>{offer.factoryProfile.factoryName}</h2>
                <Status status={offer.status} />
              </div>
              <p>
                {offer.teaGrade} · {offer.factoryProfile.district}
              </p>
              <p className="offer-price">
                {bdt(offer.pricePerKg)} <span>/ kg</span>
              </p>
              <dl className="market-facts">
                <div>
                  <dt>Valid through</dt>
                  <dd>{day(offer.validUntil)}</dd>
                </div>
                {offer.minimumQuantityKg !== null && (
                  <div>
                    <dt>Minimum quantity</dt>
                    <dd>{kg(offer.minimumQuantityKg)}</dd>
                  </div>
                )}
                {offer.estimatedTransportCostBdt !== null && (
                  <div>
                    <dt>Estimated transport</dt>
                    <dd>{bdt(offer.estimatedTransportCostBdt)}</dd>
                  </div>
                )}
              </dl>
              {offer.qualityRequirements && (
                <div>
                  <h3 className="font-semibold">Quality requirements</h3>
                  <p>{offer.qualityRequirements}</p>
                </div>
              )}
            </article>
          )
        )}
      </section>
    </>
  );
}
