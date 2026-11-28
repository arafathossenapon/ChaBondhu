import { Settlement } from "../payments/settlement";
import { PickupDetails } from "./pickup";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router";
import { useSession } from "../auth/session-context";
import type { Page } from "../factory/data";
import { pageNumber, validId } from "../marketplace/contracts";
import { bdt } from "../marketplace/offers";
import {
  day,
  kg,
  LoadingCards,
  MarketError,
  Pagination,
  Status,
} from "../marketplace/ui";

export type Order = {
  id: number;
  orderRequestId: number;
  priceOfferId: number;
  harvestListing: { id: number; teaGrade: string };
  farmerProfile: { gardenName: string; district: string };
  factoryProfile: { factoryName: string; district: string };
  agreedPricePerKg: number;
  estimatedQuantityKg: number;
  actualCollectedWeightKg: number | null;
  proposedCollectionDate: string | null;
  collectionPoint: string | null;
  pickupNotes: string | null;
  estimatedTransportCostBdt: number | null;
  orderStatus:
    "ACCEPTED" | "PICKUP_SCHEDULED" | "COLLECTED" | "COMPLETED" | "CANCELLED";
  paymentStatus: "PENDING" | "SUBMITTED" | "CONFIRMED" | "REJECTED";
  createdAt: string;
};

function orderLabel(status: Order["orderStatus"]) {
  return status === "PICKUP_SCHEDULED" ? "Pickup scheduled" : status;
}

export function OrderHistoryPage() {
  const [params] = useSearchParams();
  const page = pageNumber(params.get("page"));
  const { session, request } = useSession();
  const factory = session?.account.role === "FACTORY";
  const base = factory ? "/factory/orders" : "/grower/orders";
  const orders = useQuery({
    queryKey: ["orders", session?.account.id, "history", page],
    queryFn: ({ signal }) =>
      request<Page<Order>>("/orders/my", { signal, query: { page } }),
  });

  return (
    <>
      <header className="grower-heading">
        <h1>My orders</h1>
        <p>
          Follow your orders from acceptance through collection and completion.
        </p>
      </header>
      <section className="grower-section" aria-label="Order history">
        {orders.isPending ? (
          <LoadingCards />
        ) : orders.isError ? (
          <MarketError
            error={orders.error}
            retry={() => void orders.refetch()}
          />
        ) : (
          <>
            {orders.data.data.length === 0 && (
              <p className="market-card">No orders on this page.</p>
            )}
            <div className="market-grid">
              {orders.data.data.map((order) => (
                <article key={order.id} className="market-card space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2>Order #{order.id}</h2>
                    <Status status={orderLabel(order.orderStatus)} />
                  </div>
                  <p>
                    {order.harvestListing.teaGrade} ·{" "}
                    {factory
                      ? order.farmerProfile.gardenName
                      : order.factoryProfile.factoryName}
                  </p>
                  <p>
                    {kg(order.estimatedQuantityKg)} estimated ·{" "}
                    {day(order.createdAt)}
                  </p>
                  <Link
                    className="button button-outline"
                    to={base + "/" + order.id}
                  >
                    View order #{order.id}
                  </Link>
                </article>
              ))}
            </div>
            <Pagination
              page={orders.data.page}
              totalPages={orders.data.totalPages}
              to={(next) => `?page=${next}`}
            />
          </>
        )}
      </section>
    </>
  );
}

export function OrderDetailPage() {
  const { id } = useParams();
  const { session, request } = useSession();
  const factory = session?.account.role === "FACTORY";
  const detailKey = ["orders", session?.account.id, "detail", id] as const;
  const order = useQuery({
    queryKey: detailKey,
    enabled: validId(id),
    queryFn: ({ signal }) => request<Order>("/orders/" + id, { signal }),
  });
  const data = order.data;

  return (
    <>
      <header className="grower-heading">
        <h1>{data ? "Order #" + data.id : "Order details"}</h1>
        <p>Harvest, agreed price, collection, and payment status.</p>
      </header>
      <section className="grower-section" aria-label="Order details">
        <Link
          className="button button-outline self-start"
          to={factory ? "/factory/orders" : "/grower/orders"}
        >
          Back to my orders
        </Link>
        {!validId(id) ? (
          <p className="market-card">Invalid order reference.</p>
        ) : order.isPending ? (
          <LoadingCards />
        ) : order.isError ? (
          <MarketError error={order.error} retry={() => void order.refetch()} />
        ) : (
          <>
            <article className="market-card space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <h2>{data?.harvestListing.teaGrade}</h2>
                <Status status={orderLabel(order.data.orderStatus)} />
              </div>
              <dl className="market-facts">
                <div>
                  <dt>Harvest listing</dt>
                  <dd>#{order.data.harvestListing.id}</dd>
                </div>
                <div>
                  <dt>Order request</dt>
                  <dd>#{order.data.orderRequestId}</dd>
                </div>
                <div>
                  <dt>Price offer</dt>
                  <dd>#{order.data.priceOfferId}</dd>
                </div>
                <div>
                  <dt>Grower</dt>
                  <dd>
                    {order.data.farmerProfile.gardenName} ·{" "}
                    {order.data.farmerProfile.district}
                  </dd>
                </div>
                <div>
                  <dt>Factory</dt>
                  <dd>
                    {order.data.factoryProfile.factoryName} ·{" "}
                    {order.data.factoryProfile.district}
                  </dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{day(order.data.createdAt)}</dd>
                </div>
                <div>
                  <dt>Agreed price</dt>
                  <dd>{bdt(order.data.agreedPricePerKg)} / kg</dd>
                </div>
                <div>
                  <dt>Estimated harvest</dt>
                  <dd>{kg(order.data.estimatedQuantityKg)}</dd>
                </div>
              </dl>
            </article>
            <PickupDetails
              key={order.data.id}
              order={order.data}
              detailKey={detailKey}
            />
            <Settlement key={"payment-" + order.data.id} order={order.data} />
          </>
        )}
      </section>
    </>
  );
}
