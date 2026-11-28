import * as Dialog from "@radix-ui/react-dialog";
import { useId, useRef, useState } from "react";
import { ApiError } from "../../shared/api/api-error";
import { useSession } from "../auth/session-context";
import type { Order } from "../orders/history";
import { exactBdt, paymentPath, type Attempt, type Payable } from "./data";

type Action = "confirm" | "reject" | "complete";
const title = {
  confirm: "Confirm receipt",
  reject: "Reject payment",
  complete: "Complete order",
};
const success = {
  confirm: "Receipt confirmed.",
  reject: "Payment rejected.",
  complete: "Order completed.",
};

type Props = {
  payable: Payable;
  refresh: () => Promise<boolean>;
  notify: (message: string) => void;
} & ({ mode: "receipt"; attempt: Attempt } | { mode: "completion" });

export function SettlementActions(props: Props) {
  const { payable, refresh, notify } = props;
  const { request } = useSession();
  const [action, setAction] = useState<Action>();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [invalidReason, setInvalidReason] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const reasonId = useId();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action || lock.current) return;
    const rejectionReason = reason.trim();
    if (
      action === "reject" &&
      (!rejectionReason || rejectionReason.length > 1000)
    ) {
      setInvalidReason(true);
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (action === "complete") {
        await request<Order>(`/orders/${payable.orderId}/status`, {
          method: "PATCH",
          body: { orderStatus: "COMPLETED" },
        });
      } else if (props.mode === "receipt") {
        await request<Attempt>(
          `${paymentPath(payable.orderId)}/attempts/${props.attempt.id}/${action}`,
          {
            method: "PATCH",
            body: action === "reject" ? { rejectionReason } : {},
          },
        );
      }
      setAction(undefined);
      const refreshed = await refresh();
      notify(
        success[action] +
          (refreshed ? "" : " Refresh settlement to see the current status."),
      );
    } catch (failure) {
      const message =
        failure instanceof ApiError
          ? failure.message
          : "Unable to save the decision.";
      setError(message);
      notify(message);
      await refresh();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const actions: Action[] =
    props.mode === "completion" ? ["complete"] : ["confirm", "reject"];
  return (
    <div className="space-y-3">
      {props.mode === "completion" && (
        <p>
          Payment is confirmed. Complete the order to finalize the sale and mark
          the listing as sold.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {actions.map((item) => (
          <button
            key={item}
            type="button"
            className={
              "button " + (item === "reject" ? "button-outline" : "button-leaf")
            }
            onClick={(event) => {
              trigger.current = event.currentTarget;
              setReason("");
              setError("");
              setInvalidReason(false);
              setAction(item);
            }}
          >
            {title[item]}
          </button>
        ))}
      </div>
      <Dialog.Root
        open={!!action}
        onOpenChange={(open) => {
          if (!open && !lock.current) setAction(undefined);
        }}
      >
        {action && (
          <Dialog.Portal>
            <Dialog.Overlay className="menu-overlay" />
            <Dialog.Content
              className="grower-dialog max-h-[85dvh] overflow-y-auto"
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                (trigger.current?.isConnected
                  ? trigger.current
                  : document.getElementById("settlement-heading")
                )?.focus();
              }}
            >
              <Dialog.Title>{title[action]}?</Dialog.Title>
              <Dialog.Description>
                Order #{payable.orderId} · {exactBdt(payable.amountBdt)}.
                {action === "complete" &&
                  " The backend will complete the order and mark the harvest listing as sold."}
                {action === "confirm" &&
                  " Confirm only after receiving the payment."}
                {action === "reject" &&
                  " The factory will see your reason and can submit another attempt."}
              </Dialog.Description>
              <form
                className="space-y-3"
                onSubmit={(event) => void submit(event)}
                noValidate
              >
                {action === "reject" && (
                  <div className="form-field">
                    <label htmlFor={reasonId}>Rejection reason</label>
                    <textarea
                      id={reasonId}
                      className="w-full rounded border p-2"
                      value={reason}
                      maxLength={1000}
                      required
                      rows={3}
                      aria-invalid={invalidReason}
                      aria-describedby={
                        invalidReason ? reasonId + "-error" : undefined
                      }
                      onChange={(event) => {
                        setReason(event.target.value);
                        setInvalidReason(false);
                      }}
                    />
                    {invalidReason && (
                      <p id={reasonId + "-error"} className="field-error">
                        Enter a rejection reason of 1–1,000 characters.
                      </p>
                    )}
                  </div>
                )}
                {error && (
                  <p role="alert" className="field-error">
                    {error}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Dialog.Close
                    className="button button-outline"
                    disabled={busy}
                  >
                    Cancel
                  </Dialog.Close>
                  <button className="button button-leaf" disabled={busy}>
                    {busy ? "Saving…" : title[action]}
                  </button>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </Dialog.Root>
    </div>
  );
}
