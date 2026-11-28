import * as Dialog from "@radix-ui/react-dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError } from "../../shared/api/api-error";
import { FormField } from "../../shared/ui/form-field";
import { useSession } from "../auth/session-context";
import { day } from "../marketplace/ui";
import {
  exactBdt,
  methodLabels,
  paymentPath,
  type Payable,
  type PaymentBody,
  type Submission,
} from "./data";

const schema = z
  .object({
    method: z.enum(["CASH", "BANK_TRANSFER", "MOBILE_FINANCIAL_SERVICE"]),
    paymentDate: z.iso
      .date({ error: "Enter a valid payment date." })
      .refine(
        (date) => !date.startsWith("0000"),
        "Enter a valid payment year.",
      ),
    provider: z.string().trim().toUpperCase(),
    reference: z.string().trim().toUpperCase().max(160),
  })
  .superRefine(({ method, provider, reference }, context) => {
    if (method === "CASH") return;
    if (
      !provider ||
      provider.length > 120 ||
      (method === "MOBILE_FINANCIAL_SERVICE" &&
        !["BKASH", "NAGAD"].includes(provider))
    ) {
      context.addIssue({
        code: "custom",
        path: ["provider"],
        message: "Select or enter the payment provider.",
      });
    }
    if (!reference)
      context.addIssue({
        code: "custom",
        path: ["reference"],
        message: "Enter the transaction reference.",
      });
  });
type Values = z.infer<typeof schema>;
type Draft = { body: PaymentBody; key: string };

export function SubmitPayment({
  payable,
  refresh,
  notify,
}: {
  payable: Payable;
  refresh: () => Promise<boolean>;
  notify: (message: string) => void;
}) {
  const { request } = useSession();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState<"unchecked" | "checked">();
  const [method, setMethod] = useState<Values["method"]>("CASH");
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      method: "CASH",
      paymentDate: "",
      provider: "",
      reference: "",
    },
  });

  async function check() {
    const checked = await refresh();
    setUncertain(checked ? "checked" : "unchecked");
    setError(
      checked
        ? "The API response was interrupted. Check the refreshed settlement. If no submission is reflected, retry this same attempt."
        : "The outcome is unknown. Check payment status again before retrying.",
    );
  }

  async function send() {
    if (!draft || lock.current || uncertain === "unchecked") return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await request<Submission>(paymentPath(payable.orderId) + "/attempts", {
        method: "POST",
        body: draft.body,
        idempotencyKey: draft.key,
        signal: AbortSignal.timeout(15000),
      });
      setUncertain(undefined);
      setOpen(false);
      setDraft(undefined);
      form.reset();
      setMethod("CASH");
      const refreshed = await refresh();
      notify(
        refreshed
          ? "Payment details submitted."
          : "Payment details submitted. Refresh settlement to see the current status.",
      );
    } catch (failure) {
      const ambiguous =
        !(failure instanceof ApiError) ||
        failure.kind === "network" ||
        failure.kind === "response" ||
        (failure.status ?? 0) >= 500;
      if (ambiguous) {
        notify(
          "The submission response was interrupted. Review the current payment status below.",
        );
        await check();
      } else {
        setUncertain(undefined);
        setError(failure.message);
        if ([403, 404, 409].includes(failure.status ?? 0)) {
          notify(failure.message);
          await refresh();
        }
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function review(values: Values) {
    const { method, paymentDate, provider, reference } = values;
    setDraft({
      key: crypto.randomUUID(),
      body: {
        method,
        paymentDate,
        ...(method !== "CASH" && { provider }),
        ...(reference && { reference }),
      },
    });
    setError("");
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (lock.current) return;
        setOpen(next);
        if (!next && !uncertain) {
          setDraft(undefined);
          setError("");
          form.reset();
          setMethod("CASH");
        }
      }}
    >
      <Dialog.Trigger className="button button-leaf">
        {payable.paymentStatus === "REJECTED"
          ? "Submit another payment attempt"
          : "Submit payment details"}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="menu-overlay" />
        <Dialog.Content className="grower-dialog max-h-[85dvh] overflow-y-auto">
          <Dialog.Title>
            {draft ? "Confirm payment submission" : "Submit payment details"}
          </Dialog.Title>
          <Dialog.Description>
            Order #{payable.orderId} · {exactBdt(payable.amountBdt)}. This
            records your payment details for grower review.
          </Dialog.Description>
          {draft ? (
            <>
              <dl className="market-facts">
                <div>
                  <dt>Method</dt>
                  <dd>{methodLabels[draft.body.method]}</dd>
                </div>
                <div>
                  <dt>Payment date</dt>
                  <dd>{day(draft.body.paymentDate)}</dd>
                </div>
                {draft.body.provider && (
                  <div>
                    <dt>Provider</dt>
                    <dd className="wrap-break-word">{draft.body.provider}</dd>
                  </div>
                )}
                {draft.body.reference && (
                  <div>
                    <dt>Reference</dt>
                    <dd className="wrap-break-word">{draft.body.reference}</dd>
                  </div>
                )}
              </dl>
              {error && (
                <p role="alert" className="field-error">
                  {error}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {uncertain ? (
                  <Dialog.Close
                    className="button button-outline"
                    disabled={busy}
                  >
                    Close
                  </Dialog.Close>
                ) : (
                  <button
                    type="button"
                    className="button button-outline"
                    disabled={busy}
                    onClick={() => setDraft(undefined)}
                  >
                    Edit details
                  </button>
                )}
                {uncertain === "unchecked" ? (
                  <button
                    type="button"
                    className="button button-leaf"
                    disabled={busy}
                    onClick={async () => {
                      if (lock.current) return;
                      lock.current = true;
                      setBusy(true);
                      try {
                        await check();
                      } finally {
                        lock.current = false;
                        setBusy(false);
                      }
                    }}
                  >
                    {busy ? "Checking…" : "Check payment status"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="button button-leaf"
                    disabled={busy}
                    onClick={() => void send()}
                  >
                    {busy
                      ? "Submitting…"
                      : uncertain
                        ? "Retry same attempt"
                        : "Confirm submission"}
                  </button>
                )}
              </div>
            </>
          ) : (
            <form
              noValidate
              onSubmit={form.handleSubmit(review)}
              className="space-y-4"
            >
              <label className="market-filters">
                Payment method
                <select
                  {...form.register("method", {
                    onChange: (event) => {
                      setMethod(event.target.value);
                      form.setValue("provider", "");
                      form.clearErrors("provider");
                    },
                  })}
                >
                  {Object.entries(methodLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <FormField
                label="Payment date"
                type="date"
                error={form.formState.errors.paymentDate?.message}
                {...form.register("paymentDate")}
              />
              {method === "BANK_TRANSFER" && (
                <FormField
                  label="Bank provider"
                  maxLength={120}
                  error={form.formState.errors.provider?.message}
                  {...form.register("provider")}
                />
              )}
              {method === "MOBILE_FINANCIAL_SERVICE" && (
                <div>
                  <label className="market-filters">
                    Mobile provider
                    <select
                      aria-invalid={!!form.formState.errors.provider}
                      aria-describedby={
                        form.formState.errors.provider
                          ? "mobile-provider-error"
                          : undefined
                      }
                      {...form.register("provider")}
                    >
                      <option value="">Choose a provider</option>
                      <option value="BKASH">bKash</option>
                      <option value="NAGAD">Nagad</option>
                    </select>
                  </label>
                  {form.formState.errors.provider && (
                    <p id="mobile-provider-error" className="field-error">
                      {form.formState.errors.provider.message}
                    </p>
                  )}
                </div>
              )}
              <FormField
                label={
                  method === "CASH"
                    ? "Reference (optional)"
                    : "Transaction reference"
                }
                maxLength={160}
                error={form.formState.errors.reference?.message}
                {...form.register("reference")}
              />
              <div className="flex flex-wrap gap-2">
                <Dialog.Close className="button button-outline">
                  Cancel
                </Dialog.Close>
                <button className="button button-leaf">
                  Review submission
                </button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
