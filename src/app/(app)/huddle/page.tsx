import type { Metadata } from "next";
import Link from "next/link";
import { EmptyFrame, Screen, ScreenHeader } from "@/components/app/screen";
import { Invitations } from "@/components/huddle/invitations";
import { tripDates } from "@/components/trips/trip-card";
import { ButtonLink } from "@/components/ui/button";
import { loadMyInvitations } from "@/lib/huddle/queries";
import { dayHue, hueStyle } from "@/lib/hues";
import { createClient } from "@/lib/supabase/server";
import { loadTrips, type TripSummary } from "@/lib/trips/queries";
import { requireUser } from "@/lib/user/current-user";

export const metadata: Metadata = { title: "Huddle" };

/** Seats shown per row before the rest are counted in words. */
const MAX_SEATS = 8;
const ROLE_LABEL: Record<TripSummary["role"], string> = {
  owner: "You own it",
  editor: "You can edit",
  viewer: "You can view, swipe and vote",
};

/** A trip as a row of the cabin: one seat for each traveller on it. */
function CabinRow({ trip, shared }: { trip: TripSummary; shared: boolean }) {
  const seats = Math.min(trip.memberCount, MAX_SEATS);
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4">
      <div className="flex min-w-0 flex-col">
        <Link
          href={`/trips/${trip.id}`}
          className="text-body font-semibold underline-offset-4 hover:underline"
        >
          {trip.title}
        </Link>
        <span className="text-meta text-muted">
          {trip.cityName} · {tripDates(trip.startDate, trip.dayCount)} · {ROLE_LABEL[trip.role]}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span
          className="flex items-center gap-1"
          role="img"
          aria-label={`${trip.memberCount} ${trip.memberCount === 1 ? "traveller" : "travellers"}`}
        >
          {Array.from({ length: seats }, (_, i) => (
            <span
              key={i}
              style={hueStyle(dayHue(i + 1))}
              className="hue-mark h-4 w-3 rounded-[3px]"
            />
          ))}
          {/* An empty seat: there is always room for one more. */}
          <span className="h-4 w-3 rounded-[3px] border border-dashed border-control" />
        </span>
        {shared ? (
          <ButtonLink href={`/trips/${trip.id}/drift`} variant="secondary">
            Group Drift
          </ButtonLink>
        ) : trip.role === "owner" ? (
          <ButtonLink href={`/trips/${trip.id}`} variant="secondary">
            Invite people
          </ButtonLink>
        ) : null}
      </div>
    </li>
  );
}

export default async function HuddlePage() {
  const user = await requireUser("/huddle");
  const supabase = await createClient();
  const [trips, invitations] = await Promise.all([
    loadTrips(supabase, user.id),
    loadMyInvitations(supabase),
  ]);
  const shared = trips.filter((trip) => trip.memberCount > 1);
  const solo = trips.filter((trip) => trip.memberCount <= 1);

  return (
    <Screen>
      <ScreenHeader
        title="Huddle"
        subline="Trips you're planning with other people: swipe the same places, vote, and agree a plan."
        action={
          <Link href="/friends" className="text-ui font-semibold underline underline-offset-4">
            Your friends
          </Link>
        }
      />

      {invitations.length > 0 ? <Invitations invitations={invitations} /> : null}

      {shared.length > 0 ? (
        <section aria-labelledby="shared-heading" className="flex flex-col gap-3">
          <h2 id="shared-heading" className="text-body font-semibold">
            Shared trips
          </h2>
          <ul className="flex flex-col divide-y divide-rule rounded-card bg-panel">
            {shared.map((trip) => (
              <CabinRow key={trip.id} trip={trip} shared />
            ))}
          </ul>
        </section>
      ) : (
        <EmptyFrame heading="Shared trips">
          <p className="text-body text-ink">No shared trips yet.</p>
          <p>
            Open one of your trips and choose Invite people. Everyone who joins can swipe the
            group&apos;s places and vote; editors can change the plan with you, live.
          </p>
          {trips.length === 0 ? (
            <div className="pt-2">
              <ButtonLink href="/trips" variant="secondary">
                Go to Trips
              </ButtonLink>
            </div>
          ) : null}
        </EmptyFrame>
      )}

      {solo.length > 0 ? (
        <section aria-labelledby="solo-heading" className="flex flex-col gap-3">
          <h2 id="solo-heading" className="text-body font-semibold">
            Trips with room for company
          </h2>
          <ul className="flex flex-col divide-y divide-rule rounded-card bg-panel">
            {solo.map((trip) => (
              <CabinRow key={trip.id} trip={trip} shared={false} />
            ))}
          </ul>
        </section>
      ) : null}
    </Screen>
  );
}
