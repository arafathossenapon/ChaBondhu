import { SettlementActions } from "./settlement-actions";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSession } from "../auth/session-context";
import type { DetailKey } from "../orders/pickup-transition";
import { SubmitPayment } from "./submit-payment";
import { paymentKey } from "./data";
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

export function Settlement({
  order,
  detailKey,
}: {
  order: Order;
  detailKey: DetailKey;
}) {
  const client = useQueryClient();
  const { session } = useSession();
  const [notice, setNotice] = useState("");
  async function refresh() {
    const results = await Promise.allSettled([
      client.invalidateQueries(
        { queryKey: paymentKey(session?.account.id, order.id) },
        { throwOnError: true },
      ),
      client.invalidateQueries({
        queryKey: ["orders", session?.account.id, "history"],
      }),
      client.invalidateQueries(
        { queryKey: detailKey, exact: true },
        { throwOnError: true },
      ),
    ]);
    return results.every((result) => result.status === "fulfilled");
  }
  const [params] = useSearchParams();
  const page = Math.min(pageNumber(params.get("paymentPage")), 1000000);
  const { eligible, amount, history } = useSettlement(order, page);
  const status = amount.data?.paymentStatus ?? order.paymentStatus;

  return (
    <section className="market-card space-y-4" aria-label="Payment settlement">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="settlement-heading" tabIndex={-1}>
          Payment settlement
        </h2>
        <Status status={status} />
      </div>
      {notice && <p role="status">{notice}</p>}
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
          {session?.account.role === "FACTORY" &&
            order.orderStatus === "COLLECTED" &&
            amount.data &&
            (order.paymentStatus === "PENDING" ||
              order.paymentStatus === "REJECTED") &&
            (status === "PENDING" || status === "REJECTED") && (
              <SubmitPayment
                payable={amount.data}
                refresh={refresh}
                notify={setNotice}
              />
            )}
          {session?.account.role === "FACTORY" &&
            order.orderStatus === "COLLECTED" &&
            amount.data?.paymentStatus === "CONFIRMED" &&
            order.paymentStatus === "CONFIRMED" && (
              <SettlementActions
                mode="completion"
                payable={amount.data}
                notify={setNotice}
                refresh={async () => {
                  const [fresh] = await Promise.all([
                    refresh(),
                    client.invalidateQueries({
                      queryKey: ["marketplace", session.account.id],
                    }),
                  ]);
                  return fresh;
                }}
              />
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
                  {session?.account.role === "GROWER" &&
                    order.orderStatus === "COLLECTED" &&
                    order.paymentStatus === "SUBMITTED" &&
                    amount.data?.paymentStatus === "SUBMITTED" &&
                    attempt.decision === null && (
                      <SettlementActions
                        mode="receipt"
                        attempt={attempt}
                        payable={amount.data}
                        refresh={refresh}
                        notify={setNotice}
                      />
                    )}
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
