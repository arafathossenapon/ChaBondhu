import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useSession } from "../auth/session-context";
import { useOwnedOffers } from "../factory/data";
import { pageNumber, validId, type Listing } from "../marketplace/contracts";
import { bdt, isAvailable } from "../marketplace/offers";
import {
  day,
  kg,
  LoadingCards,
  MarketError,
  Pagination,
} from "../marketplace/ui";
import { useOwnProfile } from "../profiles/own-profile";

export function RequestLink({ listing }: { listing: Listing }) {
  const profile = useOwnProfile("factory");
  if (profile.data?.status !== "VERIFIED" || profile.isError) return null;
  return (
    <Link
      className="button button-leaf"
      to={`/factory/requests/new?listing=${listing.id}`}
    >
      Request this harvest
    </Link>
  );
}

export function SubmitRequestPage() {
  const [params] = useSearchParams();
  const id = params.get("listing") ?? undefined;
  const page = pageNumber(params.get("offerPage"));
  const profile = useOwnProfile("factory");
  const { session, request } = useSession();
  const verified = profile.data?.status === "VERIFIED" && !profile.isError;
  const listing = useQuery({
    queryKey: ["marketplace", session?.account.id, "listing", id],
    enabled: verified && validId(id),
    queryFn: ({ signal }) => request<Listing>("/listings/" + id, { signal }),
  });

  return (
    <>
      <header className="grower-heading">
        <h1>Request a harvest</h1>
        <p>
          Choose one of your active offers and review its price before sending
          the request to the grower.
        </p>
      </header>
      <section className="grower-section" aria-label="Order request">
        <Link
          className="button button-outline"
          to={
            validId(id)
              ? "/marketplace/listings/" + id
              : "/marketplace/listings"
          }
        >
          Back to harvest
        </Link>
        {profile.isPending ? (
          <LoadingCards />
        ) : profile.isError ? (
          <MarketError
            error={profile.error}
            retry={() => void profile.refetch()}
          />
        ) : !verified ? (
          <div className="market-card">
            A verified factory profile is required.{" "}
            <Link className="underline" to="/factory">
              View verification
            </Link>
          </div>
        ) : !validId(id) ? (
          <p className="market-card">Choose a listing from the marketplace.</p>
        ) : listing.isPending ? (
          <LoadingCards />
        ) : listing.isError ? (
          <MarketError
            error={listing.error}
            retry={() => void listing.refetch()}
          />
        ) : (
          <RequestForm
            key={`${id}:${page}`}
            listing={listing.data}
            page={page}
          />
        )}
      </section>
    </>
  );
}

function RequestForm({ listing, page }: { listing: Listing; page: number }) {
  const active = listing.isActive && listing.status === "ACTIVE";
  const offers = useOwnedOffers({ status: "ACTIVE", page }, active);
  const { session, request } = useSession();
  const client = useQueryClient();
  const [offerId, setOfferId] = useState("");
  const [review, setReview] = useState(false);
  const submit = useMutation({
    mutationFn: (priceOfferId: number) =>
      request<{ id: number }>("/order-requests", {
        method: "POST",
        body: { harvestListingId: listing.id, priceOfferId },
      }),
    onSuccess: async () => {
      setReview(false);
      await client.invalidateQueries({
        queryKey: ["factory", session?.account.id, "recent-requests"],
      });
      await client.invalidateQueries({
        queryKey: ["orders", session?.account.id],
      });
    },
  });
  const matches =
    offers.data?.data.filter(
      (offer) =>
        isAvailable(offer) &&
        offer.teaGrade.trim().toLowerCase() ===
          listing.teaGrade.trim().toLowerCase() &&
        Number(offer.minimumQuantityKg) <= Number(listing.estimatedQuantityKg),
    ) ?? [];
  const selected = matches.find((offer) => String(offer.id) === offerId);

  if (submit.data)
    return (
      <div className="market-card" role="status">
        Request #{submit.data.id} sent to the grower.{" "}
        <Link className="underline" to="/factory/requests">
          View my requests
        </Link>
      </div>
    );
  if (!active)
    return (
      <p className="market-card">
        This harvest is no longer available for requests.
      </p>
    );

  return (
    <>
      <article className="market-card space-y-3">
        <h2>
          {listing.teaGrade} · Listing #{listing.id}
        </h2>
        <p>
          {listing.farmerProfile?.gardenName} {listing.farmerProfile?.district}
        </p>
        <p>
          Estimated harvest: {kg(listing.estimatedQuantityKg)} · Expected{" "}
          {day(listing.expectedHarvestDate)}
        </p>
        <p>Collection location: {listing.collectionLocation}</p>
      </article>
      {offers.isPending ? (
        <LoadingCards />
      ) : offers.isError ? (
        <MarketError error={offers.error} retry={() => void offers.refetch()} />
      ) : (
        <>
          <form
            className="market-card space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (selected) {
                submit.reset();
                setReview(true);
              }
            }}
          >
            {matches.length === 0 ? (
              <p>
                No matching available offers on this page.{" "}
                <Link className="underline" to="/factory/offers">
                  Manage offers
                </Link>
              </p>
            ) : (
              <>
                <div className="market-filters">
                  <label>
                    Your matching offer
                    <select
                      required
                      value={offerId}
                      onChange={(event) => setOfferId(event.target.value)}
                    >
                      <option value="">Select an offer</option>
                      {matches.map((offer) => (
                        <option key={offer.id} value={offer.id}>
                          #{offer.id} · {bdt(offer.pricePerKg)} / kg · through{" "}
                          {day(offer.validUntil)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p>
                  The server checks listing availability, offer eligibility, and
                  duplicate pending requests when you send.
                </p>
                <button
                  className="button button-leaf"
                  disabled={!selected || submit.isPending}
                >
                  Review request
                </button>
              </>
            )}
          </form>
          <Pagination
            page={offers.data.page}
            totalPages={offers.data.totalPages}
            to={(next) => `?listing=${listing.id}&offerPage=${next}`}
          />
        </>
      )}
      <Dialog.Root
        open={review}
        onOpenChange={(open) => {
          if (!submit.isPending) setReview(open);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="menu-overlay" />
          <Dialog.Content className="grower-dialog">
            <Dialog.Title>Send order request?</Dialog.Title>
            <Dialog.Description>
              {listing.teaGrade} · Listing #{listing.id}. The grower will
              receive your quoted price of{" "}
              {selected ? bdt(selected.pricePerKg) : ""} per kg.
            </Dialog.Description>
            {submit.error && <p role="alert">{submit.error.message}</p>}
            <div className="flex flex-wrap gap-3">
              <Dialog.Close
                className="button button-outline"
                disabled={submit.isPending}
              >
                Back
              </Dialog.Close>
              <button
                className="button button-leaf"
                disabled={!selected || submit.isPending}
                onClick={() => {
                  if (selected && !submit.isPending) submit.mutate(selected.id);
                }}
              >
                {submit.isPending ? "Sending…" : "Send request"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
