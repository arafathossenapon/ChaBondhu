import { EntityManager } from "typeorm";
import { OrderRequest } from "./entities/order-request.entity";
import { OrderRequestClosureReason, OrderRequestStatus } from "./order-status";

export async function closePendingRequests(
  manager: EntityManager,
  harvestListingId: number,
  closureReason: OrderRequestClosureReason,
): Promise<void> {
  await manager.update(
    OrderRequest,
    { harvestListingId, status: OrderRequestStatus.PENDING },
    {
      status: OrderRequestStatus.CLOSED,
      closureReason,
    },
  );
}
