import type { Metadata } from "next";
import { EmptyFrame, Screen, ScreenHeader } from "@/components/app/screen";
import { ComposeForm } from "@/components/trips/compose-form";
import { ButtonLink } from "@/components/ui/button";
import { loadTravelDna } from "@/lib/dna/queries";
import { createClient } from "@/lib/supabase/server";
import { loadComposableCities } from "@/lib/trips/queries";
import { requireUser } from "@/lib/user/current-user";

export const metadata: Metadata = { title: "Compose a trip" };

/** The next Friday at least three days away: a weekend that is still ahead. */
function nextFriday(today = new Date()): string {
  const date = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + 3));
  date.setUTCDate(date.getUTCDate() + ((5 - date.getUTCDay() + 7) % 7));
  return date.toISOString().slice(0, 10);
}

export default async function ComposePage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  const user = await requireUser("/trips/new");
  const supabase = await createClient();
  const [cities, dna] = await Promise.all([
    loadComposableCities(supabase, user.id),
    loadTravelDna(supabase, user.id),
  ]);
  const requested = Number((await searchParams).city);
  const initial = cities.find((c) => c.cityId === requested) ?? cities[0];

  return (
    <Screen>
      <ScreenHeader
        title="Compose a trip"
        subline="Compose turns the places you saved in a city into a day-by-day plan."
      />
      {initial ? (
        <ComposeForm
          cities={cities}
          initialCityId={initial.cityId}
          defaultStart={nextFriday()}
          defaultPace={dna?.pace ?? "balanced"}
        />
      ) : (
        <EmptyFrame heading="Nothing to compose yet">
          <p className="text-body text-ink">You haven&apos;t saved any places in a city yet.</p>
          <p>Open a destination in Drift and swipe right on the places you&apos;d like to visit.</p>
          <div className="pt-2">
            <ButtonLink href="/drift" variant="secondary">
              Go to Drift
            </ButtonLink>
          </div>
        </EmptyFrame>
      )}
    </Screen>
  );
}
