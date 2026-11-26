import { useId, type ComponentProps } from "react";

export function FormField({
  label,
  error,
  ...input
}: ComponentProps<"input"> & { label: string; error?: string }) {
  const id = useId();
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <input
        {...input}
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? id + "-error" : undefined}
      />
      {error && (
        <p id={id + "-error"} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
