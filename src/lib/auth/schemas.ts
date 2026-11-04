import { z } from "zod";

/** Password rules mirror supabase/config.toml (minimum_password_length, password_requirements). */
export const PASSWORD_MIN_LENGTH = 8;
// bcrypt, which Supabase Auth uses, ignores bytes past 72; reject rather than silently truncate.
export const PASSWORD_MAX_LENGTH = 72;
export const DISPLAY_NAME_MAX_LENGTH = 60;
export const TRIP_IDEA_MAX_LENGTH = 60;

const email = z
  .string({ error: "Enter your email address." })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Enter a valid email address." }).max(254, "That email is too long."));

const password = z
  .string({ error: "Enter a password." })
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(PASSWORD_MAX_LENGTH, `Use at most ${PASSWORD_MAX_LENGTH} characters.`)
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/\d/, "Include at least one number.");

const displayName = z
  .string({ error: "Tell us what to call you." })
  .trim()
  .min(1, "Tell us what to call you.")
  .max(DISPLAY_NAME_MAX_LENGTH, `Keep it under ${DISPLAY_NAME_MAX_LENGTH} characters.`);

const tripIdea = z
  .string()
  .trim()
  .max(TRIP_IDEA_MAX_LENGTH, `Keep it under ${TRIP_IDEA_MAX_LENGTH} characters.`)
  .optional()
  .transform((value) => (value ? value : undefined));

export const signUpSchema = z.object({ displayName, email, password, tripIdea });
export const signInSchema = z.object({
  email,
  // Sign-in checks only presence: strength rules apply when a password is set, not when it is used.
  password: z.string({ error: "Enter your password." }).min(1, "Enter your password."),
});
export const magicLinkSchema = z.object({ email });
export const profileSchema = z.object({
  displayName,
  homeCity: z
    .string()
    .trim()
    .max(80, "Keep it under 80 characters.")
    .transform((value) => (value ? value : null)),
});

export type FieldErrors = Partial<Record<string, string>>;

/** Flattens zod issues into one message per field, keeping the first (most basic) problem. */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    errors[field] ??= issue.message;
  }
  return errors;
}

/** Reads named string fields from FormData; non-string entries (files) are treated as missing. */
export function readFields<K extends string>(
  formData: FormData,
  keys: readonly K[],
): Record<K, string | undefined> {
  const out = {} as Record<K, string | undefined>;
  for (const key of keys) {
    const value = formData.get(key);
    out[key] = typeof value === "string" ? value : undefined;
  }
  return out;
}
