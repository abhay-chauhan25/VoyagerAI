import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { Screen } from "@/components/app/screen";
import { DeckSkeleton } from "@/components/drift/deck-chrome";
import { GroupDeck } from "@/components/huddle/group-deck";
import { Matches } from "@/components/huddle/matches";
import { TripLive } from "@/components/huddle/trip-live";
import { groupDeck } from "@/lib/huddle/deck";
import { findMatches, nameList } from "@/lib/huddle/group";
import { loadGroupSwipes, loadMembers, loadVotes, type TripMember } from "@/lib/huddle/queries";
import { createClient } from "@/lib/supabase/server";
import { loadTrip, type StoredTrip } from "@/lib/trips/queries";
import { requireUser } from "@/lib/user/current-user";

export const metadata: Metadata = { title: "Group Drift" };

async function DeckSection({
  trip,
  members,
  userId,
}: {
  trip: StoredTrip;
  members: TripMember[];
  userId: string;
}) {
  const supabase = await createClient();
  const [deck, swipes] = await Promise.all([
    groupDeck(supabase, trip, members),
    loadGroupSwipes(supabase, trip.id),
  ]);
  if (!deck.ok) {
    return (
      <p role="alert" className="rounded-card bg-negative-bg px-4 py-3 text-ui text-negative">
        {deck.message}
      </p>
    );
  }
  const mine = swipes.filter((s) => s.userId === userId).map((s) => s.sourceKey);
  return <GroupDeck tripId={trip.id} cards={deck.cards} judgedKeys={mine} />;
}

export default async function GroupDriftPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const id = z.uuid().safeParse(tripId);
  if (!id.success) notFound();
  const user = await requireUser(`/trips/${id.data}/drift`);
  const supabase = await createClient();
  const trip = await loadTrip(supabase, user.id, id.data);
  if (!trip) notFound();
  const [members, swipes] = await Promise.all([
    loadMembers(supabase, trip.id),
    loadGroupSwipes(supabase, trip.id),
  ]);
  const votes = await loadVotes(supabase, trip.id, user.id, members);
  const names = new Map(members.map((m) => [m.id, m.name]));
  const cards = new Map(swipes.map((s) => [s.sourceKey, s.card]));
  const inTrip = new Set(trip.stops.map((s) => s.sourceKey));
  const matches = findMatches(swipes).flatMap(({ sourceKey, fans }) => {
    const card = cards.get(sourceKey);
    return card
      ? [
          {
            card,
            fans: fans.map((f) => names.get(f) ?? "A former member"),
            inTrip: inTrip.has(sourceKey),
          },
        ]
      : [];
  });
  const progress = members.map((m) => {
    const count = swipes.filter((s) => s.userId === m.id).length;
    return `${m.name} ${count}`;
  });

  return (
    <TripLive tripId={trip.id} me={{ id: user.id, name: user.displayName }}>
      <Screen>
        <div className="flex flex-col gap-1">
          <Link
            href={`/trips/${trip.id}`}
            className="w-fit text-meta text-muted underline-offset-4 hover:underline"
          >
            {trip.title}
          </Link>
          <h1 className="text-title font-semibold tracking-[-0.01em]">Group Drift</h1>
          <p className="text-ui text-muted">
            {members.length > 1
              ? `${nameList(members.map((m) => m.name))} swipe the same places in ${trip.cityName}. Swiped so far: ${progress.join(", ")}.`
              : `Invite someone to the trip, then you'll swipe the same places in ${trip.cityName}.`}
          </p>
        </div>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
          <section aria-label="Shared deck">
            <Suspense fallback={<DeckSkeleton label="Dealing the group deck…" />}>
              <DeckSection trip={trip} members={members} userId={user.id} />
            </Suspense>
          </section>
          <section aria-labelledby="matches-heading" className="flex flex-col gap-3">
            <h2 id="matches-heading" className="text-body font-semibold">
              Matches
            </h2>
            <Matches
              tripId={trip.id}
              dayCount={trip.dayCount}
              canEdit={trip.role !== "viewer"}
              matches={matches}
              votes={votes}
              myName={user.displayName}
            />
          </section>
        </div>
      </Screen>
    </TripLive>
  );
}
