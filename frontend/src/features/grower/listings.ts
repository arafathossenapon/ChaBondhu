import { useQuery } from "@tanstack/react-query";
import { useSession } from "../auth/session-context";
import type { Listing } from "../marketplace/contracts";

export const ownListingsKey = (id: number | undefined) =>
  ["marketplace", id, "own-listings"] as const;

export function useGrowerListings() {
  const { session, request } = useSession();

  return useQuery({
    queryKey: ownListingsKey(session?.account.id),
    queryFn: ({ signal }) => request<Listing[]>("/listings/my", { signal }),
  });
}

export function listingState(listing: Listing) {
  if (!listing.isActive) return "Unavailable";
  if (listing.status === "CANCELLED") return "Withdrawn";
  return listing.status;
}
