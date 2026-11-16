import type { Metadata } from "next";
import { EmptyFrame, Screen, ScreenHeader } from "@/components/app/screen";
import { NoteForm } from "@/components/notes/note-form";
import { ButtonLink } from "@/components/ui/button";
import { loadNotablePlaces } from "@/lib/notes/queries";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/user/current-user";

export const metadata: Metadata = { title: "Write a note" };

export default async function NewNotePage() {
  await requireUser("/notes/new");
  const places = await loadNotablePlaces(await createClient());
  return (
    <Screen>
      <ScreenHeader
        title="Write a note"
        subline="A rating and a few words about a place on one of your trips."
      />
      {places.length > 0 ? (
        <NoteForm places={places} />
      ) : (
        <EmptyFrame heading="Places">
          <p className="text-body text-ink">There are no places to write about yet.</p>
          <p>Notes are about stops on your trips. Compose a trip first.</p>
          <div className="pt-2">
            <ButtonLink href="/trips" variant="secondary">
              Go to Trips
            </ButtonLink>
          </div>
        </EmptyFrame>
      )}
    </Screen>
  );
}
