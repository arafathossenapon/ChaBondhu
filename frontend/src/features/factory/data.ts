import { useQuery } from "@tanstack/react-query";
import { useSession } from "../auth/session-context";
import type { Offer } from "../marketplace/offers";

export type OwnedOffer = Omit<Offer, "factoryProfile"> & {
  factoryProfileId: number;
  notes: string | null;
};
export type Page<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
export type RecentRequest = {
  id: number;
  status: string;
  quotedPricePerKg: number;
  harvestListing: { id: number; teaGrade: string };
};

export function ownedOffersPrefix(accountId: number | undefined) {
  return ["factory", accountId, "offers"] as const;
}

export function useOwnedOffers(
  filters: { page: number; limit?: number; status?: OwnedOffer["status"] },
  enabled: boolean,
) {
  const { session, request } = useSession();
  return useQuery({
    enabled,
    queryKey: [...ownedOffersPrefix(session?.account.id), filters],
    queryFn: ({ signal }) =>
      request<Page<OwnedOffer>>("/offers/my", { query: filters, signal }),
  });
}

export function useRecentRequests() {
  const { session, request } = useSession();
  return useQuery({
    queryKey: ["factory", session?.account.id, "recent-requests"],
    queryFn: ({ signal }) =>
      request<Page<RecentRequest>>("/order-requests/my", {
        query: { limit: 4 },
        signal,
      }),
  });
}
