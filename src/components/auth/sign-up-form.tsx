"use client";

import { useActionState } from "react";
import { signUp } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/auth/form-state";
import { PASSWORD_MIN_LENGTH, TRIP_IDEA_MAX_LENGTH } from "@/lib/auth/schemas";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField } from "@/components/ui/text-field";

export function SignUpForm({ tripIdea }: { tripIdea?: string }) {
  const [state, action] = useActionState(signUp, initialFormState);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <TextField
        label="What should we call you?"
        name="displayName"
        autoComplete="nickname"
        required
        maxLength={60}
        defaultValue={state.values?.displayName}
        error={state.fieldErrors?.displayName}
      />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN_LENGTH}
        hint={`At least ${PASSWORD_MIN_LENGTH} characters, with a letter and a number.`}
        error={state.fieldErrors?.password}
      />
      <TextField
        label="First trip idea (optional)"
        name="tripIdea"
        maxLength={TRIP_IDEA_MAX_LENGTH}
        placeholder="Lisbon in May"
        hint="We'll keep it on your Trips page as a starting point."
        defaultValue={state.values?.tripIdea ?? tripIdea}
        error={state.fieldErrors?.tripIdea}
      />
      <FormMessage state={state} />
      <SubmitButton size="lg" pendingLabel="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}
