import { zodResolver } from "@hookform/resolvers/zod";
import { useRef, type ComponentProps } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormField } from "../../shared/ui/form-field";
import { ApiError } from "../../shared/api/api-error";
import type { Listing } from "../marketplace/contracts";

const civilDate = z.iso.date({ error: "Enter a valid date." });
const schema = z.object({
  teaGrade: z.string().trim().min(1, "Enter a tea grade.").max(100),
  estimatedQuantityKg: z
    .string()
    .trim()
    .refine(
      (value) => /^\d{1,7}(?:\.\d{1,3})?$/.test(value) && Number(value) > 0,
      "Enter a positive weight with up to seven whole digits and three decimal places.",
    )
    .transform(Number),
  expectedHarvestDate: civilDate,
  lastHarvestDate: z.union([z.literal(""), civilDate]),
  collectionLocation: z
    .string()
    .trim()
    .min(1, "Enter a collection location.")
    .max(255),
  qualityDescription: z.string().trim(),
  notes: z.string().trim(),
});

type Input = z.input<typeof schema>;
type Output = z.output<typeof schema>;

export type ListingBody = Omit<
  Output,
  "lastHarvestDate" | "qualityDescription" | "notes"
> & {
  lastHarvestDate?: string | null;
  qualityDescription?: string | null;
  notes?: string | null;
};

const fields: {
  key: keyof Input;
  label: string;
  type?: ComponentProps<"input">["type"];
  inputMode?: ComponentProps<"input">["inputMode"];
  hint?: string;
}[] = [
  {
    key: "teaGrade",
    label: "Tea grade",
    hint: "Use the grade or variety growers and factories recognize, such as CTC.",
  },
  {
    key: "estimatedQuantityKg",
    label: "Estimated quantity (kg)",
    inputMode: "decimal",
    hint: "Enter the expected weight of this harvest in kilograms.",
  },
  { key: "expectedHarvestDate", label: "Expected harvest date", type: "date" },
  {
    key: "collectionLocation",
    label: "Collection location",
    hint: "Enter the location or address where leaves can be collected.",
  },
  {
    key: "lastHarvestDate",
    label: "Last harvest date (optional)",
    type: "date",
  },
  { key: "qualityDescription", label: "Quality description (optional)" },
  { key: "notes", label: "Notes (optional)" },
];

export function ListingForm({
  listing,
  save,
}: {
  listing?: Listing;
  save: (body: ListingBody) => Promise<void>;
}) {
  const inFlight = useRef(false);
  const form = useForm<Input, unknown, Output>({
    resolver: zodResolver(schema),
    defaultValues: {
      teaGrade: listing?.teaGrade ?? "",
      estimatedQuantityKg: listing ? String(listing.estimatedQuantityKg) : "",
      expectedHarvestDate: listing?.expectedHarvestDate ?? "",
      lastHarvestDate: listing?.lastHarvestDate ?? "",
      collectionLocation: listing?.collectionLocation ?? "",
      qualityDescription: listing?.qualityDescription ?? "",
      notes: listing?.notes ?? "",
    },
  });
  const { errors, isSubmitting } = form.formState;
  const submit = form.handleSubmit(async (values) => {
    form.clearErrors("root");
    const { lastHarvestDate, qualityDescription, notes, ...required } = values;
    try {
      await save({
        ...required,
        lastHarvestDate: lastHarvestDate || (listing ? null : undefined),
        qualityDescription: qualityDescription || (listing ? null : undefined),
        notes: notes || (listing ? null : undefined),
      });
    } catch (error) {
      form.setError("root", {
        message:
          error instanceof ApiError
            ? error.message
            : "Could not save the listing.",
      });
    }
  });
  return (
    <form
      className="account-card"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        if (inFlight.current) return;
        inFlight.current = true;
        try {
          await submit(event);
        } finally {
          inFlight.current = false;
        }
      }}
      aria-busy={isSubmitting}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map(({ key, label, type, inputMode, hint }) => (
          <FormField
            key={key}
            label={label}
            type={type}
            inputMode={inputMode}
            hint={hint}
            error={errors[key]?.message}
            {...form.register(key)}
          />
        ))}
      </div>
      {errors.root?.message && (
        <p role="alert" className="field-error">
          {errors.root.message}
        </p>
      )}
      <button className="button button-green" disabled={isSubmitting}>
        {isSubmitting
          ? "Saving…"
          : listing
            ? "Save changes"
            : "Publish listing"}
      </button>
    </form>
  );
}
