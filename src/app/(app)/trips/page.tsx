import type { Metadata } from "next";
import { EmptyFrame, Screen, ScreenHeader } from "@/components/app/screen";
import { TripCard } from "@/components/trips/trip-card";
import { ButtonLink } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { loadComposableCities, loadTrips } from "@/lib/trips/queries";
import { requireUser } from "@/lib/user/current-user";

export const metadata: Metadata = { title: "Trips" };

export default async function TripsPage() {
  const user = await requireUser("/trips");
  const supabase = await createClient();
  const [trips, cities] = await Promise.all([
    loadTrips(supabase, user.id),
    loadComposableCities(supabase, user.id),
  ]);
  const canCompose = cities.length > 0;

  return (
    <Screen>
      <ScreenHeader
        title="Trips"
        subline="Day-by-day plans composed from the places you saved in Drift."
        action={canCompose ? <ButtonLink href="/trips/new">Compose a trip</ButtonLink> : undefined}
      />

      {trips.length > 0 ? (
        <section aria-labelledby="trips-heading" className="flex flex-col gap-3">
          <h2 id="trips-heading" className="text-body font-semibold">
            Your trips
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => (
              <li key={trip.id}>
                <TripCard trip={trip} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <EmptyFrame heading="Your trips">
          <p className="text-body text-ink">No trips yet.</p>
          {canCompose ? (
            <p>
              You have saved places in {cities.map((c) => c.cityName).join(", ")}. Compose turns
              them into a day-by-day plan with travel times.
            </p>
          ) : (
            <p>
              Save places in a city with Drift (open a destination, then swipe its places), and
              Compose will turn them into a day-by-day plan.
            </p>
          )}
          <div className="pt-2">
            <ButtonLink href={canCompose ? "/trips/new" : "/drift"} variant="secondary">
              {canCompose ? "Compose a trip" : "Go to Drift"}
            </ButtonLink>
          </div>
        </EmptyFrame>
      )}

      {user.tripIdea ? (
        <section aria-labelledby="ideas-heading" className="flex flex-col gap-3">
          <h2 id="ideas-heading" className="text-body font-semibold">
            Ideas
          </h2>
          <div className="flex items-center justify-between gap-4 rounded-card border border-border bg-panel px-5 py-4">
            <div className="flex flex-col">
              <span className="text-body font-semibold">{user.tripIdea}</span>
              <span className="text-meta text-muted">Saved when you joined</span>
            </div>
            <ButtonLink href="/drift?view=ask" variant="quiet">
              Ask Compass about it
            </ButtonLink>
          </div>
        </section>
      ) : null}
    </Screen>
  );
}
