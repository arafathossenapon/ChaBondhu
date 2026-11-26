import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { useSession } from "../auth/session-context";
import { day, kg, LoadingCards, MarketError, Status } from "./ui";

export type Offer = {
  id: number;
  teaGrade: string;
  pricePerKg: number;
  qualityRequirements: string | null;
  minimumQuantityKg: number | null;
  validUntil: string;
  estimatedTransportCostBdt: number | null;
  status: "ACTIVE" | "EXPIRED" | "WITHDRAWN";
  factoryProfile: { id: number; factoryName: string; district: string };
};

type OfferPage = {
  data: Offer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
type OfferFilters = {
  teaGrade?: string;
  minPrice?: string;
  maxPrice?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  limit?: number;
};
const currency = new Intl.NumberFormat("en-BD", {
  style: "currency",
  currency: "BDT",
  currencyDisplay: "code",
});
const bangladeshDate = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Dhaka",
  dateStyle: "short",
});
export const bdt = (amount: number) => currency.format(amount);
export function isAvailable(offer: Offer) {
  return (
    offer.status === "ACTIVE" &&
    offer.validUntil >= bangladeshDate.format(new Date())
  );
}

export function useOffers(filters: OfferFilters) {
  const { request, session } = useSession();
  return useQuery({
    queryKey: ["marketplace", session?.account.id, "offers", filters],
    queryFn: ({ signal }) =>
      request<OfferPage>("/offers", { signal, query: filters }),
    staleTime: 0,
  });
}

export function OfferCards({ offers }: { offers: Offer[] }) {
  if (!offers.length)
    return (
      <div className="market-card">
        <h2>No available offers</h2>
        <p>Try changing your filters or check again later.</p>
      </div>
    );
  return (
    <div className="market-grid">
      {offers.map((offer) => (
        <article className="market-card listing-card" key={offer.id}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2>
              <Link to={"/marketplace/offers/" + offer.id}>
                {offer.factoryProfile.factoryName}
              </Link>
            </h2>
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
          </dl>
        </article>
      ))}
    </div>
  );
}

export function SameGradeOffers({ teaGrade }: { teaGrade: string }) {
  const { session } = useSession();
  const offers = useOffers({ teaGrade: teaGrade.trim(), limit: 3 });
  const url =
    "/marketplace/offers?" + new URLSearchParams({ teaGrade: teaGrade.trim() });
  return (
    <section aria-labelledby="same-grade-title" className="space-y-4">
      <div>
        <h2 id="same-grade-title" className="text-2xl font-semibold">
          Offers for this tea grade
        </h2>
        <p>
          These factory offers cover the same grade. They are market prices and
          are not bids on this listing.
        </p>
      </div>
      {offers.isPending ? (
        <LoadingCards />
      ) : offers.isError ? (
        <MarketError error={offers.error} retry={() => void offers.refetch()} />
      ) : (
        <OfferCards offers={offers.data.data.filter(isAvailable)} />
      )}
      <Link className="button button-green" to={url}>
        Compare offers for {teaGrade.trim()}
      </Link>
      {session?.account.role === "FACTORY" && (
        <p className="text-sm">
          Procurement requests require a verified factory and an eligible offer
          you own.{" "}
          <Link className="underline" to="/factory">
            Check factory verification
          </Link>
        </p>
      )}
    </section>
  );
}
