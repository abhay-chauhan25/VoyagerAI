"use client";

import { useActionState } from "react";
import { updateProfile } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/auth/form-state";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField } from "@/components/ui/text-field";

type Props = {
  displayName: string;
  homeCity: string | null;
  handle: string | null;
  isPublic: boolean;
};

export function ProfileForm({ displayName, homeCity, handle, isPublic }: Props) {
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
      <TextField
        label="Handle"
        name="handle"
        autoComplete="username"
        maxLength={30}
        spellCheck={false}
        hint="Your public address, /u/your_handle: 3–30 lowercase letters, numbers or underscores."
        defaultValue={state.values?.handle ?? handle ?? ""}
        error={state.fieldErrors?.handle}
      />
      <label className="flex items-start gap-3 text-ui">
        <input
          type="checkbox"
          name="isPublic"
          defaultChecked={state.values ? state.values.isPublic === "on" : isPublic}
          className="mt-1 size-4 accent-[var(--accent)]"
        />
        <span className="flex flex-col">
          <span className="font-semibold">Public profile</span>
          <span className="text-meta text-muted">
            Anyone with the link sees your name, home city, Atlas and top Travel DNA interests.
            Never your email.
          </span>
        </span>
      </label>
      <FormMessage state={state} />
      <SubmitButton className="self-start" pendingLabel="Saving…">
        Save profile
      </SubmitButton>
    </form>
  );
}
