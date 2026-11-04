"use client";

import { useActionState } from "react";
import { updateProfile } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/auth/form-state";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField } from "@/components/ui/text-field";

export function ProfileForm({
  displayName,
  homeCity,
}: {
  displayName: string;
  homeCity: string | null;
}) {
  const [state, action] = useActionState(updateProfile, initialFormState);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <TextField
        label="Display name"
        name="displayName"
        autoComplete="nickname"
        required
        maxLength={60}
        defaultValue={state.values?.displayName ?? displayName}
        error={state.fieldErrors?.displayName}
      />
      <TextField
        label="Home city"
        name="homeCity"
        autoComplete="address-level2"
        maxLength={80}
        hint="Used to suggest trips that start near you."
        defaultValue={state.values?.homeCity ?? homeCity ?? ""}
        error={state.fieldErrors?.homeCity}
      />
      <FormMessage state={state} />
      <SubmitButton className="self-start" pendingLabel="Saving…">
        Save profile
      </SubmitButton>
    </form>
  );
}
