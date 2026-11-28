import * as Dialog from "@radix-ui/react-dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormField } from "../../shared/ui/form-field";
import { day, kg } from "../marketplace/ui";
import {
  usePickupTransition,
  type PickupActionProps,
} from "./pickup-transition";

const schema = z.object({
  weight: z
    .string()
    .trim()
    .refine(
      (value) =>
        /^\d+(?:\.\d{1,3})?$/.test(value) &&
        Number(value) >= 0.001 &&
        Number(value) <= 9999999.999,
      "Enter 0.001 to 9,999,999.999 kg with up to three decimal places.",
    ),
});

export function RecordCollection(props: PickupActionProps) {
  const { order } = props;
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState<string>();
  const { mutation, submit, busy } = usePickupTransition(props);
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { weight: "" },
  });

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (busy.current) return;
        setOpen(next);
        if (!next) {
          form.reset();
          mutation.reset();
          setReview(undefined);
        }
      }}
    >
      <Dialog.Trigger className="button button-leaf">
        Record collection
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="menu-overlay" />
        <Dialog.Content className="grower-dialog max-h-[85dvh] overflow-y-auto">
          <Dialog.Title>
            {review ? "Confirm collected weight" : "Record collection"}
          </Dialog.Title>
          <Dialog.Description>
            Order #{order.id} · {kg(order.estimatedQuantityKg)} estimated
            harvest
          </Dialog.Description>
          {order.proposedCollectionDate && (
            <p>
              Pickup: {day(order.proposedCollectionDate)} ·{" "}
              {order.collectionPoint}
            </p>
          )}
          {review ? (
            <>
              <p>
                Save <strong>{kg(Number(review))}</strong> as the actual
                collected weight? This records collection and keeps the original
                estimate unchanged.
              </p>
              {mutation.error && (
                <p role="alert" className="field-error">
                  {mutation.error.message}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="button button-outline"
                  disabled={mutation.isPending}
                  onClick={() => setReview(undefined)}
                >
                  Edit weight
                </button>
                <button
                  type="button"
                  className="button button-leaf"
                  disabled={mutation.isPending}
                  onClick={() =>
                    submit({
                      orderStatus: "COLLECTED",
                      actualCollectedWeightKg: Number(review),
                    })
                  }
                >
                  {mutation.isPending ? "Saving…" : "Confirm collection"}
                </button>
              </div>
            </>
          ) : (
            <form
              noValidate
              className="space-y-4"
              onSubmit={form.handleSubmit(({ weight }) => {
                mutation.reset();
                setReview(weight);
              })}
            >
              <FormField
                label="Actual collected weight (kg)"
                inputMode="decimal"
                hint="Enter the measured weight to up to three decimal places."
                error={form.formState.errors.weight?.message}
                {...form.register("weight")}
              />
              <div className="flex flex-wrap gap-2">
                <Dialog.Close className="button button-outline">
                  Cancel
                </Dialog.Close>
                <button className="button button-leaf">
                  Review collected weight
                </button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
