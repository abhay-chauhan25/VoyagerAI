import Link from "next/link";
import { Avatar } from "@/components/shell/avatar";
import type { FeedItem, FeedNote, FeedStory } from "@/lib/notes/queries";
import { VISIBILITY_LABEL } from "@/lib/notes/schemas";
import { DeleteNote, FollowButton } from "./note-controls";
import { Stars } from "./stars";

type Context = {
  me: string;
  following: ReadonlySet<string>;
  /** Authors with a public profile, by id. */
  handles: ReadonlyMap<string, string>;
};

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

function Byline({ item, context }: { item: FeedItem; context: Context }) {
  const handle = context.handles.get(item.authorId);
  const mine = item.authorId === context.me;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <Avatar id={item.authorId} name={item.authorName} size={30} />
        <span className="flex flex-col leading-tight">
          {handle ? (
            <Link
              href={`/u/${handle}`}
              className="text-ui font-semibold underline-offset-4 hover:underline"
            >
              {item.authorName}
            </Link>
          ) : (
            <span className="text-ui font-semibold">{item.authorName}</span>
          )}
          <span className="text-meta text-muted">
            <time dateTime={item.at}>{DATE.format(new Date(item.at))}</time>
            {mine ? ` · ${VISIBILITY_LABEL[item.visibility]}` : ""}
          </span>
        </span>
      </div>
      {/* Only public profiles can be followed, so the button appears only for those. */}
      {!mine && handle ? (
        <FollowButton
          userId={item.authorId}
          name={item.authorName}
          following={context.following.has(item.authorId)}
        />
      ) : null}
    </div>
  );
}

function NoteCard({ note, context }: { note: FeedNote; context: Context }) {
  return (
    <article
      aria-label={`${note.authorName} on ${note.placeName}`}
      className="flex flex-col gap-3 rounded-card bg-panel p-5"
    >
      <Byline item={note} context={context} />
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-body font-semibold">
          {note.placeName}
          <span className="font-normal text-muted"> · {note.cityName}</span>
        </h3>
        <Stars rating={note.rating} />
      </div>
      <p className="max-w-[68ch] text-body whitespace-pre-line">{note.body}</p>
      {note.photos.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {note.photos.map((photo) => (
            <li key={photo.id} className="aspect-square overflow-hidden rounded-control bg-surface">
              {/* Signed, short-lived storage links: the image optimiser can't fetch them. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.alt}
                loading="lazy"
                className="size-full object-cover"
              />
            </li>
          ))}
        </ul>
      ) : null}
      {note.authorId === context.me ? <DeleteNote noteId={note.id} /> : null}
    </article>
  );
}

function StoryCard({ story, context }: { story: FeedStory; context: Context }) {
  return (
    <article
      aria-label={`${story.authorName}'s story: ${story.title}`}
      className="flex flex-col gap-3 rounded-card bg-panel p-5"
    >
      <Byline item={story} context={context} />
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-title leading-tight font-medium">
          <Link href={`/notes/stories/${story.id}`} className="underline-offset-4 hover:underline">
            {story.title}
          </Link>
        </h3>
        <p className="font-mono text-[0.75rem] tracking-[0.1em] text-muted uppercase">
          {story.cityName} · {story.dayCount} {story.dayCount === 1 ? "day" : "days"} ·{" "}
          {story.stopCount} {story.stopCount === 1 ? "stop" : "stops"}
        </p>
      </div>
      <p className="line-clamp-3 max-w-[68ch] text-body whitespace-pre-line">{story.body}</p>
      <Link
        href={`/notes/stories/${story.id}`}
        className="self-start text-ui font-semibold underline underline-offset-4"
      >
        Read the trip
      </Link>
    </article>
  );
}

/** Notes and stories, newest first. */
export function Feed({ items, context }: { items: FeedItem[]; context: Context }) {
  return (
    <ul className="flex flex-col gap-4">
      {items.map((item) => (
        <li key={`${item.kind}-${item.id}`}>
          {item.kind === "note" ? (
            <NoteCard note={item} context={context} />
          ) : (
            <StoryCard story={item} context={context} />
          )}
        </li>
      ))}
    </ul>
  );
}
