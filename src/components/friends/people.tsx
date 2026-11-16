import Link from "next/link";
import { FollowButton } from "@/components/notes/note-controls";
import { Avatar } from "@/components/shell/avatar";
import type { Person } from "@/lib/friends/queries";

/** A list of travellers, each with a way to follow, follow back or unfollow. */
export function People({
  heading,
  people,
  empty,
  note,
}: {
  heading: string;
  people: Person[];
  empty: string;
  /** A line under each name, such as "Follows you". */
  note?: (person: Person) => string | null;
}) {
  const id = `people-${heading.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-body font-semibold">
        {heading}
      </h2>
      {people.length === 0 ? (
        <p className="rounded-card border border-dashed border-control px-5 py-5 text-ui text-muted">
          {empty}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-rule rounded-card bg-panel">
          {people.map((person) => {
            const line = note?.(person) ?? null;
            return (
              <li
                key={person.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar id={person.id} name={person.name} size={34} />
                  <span className="flex min-w-0 flex-col leading-tight">
                    {person.isPublic && person.handle ? (
                      <Link
                        href={`/u/${person.handle}`}
                        className="truncate text-ui font-semibold underline-offset-4 hover:underline"
                      >
                        {person.name}
                      </Link>
                    ) : (
                      <span className="truncate text-ui font-semibold">{person.name}</span>
                    )}
                    <span className="text-meta text-muted">
                      {[person.handle ? `@${person.handle}` : null, line]
                        .filter(Boolean)
                        .join(" · ") || "Private profile"}
                    </span>
                  </span>
                </span>
                <FollowButton
                  userId={person.id}
                  name={person.name}
                  following={person.iFollow}
                  followsMe={person.followsMe}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
