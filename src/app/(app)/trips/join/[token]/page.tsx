import type { Metadata } from "next";
import Link from "next/link";
import { EmptyFrame, Screen, ScreenHeader } from "@/components/app/screen";
import { tripDates } from "@/components/trips/trip-card";
import { joinWithLink } from "@/lib/huddle/actions";
import { INVITE_TOKEN } from "@/lib/huddle/tokens";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/user/current-user";

export const metadata: Metadata = { title: "Join a trip" };

const ROLE_TEXT = {
  owner: "as its owner",
  editor: "as an editor: you can change the plan",
  viewer: "as a viewer: you can swipe and vote",
} as const;

/** What an invite link joins, and what joining shares, before anything happens. */
export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ failed?: string }>;
}) {
  const { token } = await params;
  const failed = (await searchParams).failed === "1";
  await requireUser(`/trips/join/${token}`);
  const supabase = await createClient();
  const preview = INVITE_TOKEN.test(token)
    ? await supabase.rpc("invite_preview", { p_token: token })
    : null;
  if (preview?.error) console.error("Invite preview failed", { code: preview.error.code });
  const invite = preview?.data?.[0];

  if (!invite || !invite.usable || failed) {
    return (
      <Screen>
        <ScreenHeader title="Join a trip" subline="Invite links work for 7 days." />
        <EmptyFrame heading="This link can't be used">
          <p className="text-body text-ink">
            {invite?.already_member
              ? "You're already on this trip."
              : "It has expired, been revoked, or was copied incompletely."}
          </p>
          <p>Ask whoever sent it for a new link.</p>
          <div className="pt-2">
            <Link
              href={invite?.already_member ? `/trips/${invite.trip_id}` : "/trips"}
              className="text-ui font-semibold underline underline-offset-4"
            >
              {invite?.already_member ? "Open the trip" : "Your trips"}
            </Link>
          </div>
        </EmptyFrame>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        title="Join a trip"
        subline={`${invite.inviter} invited you to plan together.`}
      />
      <section className="flex max-w-xl flex-col gap-5 rounded-card bg-panel p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-lead font-semibold">{invite.title}</h2>
          <p className="text-ui text-muted">
            {invite.city_name} · {tripDates(invite.start_date, invite.day_count)}
          </p>
        </div>
        <p className="text-ui">You&apos;d join {ROLE_TEXT[invite.role]}.</p>
        <p className="text-ui">
          Joining shares your display name, pace and top three Travel DNA interests with the
          trip&apos;s members, so plans can balance everyone. Nothing else about you is shared, and
          leaving the trip stops it.
        </p>
        {invite.already_member ? (
          <Link
            href={`/trips/${invite.trip_id}`}
            className="pressable inline-flex min-h-11 w-fit items-center rounded-control bg-primary px-5 text-ui font-semibold text-primary-ink"
          >
            You&apos;re already on this trip. Open it
          </Link>
        ) : (
          <form action={joinWithLink}>
            <input type="hidden" name="token" value={token} />
            <button
              type="submit"
              className="pressable min-h-11 rounded-control bg-primary px-5 text-ui font-semibold text-primary-ink hover:bg-primary-hover"
            >
              Join the trip
            </button>
          </form>
        )}
      </section>
    </Screen>
  );
}
