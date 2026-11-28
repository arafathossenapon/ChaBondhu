import { useSearchParams } from "react-router";
import { ApiError } from "../../shared/api/api-error";
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
import type { Order } from "../orders/history";
import {
  exactBdt,
  methodLabels,
  paymentTimestamp,
  useSettlement,
} from "./data";

export function Settlement({ order }: { order: Order }) {
  const [params] = useSearchParams();
  const page = Math.min(pageNumber(params.get("paymentPage")), 1000000);
  const { eligible, amount, history } = useSettlement(order, page);
  const status = amount.data?.paymentStatus ?? order.paymentStatus;

  return (
    <section className="market-card space-y-4" aria-label="Payment settlement">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2>Payment settlement</h2>
        <Status status={status} />
      </div>
      {!eligible ? (
        <p>
          {order.orderStatus === "CANCELLED"
            ? "This order was cancelled."
            : "The payable amount becomes available after collection."}
        </p>
      ) : (
        <>
          <dl className="market-facts">
            <div>
              <dt>Order</dt>
              <dd>#{order.id}</dd>
            </div>
            <div>
              <dt>Estimated harvest</dt>
              <dd>{kg(order.estimatedQuantityKg)}</dd>
            </div>
            <div>
              <dt>Actual collected weight</dt>
              <dd>
                {order.actualCollectedWeightKg === null
                  ? "Not recorded"
                  : kg(order.actualCollectedWeightKg)}
              </dd>
            </div>
            <div>
              <dt>Agreed price</dt>
              <dd>{bdt(order.agreedPricePerKg)} / kg</dd>
            </div>
            {amount.data && (
              <div>
                <dt>Payable amount</dt>
                <dd className="font-semibold tabular-nums">
                  {exactBdt(amount.data.amountBdt)}
                </dd>
              </div>
            )}
          </dl>
          {amount.isPending ? (
            <LoadingCards />
          ) : (
            amount.isError &&
            (amount.error instanceof ApiError && amount.error.status === 409 ? (
              <p role="status">{amount.error.message}</p>
            ) : (
              <MarketError
                error={amount.error}
                retry={() => void amount.refetch()}
              />
            ))
          )}
          <h3 className="font-semibold">Payment attempt history</h3>
          {history.isPending ? (
            <LoadingCards />
          ) : history.isError ? (
            <MarketError
              error={history.error}
              retry={() => void history.refetch()}
            />
          ) : (
            <>
              {!history.data?.data.length && (
                <p>No payment attempts on this page.</p>
              )}
              {history.data?.data.map((attempt) => (
                <article
                  key={attempt.id}
                  className="rounded-xl border border-tea/20 p-4 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-semibold">Attempt #{attempt.id}</h4>
                    <Status status={attempt.decision ?? "SUBMITTED"} />
                  </div>
                  <dl className="market-facts">
                    <div>
                      <dt>Method</dt>
                      <dd>
                        {methodLabels[attempt.method]}
                        {attempt.provider && " · " + attempt.provider}
                      </dd>
                    </div>
                    {amount.data && (
                      <div>
                        <dt>Amount</dt>
                        <dd>{exactBdt(amount.data.amountBdt)}</dd>
                      </div>
                    )}
                    <div>
                      <dt>Payment date</dt>
                      <dd>{day(attempt.paymentDate)}</dd>
                    </div>
                    <div>
                      <dt>Submitted (Bangladesh time)</dt>
                      <dd>
                        {paymentTimestamp.format(new Date(attempt.createdAt))}
                      </dd>
                    </div>
                    {attempt.reference && (
                      <div>
                        <dt>Reference</dt>
                        <dd className="wrap-break-word">{attempt.reference}</dd>
                      </div>
                    )}
                    {attempt.decidedAt && (
                      <div>
                        <dt>Decided (Bangladesh time)</dt>
                        <dd>
                          {paymentTimestamp.format(new Date(attempt.decidedAt))}
                        </dd>
                      </div>
                    )}
                    {attempt.rejectionReason && (
                      <div>
                        <dt>Rejection reason</dt>
                        <dd className="wrap-break-word whitespace-pre-wrap">
                          {attempt.rejectionReason}
                        </dd>
                      </div>
                    )}
                  </dl>
                </article>
              ))}
              {history.data && (
                <Pagination
                  page={history.data.page}
                  totalPages={history.data.totalPages}
                  to={(next) => {
                    const query = new URLSearchParams(params);
                    query.set("paymentPage", String(next));
                    return "?" + query;
                  }}
                />
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
