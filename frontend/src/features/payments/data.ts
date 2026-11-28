import { useQuery } from "@tanstack/react-query";
import { ApiError } from "../../shared/api/api-error";
import { useSession } from "../auth/session-context";
import type { Page } from "../factory/data";
import type { Order } from "../orders/history";

export type PaymentMethod =
  "CASH" | "BANK_TRANSFER" | "MOBILE_FINANCIAL_SERVICE";
export type PaymentBody = {
  method: PaymentMethod;
  paymentDate: string;
  provider?: string;
  reference?: string;
};
export type Attempt = {
  id: number;
  method: PaymentMethod;
  provider: string | null;
  reference: string | null;
  paymentDate: string;
  createdAt: string;
  decision: "CONFIRMED" | "REJECTED" | null;
  decidedAt: string | null;
  rejectionReason: string | null;
};
export type Payable = {
  orderId: number;
  currency: "BDT";
  amountBdt: string;
  paymentStatus: Order["paymentStatus"];
};
export type Submission = Pick<Payable, "orderId" | "amountBdt" | "currency"> & {
  paymentId: number;
  attempt: Attempt;
};
export const methodLabels: Record<PaymentMethod, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank transfer",
  MOBILE_FINANCIAL_SERVICE: "Mobile financial service",
};
export const paymentPath = (id: number) => `/payments/order/${id}`;
export const paymentKey = (accountId: number | undefined, orderId: number) =>
  ["payments", accountId, orderId] as const;

export function useSettlement(order: Order, page: number) {
  const { session, request } = useSession();
  const key = paymentKey(session?.account.id, order.id);
  const path = paymentPath(order.id);
  const eligible =
    order.orderStatus === "COLLECTED" || order.orderStatus === "COMPLETED";
  const amount = useQuery({
    queryKey: [...key, "amount"],
    enabled: eligible,
    queryFn: ({ signal }) => request<Payable>(path + "/amount", { signal }),
  });
  const history = useQuery({
    queryKey: [...key, "history", page],
    enabled: eligible,
    queryFn: async ({ signal }) => {
      try {
        return await request<Page<Attempt>>(path + "/history", {
          signal,
          query: { page },
        });
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.status === 404 &&
          error.message === "Payment not found"
        )
          return null;
        throw error;
      }
    },
  });
  return { eligible, amount, history };
}

export function exactBdt(value: string) {
  const [whole, fraction] = value.split(".");
  return "BDT " + BigInt(whole).toLocaleString("en-BD") + "." + fraction;
}

export const paymentTimestamp = new Intl.DateTimeFormat("en-BD", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Dhaka",
});
