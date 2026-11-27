import { useQuery, useQueryClient } from "@tanstack/react-query";
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

export function canEdit(listing: Listing) {
  return listing.isActive && listing.status === "ACTIVE";
}

export function useListingCache() {
  const client = useQueryClient();
  const { session } = useSession();
  const key = ownListingsKey(session?.account.id);
  return async (listing: Listing) => {
    await client.cancelQueries({ queryKey: key, exact: true });
    client.setQueryData<Listing[]>(key, (rows) => {
      if (!rows) return undefined;
      return rows.some((row) => row.id === listing.id)
        ? rows.map((row) => (row.id === listing.id ? listing : row))
        : [listing, ...rows];
    });
    void client.invalidateQueries({
      queryKey: ["marketplace", session?.account.id, "listings"],
    });
    void client.invalidateQueries({
      queryKey: ["marketplace", session?.account.id, "listing"],
    });
  };
}
