import * as Dialog from "@radix-ui/react-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ApiError } from "../../shared/api/api-error";
import { FormField } from "../../shared/ui/form-field";
import { useSession } from "../auth/session-context";
import { todayInBangladesh } from "../marketplace/offers";
import { profileKey } from "../profiles/own-profile";
import { ownedOffersPrefix, type OwnedOffer } from "./data";

export type OfferAction =
  { mode: "create" } | { mode: "edit" | "withdraw"; offer: OwnedOffer };
const titles = {
  create: "Publish offer",
  edit: "Edit offer",
  withdraw: "Withdraw offer",
};
const limit = 9999999999.99;
function decimal(value: string, scale: number, min: number, max: number) {
  return (
    new RegExp("^\\d+(?:\\.\\d{1," + scale + "})?$").test(value) &&
    Number(value) >= min &&
    Number(value) <= max
  );
}
const schema = z.object({
  teaGrade: z.string().trim().min(1, "Enter a tea grade.").max(100),
  pricePerKg: z
    .string()
    .trim()
    .refine(
      (n) => decimal(n, 2, 0.01, limit),
      "Enter a positive BDT price with up to two decimal places.",
    ),
  minimumQuantityKg: z
    .string()
    .trim()
    .refine(
      (n) => !n || decimal(n, 3, 0.001, 9999999.999),
      "Enter a positive weight with up to three decimal places.",
    ),
  validUntil: z.iso.date({ error: "Enter a valid expiry date." }),
  notes: z.string().trim(),
  qualityRequirements: z.string().trim(),
  estimatedTransportCostBdt: z
    .string()
    .trim()
    .refine(
      (n) => !n || decimal(n, 2, 0, limit),
      "Enter a BDT amount with up to two decimal places.",
    ),
});
type Values = z.infer<typeof schema>;

export function OfferDialog({
  action,
  close,
  onSuccess,
  allowed,
}: {
  action: OfferAction;
  allowed: boolean;
  close: () => void;
  onSuccess: (message: string) => void;
}) {
  const { request, session } = useSession();
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const { mode } = action;
  const title = titles[mode];

  async function save(body?: object) {
    if (!allowed || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    const id = session?.account.id;
    try {
      if (action.mode === "create")
        await request("/offers", { method: "POST", body });
      else if (action.mode === "edit")
        await request("/offers/" + action.offer.id, { method: "PATCH", body });
      else
        await request("/offers/" + action.offer.id + "/withdraw", {
          method: "PATCH",
        });
      await Promise.all([
        cache.invalidateQueries({ queryKey: ownedOffersPrefix(id) }),
        cache.invalidateQueries({ queryKey: ["marketplace", id, "offers"] }),
        cache.invalidateQueries({ queryKey: ["marketplace", id, "offer"] }),
      ]);
      onSuccess(
        mode === "create"
          ? "Offer published."
          : mode === "edit"
            ? "Offer updated."
            : "Offer withdrawn.",
      );
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? failure.message
          : "Could not save the offer. Try again.",
      );
      if (failure instanceof ApiError) {
        if (failure.status === 403)
          void cache.invalidateQueries({ queryKey: profileKey(id, "factory") });
        if ([403, 404, 409].includes(failure.status ?? 0))
          void cache.invalidateQueries({ queryKey: ownedOffersPrefix(id) });
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="menu-overlay" />
        <Dialog.Content className="grower-dialog max-h-[90dvh] overflow-auto">
          <Dialog.Title className="text-xl font-semibold">{title}</Dialog.Title>
          <Dialog.Description>
            {mode === "withdraw"
              ? "The offer will disappear from marketplace discovery and remain in My offers as withdrawn."
              : "Use prices in BDT and an expiry date after today in Bangladesh if you set a new date."}
          </Dialog.Description>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          {mode === "withdraw" ? (
            <div className="flex flex-wrap gap-3">
              <Dialog.Close className="button button-outline" disabled={busy}>
                Keep offer
              </Dialog.Close>
              <button
                className="button bg-red-800 text-white hover:bg-red-900"
                disabled={!allowed || busy}
                onClick={() => void save()}
              >
                {busy ? "Withdrawing…" : "Confirm withdrawal"}
              </button>
            </div>
          ) : (
            <OfferForm
              offer={mode === "edit" ? action.offer : undefined}
              save={save}
              busy={busy}
              allowed={allowed}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function OfferForm({
  offer,
  save,
  busy,
  allowed,
}: {
  offer?: OwnedOffer;
  save: (body: object) => Promise<void>;
  busy: boolean;
  allowed: boolean;
}) {
  const defaults: Values = {
    teaGrade: offer?.teaGrade ?? "",
    pricePerKg: offer ? String(offer.pricePerKg) : "",
    minimumQuantityKg: String(offer?.minimumQuantityKg ?? ""),
    validUntil: offer?.validUntil ?? "",
    notes: offer?.notes ?? "",
    qualityRequirements: offer?.qualityRequirements ?? "",
    estimatedTransportCostBdt: String(offer?.estimatedTransportCostBdt ?? ""),
  };
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting } = form.formState;
  const locked = busy || isSubmitting;
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={form.handleSubmit(async (values) => {
        form.clearErrors("root");
        if (
          values.validUntil !== offer?.validUntil &&
          values.validUntil <= todayInBangladesh()
        ) {
          form.setError(
            "validUntil",
            { message: "Choose a date after today in Bangladesh." },
            { shouldFocus: true },
          );
          return;
        }
        const price = Number(values.pricePerKg);
        const minimum = values.minimumQuantityKg
          ? Number(values.minimumQuantityKg)
          : null;
        const notes = values.notes || null;
        if (!offer) {
          await save({
            teaGrade: values.teaGrade,
            pricePerKg: price,
            validUntil: values.validUntil,
            minimumQuantityKg: minimum,
            qualityRequirements: values.qualityRequirements || null,
            notes,
            estimatedTransportCostBdt: values.estimatedTransportCostBdt
              ? Number(values.estimatedTransportCostBdt)
              : null,
          });
          return;
        }
        const changed = {
          ...(price !== offer.pricePerKg && { pricePerKg: price }),
          ...(minimum !== offer.minimumQuantityKg && {
            minimumQuantityKg: minimum,
          }),
          ...(values.validUntil !== offer.validUntil && {
            validUntil: values.validUntil,
          }),
          ...(notes !== (offer.notes || null) && { notes }),
        };
        if (!Object.keys(changed).length) {
          form.setError("root", { message: "Change a field before saving." });
          return;
        }
        await save(changed);
      })}
    >
      {!offer && (
        <FormField
          label="Tea grade"
          error={errors.teaGrade?.message}
          {...form.register("teaGrade")}
        />
      )}
      <FormField
        label="Price (BDT per kg)"
        inputMode="decimal"
        error={errors.pricePerKg?.message}
        {...form.register("pricePerKg")}
      />
      <FormField
        label="Minimum quantity (kg, optional)"
        inputMode="decimal"
        error={errors.minimumQuantityKg?.message}
        {...form.register("minimumQuantityKg")}
      />
      <FormField
        label="Valid until"
        type="date"
        error={errors.validUntil?.message}
        {...form.register("validUntil")}
      />
      {!offer && (
        <>
          <FormField
            label="Quality requirements (optional)"
            error={errors.qualityRequirements?.message}
            {...form.register("qualityRequirements")}
          />
          <FormField
            label="Estimated transport (BDT, optional)"
            inputMode="decimal"
            error={errors.estimatedTransportCostBdt?.message}
            {...form.register("estimatedTransportCostBdt")}
          />
        </>
      )}
      <FormField
        label="Notes (optional)"
        error={errors.notes?.message}
        {...form.register("notes")}
      />
      {errors.root?.message && (
        <p role="alert" className="field-error">
          {errors.root.message}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Dialog.Close
          type="button"
          className="button button-outline"
          disabled={locked}
        >
          Cancel
        </Dialog.Close>
        <button className="button button-green" disabled={!allowed || locked}>
          {locked ? "Saving…" : offer ? "Save changes" : "Publish offer"}
        </button>
      </div>
    </form>
  );
}
