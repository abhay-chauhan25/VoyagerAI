import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyFrame, Screen, ScreenHeader } from "@/components/app/screen";
import { AskCompass } from "@/components/drift/ask-compass";
import {
  DeckSkeleton,
  DeckStatus,
  DriftTabs,
  type DriftView,
} from "@/components/drift/deck-chrome";
import { DriftDeck } from "@/components/drift/drift-deck";
import { SavedList } from "@/components/drift/saved-list";
import { ButtonLink } from "@/components/ui/button";
import { aiCallsLeft } from "@/lib/ai/quota";
import { loadTravelDna, type TravelDna } from "@/lib/dna/queries";
import { loadSaves } from "@/lib/drift/context";
import { destinationDeck } from "@/lib/drift/destinations";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/user/current-user";

export const metadata: Metadata = { title: "Drift" };

function viewFrom(value: string | undefined): DriftView {
  return value === "ask" || value === "saved" ? value : "for-you";
}

async function DestinationDeckSection({ userId, dna }: { userId: string; dna: TravelDna }) {
  const supabase = await createClient();
  const { cards, source } = await destinationDeck(supabase, userId, dna);
  const judged = new Set((await loadSaves(supabase, userId)).map((s) => s.card.sourceKey));
  const callsLeft = await aiCallsLeft(supabase, userId);
  return (
    <div className="flex flex-col gap-4">
      <DeckStatus source={source} callsLeft={callsLeft} />
      <DriftDeck
        key={cards.map((c) => c.sourceKey).join()}
        cards={cards}
        judgedKeys={[...judged]}
        deckKey="destinations"
        emptyHint="Saved destinations are in the Saved tab. A new deck uses one Compass request."
      />
    </div>
  );
}

export default async function DriftPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const user = await requireUser("/drift");
  const supabase = await createClient();
  const [dna, saves] = await Promise.all([
    loadTravelDna(supabase, user.id),
    loadSaves(supabase, user.id),
  ]);
  const view = viewFrom((await searchParams).view);

  if (!dna) {
    return (
      <Screen>
        <ScreenHeader
          title="Drift"
          subline="Swipe through places picked for your taste. Saves become trips."
        />
        <EmptyFrame heading="Today's deck">
          <p className="text-body text-ink">Drift deals places matched to your Travel DNA.</p>
          <p>Set it up first: twelve quick moments and three questions.</p>
          <ButtonLink href="/welcome" className="mt-2 self-start">
            Set up Travel DNA
          </ButtonLink>
        </EmptyFrame>
      </Screen>
    );
  }

  const savedCount = saves.filter((s) => s.verdict !== "pass").length;

  return (
    <Screen>
      <ScreenHeader
        title="Drift"
        subline="Swipe right to save, left to pass, up for more like it. Saves become trips."
      />
      <DriftTabs current={view} savedCount={savedCount} />
      {view === "for-you" ? (
        <Suspense fallback={<DeckSkeleton label="Compass is dealing today's deck…" />}>
          <DestinationDeckSection userId={user.id} dna={dna} />
        </Suspense>
      ) : null}
      {view === "ask" ? <AskCompass mapboxToken={publicEnv().NEXT_PUBLIC_MAPBOX_TOKEN} /> : null}
      {view === "saved" ? <SavedList saves={saves} /> : null}
    </Screen>
  );
}
