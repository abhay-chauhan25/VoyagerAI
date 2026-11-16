import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Screen, ScreenHeader } from "@/components/app/screen";
import { StoryForm } from "@/components/notes/story-forms";
import { loadStory } from "@/lib/notes/queries";
import { createClient } from "@/lib/supabase/server";
import { loadTrip } from "@/lib/trips/queries";
import { requireUser } from "@/lib/user/current-user";

export const metadata: Metadata = { title: "Publish a story" };

type Props = { params: Promise<{ tripId: string }> };

export default async function PublishStoryPage({ params }: Props) {
  const { tripId } = await params;
  if (!z.uuid().safeParse(tripId).success) notFound();
  const user = await requireUser(`/notes/publish/${tripId}`);
  const supabase = await createClient();
  const trip = await loadTrip(supabase, user.id, tripId);
  // Only the owner publishes; to anyone else the page does not exist.
  if (!trip || trip.role !== "owner") notFound();
  const existing = await loadStory(supabase, tripId);

  return (
    <Screen>
      <ScreenHeader
        title={existing ? "Edit your story" : "Publish a story"}
        subline={`${trip.title} · ${trip.cityName}, ${trip.dayCount} ${trip.dayCount === 1 ? "day" : "days"}`}
      />
      <StoryForm
        tripId={trip.id}
        tripTitle={trip.title}
        existing={
          existing
            ? { title: existing.title, body: existing.body, visibility: existing.visibility }
            : null
        }
      />
    </Screen>
  );
}
