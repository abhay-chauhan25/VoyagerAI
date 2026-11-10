import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { MembersPanel } from "@/components/huddle/members-panel";
import { TripLive } from "@/components/huddle/trip-live";
import { TripCanvas } from "@/components/trips/trip-canvas";
import { aiCallsLeft } from "@/lib/ai/quota";
import { publicEnv } from "@/lib/env";
import {
  loadInviteLinks,
  loadMembers,
  loadPersonInvites,
  loadPool,
  loadVotes,
} from "@/lib/huddle/queries";
import { createClient } from "@/lib/supabase/server";
import { loadTrip } from "@/lib/trips/queries";
import { buildTripView } from "@/lib/trips/view";
import { requireUser } from "@/lib/user/current-user";

export const metadata: Metadata = { title: "Trip" };

export default async function TripPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const id = z.uuid().safeParse(tripId);
  if (!id.success) notFound();
  const user = await requireUser(`/trips/${id.data}`);
  const supabase = await createClient();
  const trip = await loadTrip(supabase, user.id, id.data);
  if (!trip) notFound();
  const owner = trip.role === "owner";
  const [pool, callsLeft, members, links, personInvites] = await Promise.all([
    loadPool(supabase, user.id, trip),
    aiCallsLeft(supabase, user.id),
    loadMembers(supabase, trip.id),
    owner ? loadInviteLinks(supabase, trip.id) : Promise.resolve([]),
    owner ? loadPersonInvites(supabase, trip.id) : Promise.resolve([]),
  ]);
  const votes = await loadVotes(supabase, trip.id, user.id, members);

  return (
    <div className="mx-auto w-full max-w-[96rem] px-4 py-6 sm:px-8 lg:py-8">
      <TripLive tripId={trip.id} me={{ id: user.id, name: user.displayName }}>
        <TripCanvas
          view={buildTripView(trip, pool)}
          mapToken={publicEnv().NEXT_PUBLIC_MAPBOX_TOKEN}
          callsLeft={callsLeft}
          memberCount={members.length}
          votes={votes}
          myName={user.displayName}
          travellers={
            <MembersPanel
              key="travellers"
              tripId={trip.id}
              meId={user.id}
              myRole={trip.role}
              members={members}
              links={links}
              personInvites={personInvites}
            />
          }
        />
      </TripLive>
    </div>
  );
}
