"use client";

import { useState, useTransition } from "react";
import { respondToInvitation } from "@/lib/huddle/actions";
import type { Invitation } from "@/lib/huddle/queries";
import { tripDates } from "@/components/trips/trip-card";

/** Trips someone invited this traveller to by handle; joining shares what the invite page says. */
export function Invitations({ invitations }: { invitations: Invitation[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const answer = (inviteId: string, accept: boolean) =>
    start(async () => {
      setError(null);
      const result = await respondToInvitation({ inviteId, accept });
      if (!result.ok) setError(result.message);
    });

  return (
    <section aria-labelledby="invitations-heading" className="flex flex-col gap-3">
      <h2 id="invitations-heading" className="text-body font-semibold">
        Invitations
      </h2>
      <ul className="flex flex-col divide-y divide-rule rounded-card bg-panel">
        {invitations.map((invite) => (
          <li
            key={invite.id}
            className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
          >
            <span className="flex flex-col">
              <span className="text-body font-semibold">{invite.title}</span>
              <span className="text-meta text-muted">
                {invite.inviter} invited you as{" "}
                {invite.role === "editor" ? "an editor" : "a viewer"} · {invite.city_name} ·{" "}
                {tripDates(invite.start_date, invite.day_count)}
              </span>
              <span className="text-meta text-muted">
                Joining shares your name, pace and top three interests with the trip&apos;s members.
              </span>
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => answer(invite.id, true)}
                className="pressable min-h-10 rounded-control bg-primary px-4 text-ui font-semibold text-primary-ink disabled:opacity-60"
              >
                Join
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => answer(invite.id, false)}
                className="pressable min-h-10 px-2 text-ui text-muted underline-offset-4 hover:text-ink hover:underline"
              >
                Decline
              </button>
            </span>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="text-meta font-semibold text-negative">
          {error}
        </p>
      ) : null}
    </section>
  );
}
