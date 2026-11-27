import { useId, type ComponentProps } from "react";

export function FormField({
  label,
  error,
  hint,
  ...input
}: ComponentProps<"input"> & { label: string; error?: string; hint?: string }) {
  const id = useId();
  const description = [hint && id + "-hint", error && id + "-error"]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <input
        {...input}
        id={id}
        aria-invalid={!!error}
        aria-describedby={description || undefined}
      />
      {hint && (
        <p id={id + "-hint"} className="text-sm text-ink/75">
          {hint}
        </p>
      )}
      {error && (
        <p id={id + "-error"} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
