import * as Dialog from "@radix-ui/react-dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormField } from "../../shared/ui/form-field";
import { useSession } from "../auth/session-context";
import { bdt, todayInBangladesh } from "../marketplace/offers";
import { day, kg } from "../marketplace/ui";
import type { Order } from "./history";
import { RecordCollection } from "./collection-action";
import {
  usePickupTransition,
  type DetailKey,
  type PickupActionProps,
} from "./pickup-transition";

const pickupSchema = z.object({
  proposedCollectionDate: z.iso
    .date({ error: "Enter a valid pickup date." })
    .refine((date) => !date.startsWith("0000"), "Enter a valid pickup year."),
  collectionPoint: z
    .string()
    .trim()
    .min(1, "Enter the collection point.")
    .max(255),
  pickupNotes: z.string(),
  estimatedTransportCostBdt: z
    .string()
    .trim()
    .refine(
      (value) =>
        value === "" ||
        (/^\d+(?:\.\d{1,2})?$/.test(value) && Number(value) <= 9999999999.99),
      "Enter a non-negative BDT amount up to 9,999,999,999.99 with at most two decimal places.",
    ),
});

type PickupValues = z.infer<typeof pickupSchema>;

export function PickupDetails({
  order,
  detailKey,
}: {
  order: Order;
  detailKey: DetailKey;
}) {
  const { session } = useSession();
  const [notice, setNotice] = useState("");
  const [conflict, setConflict] = useState<{
    status: Order["orderStatus"];
    message: string;
  }>();
  const factory = session?.account.role === "FACTORY";
  const onConflict = (message: string) =>
    setConflict({ status: order.orderStatus, message });
  return (
    <section
      className="market-card space-y-4"
      aria-label="Pickup and collection"
    >
      <h2>Pickup and collection</h2>
      {notice && <p role="status">{notice}</p>}
      {conflict && conflict.status !== order.orderStatus && (
        <p role="alert" className="field-error">
          {conflict.message}
        </p>
      )}
      <dl className="market-facts">
        <div>
          <dt>Scheduled pickup date</dt>
          <dd>
            {order.proposedCollectionDate
              ? day(order.proposedCollectionDate)
              : "Not scheduled"}
          </dd>
        </div>
        {order.collectionPoint && (
          <div>
            <dt>Collection point</dt>
            <dd>{order.collectionPoint}</dd>
          </div>
        )}
        {order.estimatedTransportCostBdt !== null && (
          <div>
            <dt>Estimated transport</dt>
            <dd>{bdt(order.estimatedTransportCostBdt)}</dd>
          </div>
        )}
        {order.pickupNotes && (
          <div>
            <dt>Pickup notes</dt>
            <dd className="wrap-break-word whitespace-pre-wrap">
              {order.pickupNotes}
            </dd>
          </div>
        )}
        <div>
          <dt>Actual collected weight</dt>
          <dd>
            {order.actualCollectedWeightKg === null
              ? "Not recorded"
              : kg(order.actualCollectedWeightKg)}
          </dd>
        </div>
      </dl>
      {factory && order.orderStatus === "ACCEPTED" && (
        <SchedulePickup
          order={order}
          detailKey={detailKey}
          onSaved={() => {
            setConflict(undefined);
            setNotice("Pickup scheduled.");
          }}
          onConflict={onConflict}
        />
      )}
      {factory && order.orderStatus === "PICKUP_SCHEDULED" && (
        <RecordCollection
          order={order}
          detailKey={detailKey}
          onSaved={() => {
            setConflict(undefined);
            setNotice("Collection recorded.");
          }}
          onConflict={onConflict}
        />
      )}
    </section>
  );
}

function SchedulePickup(props: PickupActionProps) {
  const { order } = props;
  const { mutation: save, submit, busy } = usePickupTransition(props);
  const [review, setReview] = useState<PickupValues>();
  const [editing, setEditing] = useState(false);
  const form = useForm<PickupValues>({
    resolver: zodResolver(pickupSchema),
    defaultValues: {
      proposedCollectionDate: "",
      collectionPoint: "",
      pickupNotes: "",
      estimatedTransportCostBdt: "",
    },
  });
  const errors = form.formState.errors;

  return (
    <Dialog.Root
      open={editing}
      onOpenChange={(open) => {
        if (busy.current) return;
        setEditing(open);
        if (!open) {
          form.reset();
          save.reset();
          setReview(undefined);
        }
      }}
    >
      <Dialog.Trigger className="button button-leaf">
        Schedule pickup
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="menu-overlay" />
        <Dialog.Content className="grower-dialog max-h-[85dvh] overflow-y-auto">
          <Dialog.Title>
            {review ? "Confirm pickup schedule" : "Schedule pickup"}
          </Dialog.Title>
          <Dialog.Description>
            Order #{order.id} · {order.harvestListing.teaGrade} ·{" "}
            {kg(order.estimatedQuantityKg)} estimated harvest
          </Dialog.Description>
          {review ? (
            <>
              <dl className="market-facts">
                <div>
                  <dt>Pickup date</dt>
                  <dd>{day(review.proposedCollectionDate)}</dd>
                </div>
                <div>
                  <dt>Collection point</dt>
                  <dd>{review.collectionPoint}</dd>
                </div>
                {review.estimatedTransportCostBdt && (
                  <div>
                    <dt>Estimated transport</dt>
                    <dd>{bdt(Number(review.estimatedTransportCostBdt))}</dd>
                  </div>
                )}
                {review.pickupNotes && (
                  <div>
                    <dt>Pickup notes</dt>
                    <dd className="wrap-break-word whitespace-pre-wrap">
                      {review.pickupNotes}
                    </dd>
                  </div>
                )}
              </dl>
              {review.proposedCollectionDate < todayInBangladesh() && (
                <p className="field-error">
                  This date has already passed in Bangladesh. Check it before
                  confirming.
                </p>
              )}
              {save.error && (
                <p role="alert" className="field-error">
                  {save.error.message}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="button button-outline"
                  disabled={save.isPending}
                  onClick={() => setReview(undefined)}
                >
                  Edit schedule
                </button>
                <button
                  type="button"
                  className="button button-leaf"
                  disabled={save.isPending}
                  onClick={() => {
                    submit({
                      orderStatus: "PICKUP_SCHEDULED",
                      proposedCollectionDate: review.proposedCollectionDate,
                      collectionPoint: review.collectionPoint,
                      pickupNotes: review.pickupNotes || undefined,
                      estimatedTransportCostBdt:
                        review.estimatedTransportCostBdt === ""
                          ? undefined
                          : Number(review.estimatedTransportCostBdt),
                    });
                  }}
                >
                  {save.isPending ? "Saving…" : "Confirm pickup"}
                </button>
              </div>
            </>
          ) : (
            <form
              noValidate
              className="space-y-4"
              onSubmit={form.handleSubmit((values) => {
                save.reset();
                setReview(values);
              })}
            >
              <FormField
                label="Pickup date"
                type="date"
                hint="Bangladesh calendar date. A pickup time is not stored."
                error={errors.proposedCollectionDate?.message}
                {...form.register("proposedCollectionDate")}
              />
              <FormField
                label="Collection point"
                maxLength={255}
                error={errors.collectionPoint?.message}
                {...form.register("collectionPoint")}
              />
              <FormField
                label="Pickup notes (optional)"
                {...form.register("pickupNotes")}
              />
              <FormField
                label="Estimated transport (BDT, optional)"
                inputMode="decimal"
                error={errors.estimatedTransportCostBdt?.message}
                {...form.register("estimatedTransportCostBdt")}
              />
              <div className="flex flex-wrap gap-2">
                <Dialog.Close className="button button-outline">
                  Cancel
                </Dialog.Close>
                <button className="button button-leaf">Review schedule</button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
