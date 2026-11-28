import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { ApiError } from "../../shared/api/api-error";
import { useSession } from "../auth/session-context";
import type { Order } from "./history";

export type DetailKey = readonly [
  "orders",
  number | undefined,
  "detail",
  string | undefined,
];

type Transition =
  | {
      orderStatus: "PICKUP_SCHEDULED";
      proposedCollectionDate: string;
      collectionPoint: string;
      pickupNotes?: string;
      estimatedTransportCostBdt?: number;
    }
  | { orderStatus: "COLLECTED"; actualCollectedWeightKg: number };

export type PickupActionProps = {
  order: Order;
  detailKey: DetailKey;
  onSaved: () => void;
  onConflict: (message: string) => void;
};

export function usePickupTransition({
  order,
  detailKey,
  onSaved,
  onConflict,
}: PickupActionProps) {
  const { request } = useSession();
  const queryClient = useQueryClient();
  const busy = useRef(false);
  const mutation = useMutation({
    mutationFn: (body: Transition) =>
      request<Order>(`/orders/${order.id}/status`, { method: "PATCH", body }),
    onSuccess: async (updated) => {
      onSaved();
      await queryClient.cancelQueries({ queryKey: detailKey, exact: true });
      queryClient.setQueryData(detailKey, updated);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: detailKey, exact: true }),
        queryClient.invalidateQueries({
          queryKey: ["orders", detailKey[1], "history"],
        }),
      ]);
    },
    onError: (error) => {
      if (
        error instanceof ApiError &&
        [403, 404, 409].includes(error.status ?? 0)
      ) {
        onConflict(error.message);
        void queryClient.invalidateQueries({
          queryKey: detailKey,
          exact: true,
        });
      }
    },
    onSettled: () => {
      busy.current = false;
    },
  });

  function submit(body: Transition) {
    if (busy.current) return;
    busy.current = true;
    mutation.mutate(body);
  }

  return { mutation, submit, busy };
}
