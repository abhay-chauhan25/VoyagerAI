import type { FieldErrors } from "./schemas";

/** State returned by auth server actions to their forms via useActionState. */
export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: FieldErrors;
  /** Echoed non-secret inputs so a failed submit does not wipe what the user typed. */
  values?: Record<string, string>;
};

export const initialFormState: FormState = { status: "idle" };
