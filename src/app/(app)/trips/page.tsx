import type { Metadata } from "next";
import { EmptyFrame, Screen, ScreenHeader } from "@/components/app/screen";
import { requireUser } from "@/lib/user/current-user";

export const metadata: Metadata = { title: "Trips" };

export default async function TripsPage() {
  const user = await requireUser("/trips");

  return (
    <Screen>
      <ScreenHeader title="Trips" subline={`${user.displayName}'s trips, planned and past.`} />
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
            <span className="text-meta text-muted">Planning opens with Compose</span>
          </div>
        </section>
      ) : null}
      <EmptyFrame heading="Upcoming">
        <p className="text-body text-ink">No trips yet.</p>
        <p>Trips you plan, alone or with friends, will be listed here by departure date.</p>
      </EmptyFrame>
    </Screen>
  );
}
