import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EmptyFrame, Screen, ScreenHeader } from "@/components/app/screen";
import { DeckSkeleton, DeckStatus } from "@/components/drift/deck-chrome";
import { DriftDeck } from "@/components/drift/drift-deck";
import { dealNewDeck } from "@/lib/drift/actions";
import { aiCallsLeft } from "@/lib/ai/quota";
import { countryName } from "@/lib/atlas/countries";
import { loadTravelDna, type TravelDna } from "@/lib/dna/queries";
import { activityDeck } from "@/lib/drift/activities";
import { loadSaves } from "@/lib/drift/context";
import type { City } from "@/lib/drift/ground";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/user/current-user";

type Params = { params: Promise<{ cityId: string }> };

async function loadCity(rawId: string): Promise<City | null> {
  if (!/^\d{1,10}$/.test(rawId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cities")
    .select("*")
    .eq("geoname_id", Number(rawId))
    .maybeSingle();
  if (error) throw new Error(`Could not load city (${error.code})`);
  return data;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const city = await loadCity((await params).cityId);
  return { title: city ? `Places in ${city.name}` : "Place not found" };
}

async function ActivityDeckSection({
  userId,
  dna,
  city,
}: {
  userId: string;
  dna: TravelDna;
  city: City;
}) {
  const supabase = await createClient();
  const outcome = await activityDeck(supabase, userId, dna, city);
  if (!outcome.ok) {
    return (
      <EmptyFrame heading="Places nearby">
        <p className="text-body text-ink">{outcome.message}</p>
        <form action={dealNewDeck}>
          <input type="hidden" name="deckKey" value={`activities:${city.geoname_id}`} />
          <button
            type="submit"
            className="pressable mt-2 min-h-10 rounded-control border border-control bg-panel px-4 text-ui font-semibold"
          >
            Try again
          </button>
        </form>
      </EmptyFrame>
    );
  }
  const judged = new Set((await loadSaves(supabase, userId)).map((s) => s.card.sourceKey));
  const callsLeft = await aiCallsLeft(supabase, userId);
  return (
    <div className="flex flex-col gap-4">
      <DeckStatus source={outcome.source} callsLeft={callsLeft} />
      <DriftDeck
        key={outcome.cards.map((c) => c.sourceKey).join()}
        cards={outcome.cards}
        judgedKeys={[...judged]}
        deckKey={`activities:${city.geoname_id}`}
        emptyHint={`Saved places in ${city.name} are in the Saved tab.`}
      />
    </div>
  );
}

export default async function CityDriftPage({ params }: Params) {
  const user = await requireUser("/drift");
  const city = await loadCity((await params).cityId);
  if (!city) notFound();
  const dna = await loadTravelDna(await createClient(), user.id);

  return (
    <Screen>
      <ScreenHeader
        title={`Places in ${city.name}`}
        subline={`${[city.region, countryName(city.country_code)].filter(Boolean).join(", ")}. Real places from OpenStreetMap and Wikipedia, ranked by your Travel DNA.`}
        action={
          <Link href="/drift" className="text-ui font-semibold underline underline-offset-4">
            Back to Drift
          </Link>
        }
      />
      {dna ? (
        <Suspense fallback={<DeckSkeleton label={`Finding places in ${city.name}…`} />}>
          <ActivityDeckSection userId={user.id} dna={dna} city={city} />
        </Suspense>
      ) : (
        <EmptyFrame heading="Places nearby">
          <p className="text-body text-ink">
            Set up your Travel DNA first, so places can be ranked for you.
          </p>
          <Link href="/welcome" className="text-ui font-semibold underline underline-offset-4">
            Set up Travel DNA
          </Link>
        </EmptyFrame>
      )}
    </Screen>
  );
}
