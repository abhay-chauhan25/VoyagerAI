import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { TripCanvas } from "@/components/trips/trip-canvas";
import { aiCallsLeft } from "@/lib/ai/quota";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { loadCitySaves, loadTrip } from "@/lib/trips/queries";
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
  const [saves, callsLeft] = await Promise.all([
    loadCitySaves(supabase, user.id, trip.cityId),
    aiCallsLeft(supabase, user.id),
  ]);

  return (
    <div className="mx-auto w-full max-w-[96rem] px-4 py-6 sm:px-8 lg:py-8">
      <TripCanvas
        view={buildTripView(trip, saves)}
        mapToken={publicEnv().NEXT_PUBLIC_MAPBOX_TOKEN}
        callsLeft={callsLeft}
      />
    </div>
  );
}
