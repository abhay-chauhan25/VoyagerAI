import type { Metadata } from "next";
import Link from "next/link";
import { EmptyFrame, Screen, ScreenHeader } from "@/components/app/screen";
import { Feed } from "@/components/notes/feed";
import { ButtonLink } from "@/components/ui/button";
import { loadFeed, loadFollowing, loadHandles, type FeedView } from "@/lib/notes/queries";
import { createClient } from "@/lib/supabase/server";
import { loadTrips } from "@/lib/trips/queries";
import { requireUser } from "@/lib/user/current-user";

export const metadata: Metadata = { title: "Field Notes" };

const VIEWS: { id: FeedView; label: string }[] = [
  { id: "following", label: "Following" },
  { id: "everyone", label: "Everyone" },
  { id: "mine", label: "Mine" },
];

const EMPTY: Record<FeedView, { line: string; next: string }> = {
  following: {
    line: "Nothing from people you follow yet.",
    next: "Follow a traveller from the Everyone tab or from their public profile, and what they share with followers appears here.",
  },
  everyone: {
    line: "Nobody has shared anything publicly yet.",
    next: "Notes and stories are private until their author shares them.",
  },
  mine: {
    line: "You haven't written anything yet.",
    next: "Write a note about a place on one of your trips, or publish a trip as a story.",
  },
};

type Props = { searchParams: Promise<{ view?: string; photos?: string }> };

export default async function FieldNotesPage({ searchParams }: Props) {
  const user = await requireUser("/notes");
  const params = await searchParams;
  const view = VIEWS.find((v) => v.id === params.view)?.id ?? "following";
  const lostPhotos = Number.parseInt(params.photos ?? "", 10);
  const supabase = await createClient();
  const [items, following, trips] = await Promise.all([
    loadFeed(supabase, user.id, view),
    loadFollowing(supabase, user.id),
    loadTrips(supabase, user.id),
  ]);
  const handles = await loadHandles(supabase, [...new Set(items.map((item) => item.authorId))]);
  const owned = trips.filter((trip) => trip.role === "owner");

  return (
    <Screen>
      <ScreenHeader
        title="Field Notes"
        subline="Ratings, photos and stories from real trips. Yours stay private until you share them."
        action={
          trips.length > 0 ? <ButtonLink href="/notes/new">Write a note</ButtonLink> : undefined
        }
      />

      {lostPhotos > 0 ? (
        <p role="status" className="rounded-control bg-warning-bg px-4 py-3 text-ui">
          Your note was saved, but {lostPhotos === 1 ? "one photo" : `${lostPhotos} photos`}{" "}
          couldn&apos;t be uploaded.
        </p>
      ) : null}

      <nav
        aria-label="Whose notes"
        className="flex gap-1 self-start rounded-control bg-surface p-1"
      >
        {VIEWS.map(({ id, label }) => (
          <Link
            key={id}
            href={id === "following" ? "/notes" : `/notes?view=${id}`}
            aria-current={view === id ? "page" : undefined}
            className={`pressable flex min-h-9 items-center rounded-[4px] px-4 text-ui ${
              view === id ? "bg-panel font-semibold text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {items.length > 0 ? (
        <section aria-label={VIEWS.find((v) => v.id === view)?.label}>
          <Feed items={items} context={{ me: user.id, following: new Set(following), handles }} />
        </section>
      ) : (
        <EmptyFrame heading={VIEWS.find((v) => v.id === view)?.label ?? "Notes"}>
          <p className="text-body text-ink">{EMPTY[view].line}</p>
          <p>{EMPTY[view].next}</p>
        </EmptyFrame>
      )}

      {view === "mine" && owned.length > 0 ? (
        <section aria-labelledby="publish-heading" className="flex flex-col gap-3">
          <h2 id="publish-heading" className="text-body font-semibold">
            Publish a trip as a story
          </h2>
          <ul className="flex flex-col divide-y divide-rule rounded-card bg-panel">
            {owned.map((trip) => (
              <li key={trip.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-body font-semibold">{trip.title}</span>
                  <span className="text-meta text-muted">
                    {trip.cityName} · {trip.dayCount} {trip.dayCount === 1 ? "day" : "days"}
                  </span>
                </span>
                <ButtonLink href={`/notes/publish/${trip.id}`} variant="secondary">
                  Write its story
                </ButtonLink>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Screen>
  );
}
