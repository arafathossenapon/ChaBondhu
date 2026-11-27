import * as Dialog from "@radix-ui/react-dialog";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "../../shared/api/api-error";
import { useSession } from "../auth/session-context";
import type { Listing } from "../marketplace/contracts";
import { useListingCache } from "./listings";

export function WithdrawListing({
  listing,
  refresh,
  onWithdrawn,
}: {
  listing: Listing;
  refresh: () => void;
  onWithdrawn: () => void;
}) {
  const { request } = useSession();
  const updateCache = useListingCache();
  const [open, setOpen] = useState(false);
  const eligible = listing.status === "ACTIVE" || listing.status === "EXPIRED";
  const mutation = useMutation({
    mutationFn: () =>
      request<Listing>("/listings/" + listing.id + "/cancel", {
        method: "PATCH",
      }),
    onSuccess: async (updated) => {
      await updateCache(updated);
      onWithdrawn();
      setOpen(false);
      refresh();
    },
    onError: (error) => {
      if (
        error instanceof ApiError &&
        [403, 404, 409].includes(error.status ?? 0)
      )
        refresh();
    },
  });

  return (
    <>
      <Dialog.Root
        open={open}
        onOpenChange={(next) => {
          if (mutation.isPending) return;
          if (next) mutation.reset();
          setOpen(next);
        }}
      >
        {eligible && (
          <Dialog.Trigger className="button button-outline">
            Withdraw listing
          </Dialog.Trigger>
        )}
        <Dialog.Portal>
          <Dialog.Overlay className="menu-overlay" />
          <Dialog.Content className="grower-dialog">
            <Dialog.Title className="text-xl font-semibold">
              Withdraw harvest listing?
            </Dialog.Title>
            <Dialog.Description>
              This removes the listing from marketplace discovery and closes any
              pending requests for it. You’ll still see it in My listings.
            </Dialog.Description>
            {mutation.isError && (
              <p role="alert" className="field-error">
                {mutation.error instanceof ApiError
                  ? mutation.error.message
                  : "Could not withdraw this listing. Try again."}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-3">
              <Dialog.Close
                className="button button-outline"
                disabled={mutation.isPending}
              >
                Keep listing
              </Dialog.Close>
              <button
                type="button"
                className="button bg-red-800 text-white hover:bg-red-900"
                disabled={!eligible || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? "Withdrawing…" : "Confirm withdrawal"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
