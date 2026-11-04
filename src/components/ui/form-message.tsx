import type { FormState } from "@/lib/auth/form-state";

/** Form-level message (not tied to one field). Announced politely to assistive tech. */
export function FormMessage({ state }: { state: FormState }) {
  if (!state.message) return <div aria-live="polite" />;
  const tone =
    state.status === "error" ? "bg-negative-bg text-negative" : "bg-raised text-positive";
  return (
    <div aria-live="polite">
      <p
        role={state.status === "error" ? "alert" : "status"}
        className={`rounded-control px-3 py-2.5 text-ui font-semibold ${tone}`}
      >
        {state.message}
      </p>
    </div>
  );
}
