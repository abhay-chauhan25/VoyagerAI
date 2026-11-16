import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Screen } from "@/components/app/screen";
import { ForkForm, UnpublishButton } from "@/components/notes/story-forms";
import { Avatar } from "@/components/shell/avatar";
import { loadHandles, loadStory } from "@/lib/notes/queries";
import { VISIBILITY_LABEL } from "@/lib/notes/schemas";
import { dayHue, hueStyle } from "@/lib/hues";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/user/current-user";

type Props = { params: Promise<{ storyId: string }> };

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });
const DAYS_AHEAD = 30;

/** A start date a month out, as a sensible first suggestion for a copied trip. */
function suggestedStart(): string {
  return new Date(Date.now() + DAYS_AHEAD * 86_400_000).toISOString().slice(0, 10);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { storyId } = await params;
  if (!z.uuid().safeParse(storyId).success) return { title: "Story not found" };
  const story = await loadStory(await createClient(), storyId);
  return { title: story?.title ?? "Story not found" };
}

export default async function StoryPage({ params }: Props) {
  const { storyId } = await params;
  if (!z.uuid().safeParse(storyId).success) notFound();
  const user = await requireUser(`/notes/stories/${storyId}`);
  const supabase = await createClient();
  const story = await loadStory(supabase, storyId);
  if (!story) notFound();
  const handle = (await loadHandles(supabase, [story.authorId])).get(story.authorId);
  const mine = story.authorId === user.id;
  const days = Array.from({ length: story.snapshot.day_count }, (_, index) => ({
    index,
    title: story.snapshot.days.find((day) => day.day_index === index)?.title ?? null,
    stops: story.snapshot.stops
      .filter((stop) => stop.day_index === index)
      .sort((a, b) => a.position - b.position),
  }));
  const defaultDate = suggestedStart();

  return (
    <Screen>
      <article className="flex max-w-[44rem] flex-col gap-8">
        <header className="flex flex-col gap-4">
          <p className="font-mono text-[0.75rem] tracking-[0.1em] text-muted uppercase">
            {story.snapshot.city_name} · {story.snapshot.day_count}{" "}
            {story.snapshot.day_count === 1 ? "day" : "days"} · {story.snapshot.stops.length}{" "}
            {story.snapshot.stops.length === 1 ? "stop" : "stops"}
          </p>
          <h1 className="font-display text-[clamp(2rem,5vw,3rem)] leading-[1.05] font-medium">
            {story.title}
          </h1>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Avatar id={story.authorId} name={story.authorName} size={30} />
              <span className="flex flex-col leading-tight">
                {handle ? (
                  <Link
                    href={`/u/${handle}`}
                    className="text-ui font-semibold underline-offset-4 hover:underline"
                  >
                    {story.authorName}
                  </Link>
                ) : (
                  <span className="text-ui font-semibold">{story.authorName}</span>
                )}
                <span className="text-meta text-muted">
                  <time dateTime={story.publishedAt}>
                    {DATE.format(new Date(story.publishedAt))}
                  </time>
                  {mine ? ` · ${VISIBILITY_LABEL[story.visibility]}` : ""}
                  {story.forks > 0
                    ? ` · forked ${story.forks} ${story.forks === 1 ? "time" : "times"}`
                    : ""}
                </span>
              </span>
            </div>
            {mine ? (
              <span className="flex items-center gap-4">
                <Link
                  href={`/notes/publish/${story.id}`}
                  className="text-ui font-semibold underline underline-offset-4"
                >
                  Edit
                </Link>
                <UnpublishButton storyId={story.id} />
              </span>
            ) : null}
          </div>
        </header>

        <p className="text-lead whitespace-pre-line">{story.body}</p>

        <section aria-labelledby="plan-heading" className="flex flex-col gap-4">
          <h2 id="plan-heading" className="text-body font-semibold">
            The plan
          </h2>
          <ol className="flex flex-col gap-3">
            {days.map((day) => (
              <li
                key={day.index}
                style={hueStyle(dayHue(day.index))}
                className="flex flex-col gap-2 rounded-card bg-panel p-5"
              >
                <h3 className="flex items-center gap-2 text-ui font-semibold">
                  <span className="hue-fill rounded-control px-2 py-0.5 font-mono text-meta">
                    Day {day.index + 1}
                  </span>
                  {day.title}
                </h3>
                {day.stops.length > 0 ? (
                  <ol className="flex list-decimal flex-col gap-1 pl-5 text-body">
                    {day.stops.map((stop) => (
                      <li key={`${stop.source_key}-${stop.position}`}>{stop.place.name}</li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-ui text-muted">A free day.</p>
                )}
              </li>
            ))}
          </ol>
        </section>

        {mine ? null : (
          <section aria-labelledby="fork-heading" className="flex flex-col gap-3">
            <h2 id="fork-heading" className="text-body font-semibold">
              Make it yours
            </h2>
            <p className="max-w-[60ch] text-ui text-muted">
              Forking copies these places and days into a new trip of your own, at your pace and
              budget. {story.authorName} isn&apos;t told, and your copy is private to you.
            </p>
            <ForkForm storyId={story.id} defaultDate={defaultDate} />
          </section>
        )}
      </article>
    </Screen>
  );
}
