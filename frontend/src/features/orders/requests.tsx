import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useSession } from "../auth/session-context";
import type { Page } from "../factory/data";
import { useGrowerListings } from "../grower/listings";
import { pageNumber } from "../marketplace/contracts";
import { bdt } from "../marketplace/offers";
import {
  day,
  kg,
  LoadingCards,
  MarketError,
  Pagination,
  Status,
} from "../marketplace/ui";

type RequestRow = {
  id: number;
  harvestListingId: number;
  priceOfferId: number;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "CLOSED" | "WITHDRAWN";
  closureReason: "ANOTHER_REQUEST_ACCEPTED" | "LISTING_UNAVAILABLE" | null;
  quotedPricePerKg: number;
  createdAt: string;
  harvestListing: { teaGrade: string; estimatedQuantityKg: number };
  factoryProfile: { factoryName: string; district: string };
};

type Action = "accept" | "reject" | "withdraw";
const actionLabels = {
  accept: "Accept",
  reject: "Reject",
  withdraw: "Withdraw",
};
const actionDescriptions = {
  accept:
    "Acceptance reserves the listing, creates an order, and closes its other pending requests.",
  reject:
    "This request will be closed as rejected. Other pending requests can still be reviewed.",
  withdraw: "The grower will no longer be able to accept this request.",
};

export function FactoryRequestsPage() {
  return (
    <>
      <header className="grower-heading">
        <h1>My order requests</h1>
        <p>Track the requests you sent to growers.</p>
        <Link className="button button-leaf" to="/factory/procurement">
          Find harvests
        </Link>
      </header>
      <RequestList factory />
    </>
  );
}

export function GrowerRequestsPage() {
  const listings = useGrowerListings();
  const [params, setParams] = useSearchParams();
  const listing = listings.data?.find(
    (row) => String(row.id) === params.get("listing"),
  );
  return (
    <>
      <header className="grower-heading">
        <h1>Incoming order requests</h1>
        <p>Select one of your harvest listings to review its requests.</p>
      </header>
      <section className="grower-section" aria-label="Choose a harvest listing">
        {listings.isPending ? (
          <LoadingCards />
        ) : listings.isError ? (
          <MarketError
            error={listings.error}
            retry={() => void listings.refetch()}
          />
        ) : listings.data.length === 0 ? (
          <div className="market-card space-y-3">
            <p>You have no harvest listings yet.</p>
            <Link className="button button-outline" to="/grower/listings/new">
              Create a listing
            </Link>
          </div>
        ) : (
          <div className="market-card market-filters">
            <label>
              Your harvest listing
              <select
                value={listing?.id ?? ""}
                onChange={(event) => {
                  setParams(
                    event.target.value ? { listing: event.target.value } : {},
                  );
                }}
              >
                <option value="">Choose a listing</option>
                {listings.data.map((row) => (
                  <option key={row.id} value={row.id}>
                    #{row.id} · {row.teaGrade}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </section>
      {listing && (
        <RequestList key={listing.id} listingId={listing.id} factory={false} />
      )}
    </>
  );
}

function RequestList({
  listingId,
  factory,
}: {
  listingId?: number;
  factory: boolean;
}) {
  const [params] = useSearchParams();
  const page = pageNumber(params.get("page"));
  const { session, request } = useSession();
  const accountId = session?.account.id;
  const client = useQueryClient();
  const [decision, setDecision] = useState<{ action: Action; id: number }>();
  const [feedback, setFeedback] = useState<{
    message: string;
    orderId?: number;
  }>();
  const rows = useQuery({
    queryKey: ["orders", accountId, "requests", listingId ?? "my", page],
    queryFn: ({ signal }) =>
      request<Page<RequestRow>>(
        factory
          ? "/order-requests/my"
          : `/listings/${listingId}/order-requests`,
        { signal, query: { page } },
      ),
  });
  const mutation = useMutation({
    mutationFn: ({ action, id }: { action: Action; id: number }) =>
      request<{ order?: { id: number } }>(`/order-requests/${id}/${action}`, {
        method: "PATCH",
      }),
    onSuccess: async (result, { action, id }) => {
      const outcome = action === "withdraw" ? "withdrawn" : action + "ed";
      setFeedback({
        message: `Request #${id} ${outcome}.`,
        orderId: result.order?.id,
      });
      setDecision(undefined);
      const invalidations = [
        client.invalidateQueries({ queryKey: ["orders", accountId] }),
        client.invalidateQueries({
          queryKey: ["factory", accountId, "recent-requests"],
        }),
      ];
      if (result.order || action === "accept")
        invalidations.push(
          client.invalidateQueries({ queryKey: ["marketplace", accountId] }),
        );
      await Promise.all(invalidations);
    },
    onError: () => {
      void rows.refetch();
    },
  });

  function open(action: Action, id: number) {
    mutation.reset();
    setFeedback(undefined);
    setDecision({ action, id });
  }

  return (
    <section className="grower-section" aria-label="Requests">
      {feedback && (
        <p role="status" className="market-card">
          {feedback.message}{" "}
          {feedback.orderId !== undefined && (
            <Link
              className="underline"
              to={`/grower/orders/${feedback.orderId}`}
            >
              View order #{feedback.orderId}
            </Link>
          )}
        </p>
      )}
      {rows.isPending ? (
        <LoadingCards />
      ) : rows.isError ? (
        <MarketError error={rows.error} retry={() => void rows.refetch()} />
      ) : (
        <>
          {rows.data.data.length === 0 && (
            <p className="market-card">No requests on this page.</p>
          )}
          <div className="market-grid">
            {rows.data.data.map((row) => (
              <article className="market-card space-y-3" key={row.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2>Request #{row.id}</h2>
                  <Status status={row.status} />
                </div>
                <p>
                  {row.harvestListing.teaGrade} · {day(row.createdAt)}
                </p>
                <p>
                  {factory
                    ? bdt(row.quotedPricePerKg) + " / kg"
                    : row.factoryProfile.factoryName}
                </p>
                <details className="space-y-2">
                  <summary className="cursor-pointer font-semibold">
                    Request details
                  </summary>
                  <dl className="market-facts">
                    <div>
                      <dt>Harvest listing</dt>
                      <dd>
                        <Link
                          className="underline"
                          to={
                            factory
                              ? `/marketplace/listings/${row.harvestListingId}`
                              : `/grower/listings/${row.harvestListingId}`
                          }
                        >
                          #{row.harvestListingId}
                        </Link>
                      </dd>
                    </div>
                    <div>
                      <dt>Estimated harvest</dt>
                      <dd>{kg(row.harvestListing.estimatedQuantityKg)}</dd>
                    </div>
                    <div>
                      <dt>Offer</dt>
                      <dd>#{row.priceOfferId}</dd>
                    </div>
                    <div>
                      <dt>Quoted price</dt>
                      <dd>{bdt(row.quotedPricePerKg)} / kg</dd>
                    </div>
                    {!factory && (
                      <div>
                        <dt>Factory district</dt>
                        <dd>{row.factoryProfile.district}</dd>
                      </div>
                    )}
                  </dl>
                  {row.closureReason && (
                    <p>
                      {row.closureReason === "ANOTHER_REQUEST_ACCEPTED"
                        ? "Another request was accepted for this listing."
                        : "The listing became unavailable."}
                    </p>
                  )}
                </details>
                {row.status === "PENDING" && (
                  <div className="flex flex-wrap gap-2">
                    {factory ? (
                      <button
                        className="button button-outline"
                        onClick={() => open("withdraw", row.id)}
                      >
                        Withdraw
                      </button>
                    ) : (
                      <>
                        <button
                          className="button button-leaf"
                          onClick={() => open("accept", row.id)}
                        >
                          Accept
                        </button>
                        <button
                          className="button button-outline"
                          onClick={() => open("reject", row.id)}
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
          <Pagination
            page={rows.data.page}
            totalPages={rows.data.totalPages}
            to={(next) => {
              const query = new URLSearchParams(params);
              query.set("page", String(next));
              return "?" + query;
            }}
          />
        </>
      )}
      <Dialog.Root
        open={Boolean(decision)}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setDecision(undefined);
        }}
      >
        {decision && (
          <Dialog.Portal>
            <Dialog.Overlay className="menu-overlay" />
            <Dialog.Content className="grower-dialog">
              <Dialog.Title>
                {actionLabels[decision.action]} request #{decision.id}?
              </Dialog.Title>
              <Dialog.Description>
                {actionDescriptions[decision.action]}
              </Dialog.Description>
              {mutation.error && <p role="alert">{mutation.error.message}</p>}
              <div className="flex flex-wrap gap-3">
                <Dialog.Close
                  className="button button-outline"
                  disabled={mutation.isPending}
                >
                  Back
                </Dialog.Close>
                <button
                  className="button button-leaf"
                  disabled={mutation.isPending}
                  onClick={() => {
                    if (!mutation.isPending) mutation.mutate(decision);
                  }}
                >
                  {mutation.isPending
                    ? "Saving…"
                    : actionLabels[decision.action] + " request"}
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </Dialog.Root>
    </section>
  );
}
