import { useId, type ComponentProps } from "react";

type TextFieldProps = Omit<ComponentProps<"input">, "id"> & {
  label: string;
  name: string;
  /** Rules the value must meet; always visible and tied to the input for screen readers. */
  hint?: string;
  error?: string;
};

/** Label above the field, hint and error tied to the input with aria-describedby. */
export function TextField({
  label,
  name,
  hint,
  error,
  className = "",
  ...inputProps
}: TextFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={id} className="text-ui font-semibold text-ink">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`min-h-11 rounded-control border bg-panel px-3 text-body text-ink transition-[border-color] duration-150 placeholder:text-muted focus-visible:border-accent focus-visible:outline-none ${
          error ? "border-negative" : "border-control"
        }`}
        {...inputProps}
      />
      {hint ? (
        <p id={hintId} className="text-meta text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-meta font-semibold text-negative">
          {error}
        </p>
      ) : null}
    </div>
  );
}
