"use client";

import { useActionState, useId } from "react";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField } from "@/components/ui/text-field";
import { initialFormState } from "@/lib/auth/form-state";
import { AUDIENCES, AUDIENCE_LABEL, MAX_BIO, type Audience } from "@/lib/user/about";
import { updateAbout } from "@/lib/user/about-actions";

type Props = {
  bio: string | null;
  website: string | null;
  contactEmail: string | null;
  phone: string | null;
  emailAudience: Audience;
  phoneAudience: Audience;
};

function AudienceSelect({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-ui font-semibold">
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        className="min-h-11 rounded-control border border-control bg-panel px-3 text-body"
      >
        {AUDIENCES.map((audience) => (
          <option key={audience} value={audience}>
            {AUDIENCE_LABEL[audience]}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Bio, a link, and contact details with a separate choice of who sees each one. */
export function AboutForm(props: Props) {
  const [state, action] = useActionState(updateAbout, initialFormState);
  const bioId = useId();
  const value = (field: keyof Props) => state.values?.[field] ?? props[field] ?? "";

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <label htmlFor={bioId} className="text-ui font-semibold">
          Bio
        </label>
        <textarea
          id={bioId}
          name="bio"
          rows={3}
          maxLength={MAX_BIO}
          defaultValue={value("bio")}
          aria-describedby={`${bioId}-hint`}
          aria-invalid={state.fieldErrors?.bio ? true : undefined}
          className="rounded-control border border-control bg-panel px-3 py-2.5 text-body"
        />
        <p id={`${bioId}-hint`} className="text-meta text-muted">
          {state.fieldErrors?.bio ??
            `Up to ${MAX_BIO} characters. Shown on your profile to whoever can see it.`}
        </p>
      </div>
      <TextField
        label="Website or social link"
        name="website"
        type="url"
        inputMode="url"
        autoComplete="url"
        maxLength={200}
        spellCheck={false}
        hint="A full address starting with https://. Shown on your profile."
        defaultValue={value("website")}
        error={state.fieldErrors?.website}
      />

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <TextField
          label="Contact email"
          name="contactEmail"
          type="email"
          autoComplete="email"
          maxLength={254}
          spellCheck={false}
          hint="An address for other travellers. Your sign-in email is never shown."
          defaultValue={value("contactEmail")}
          error={state.fieldErrors?.contactEmail}
        />
        <AudienceSelect
          label="Who sees your email"
          name="emailAudience"
          defaultValue={value("emailAudience") || "hidden"}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <TextField
          label="Phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          maxLength={23}
          hint="With the country code, for example +351 21 000 0000."
          defaultValue={value("phone")}
          error={state.fieldErrors?.phone}
        />
        <AudienceSelect
          label="Who sees your phone"
          name="phoneAudience"
          defaultValue={value("phoneAudience") || "hidden"}
        />
      </div>
      <p className="text-meta text-muted">
        Email and phone start hidden. They are only ever shown to signed-in travellers, never to
        visitors, even when your profile is public.
      </p>
      <FormMessage state={state} />
      <SubmitButton className="self-start" pendingLabel="Saving…">
        Save details
      </SubmitButton>
    </form>
  );
}
