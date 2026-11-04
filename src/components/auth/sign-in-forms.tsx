"use client";

import { useActionState, useState } from "react";
import { sendMagicLink, signIn } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/auth/form-state";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField } from "@/components/ui/text-field";

type Method = "password" | "link";

export function SignInForms({ next }: { next: string }) {
  const [method, setMethod] = useState<Method>("password");
  const [passwordState, passwordAction] = useActionState(signIn, initialFormState);
  const [linkState, linkAction] = useActionState(sendMagicLink, initialFormState);

  return (
    <div className="flex flex-col gap-6">
      <div
        role="tablist"
        aria-label="Sign-in method"
        className="inline-flex self-start rounded-control bg-surface p-1"
      >
        {(
          [
            ["password", "Password"],
            ["link", "Email me a link"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`tab-${value}`}
            aria-selected={method === value}
            aria-controls={`panel-${value}`}
            onClick={() => setMethod(value)}
            className={`pressable min-h-10 rounded-[3px] px-4 text-ui ${
              method === value ? "bg-panel font-semibold text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {method === "password" ? (
        <form
          id="panel-password"
          role="tabpanel"
          aria-labelledby="tab-password"
          action={passwordAction}
          className="flex flex-col gap-4"
          noValidate
        >
          <input type="hidden" name="next" value={next} />
          <TextField
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={passwordState.values?.email}
            error={passwordState.fieldErrors?.email}
          />
          <TextField
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            error={passwordState.fieldErrors?.password}
          />
          <FormMessage state={passwordState} />
          <SubmitButton size="lg" pendingLabel="Signing in…">
            Sign in
          </SubmitButton>
        </form>
      ) : (
        <form
          id="panel-link"
          role="tabpanel"
          aria-labelledby="tab-link"
          action={linkAction}
          className="flex flex-col gap-4"
          noValidate
        >
          <input type="hidden" name="next" value={next} />
          <TextField
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            hint="We'll send a one-time link that signs you in. It works once and expires in an hour."
            defaultValue={linkState.values?.email}
            error={linkState.fieldErrors?.email}
          />
          <FormMessage state={linkState} />
          <SubmitButton size="lg" pendingLabel="Sending link…">
            Send sign-in link
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
