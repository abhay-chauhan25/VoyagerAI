import type { Metadata } from "next";
import { Screen, ScreenHeader } from "@/components/app/screen";
import { People } from "@/components/friends/people";
import { loadCircle, loadPeopleToFollow } from "@/lib/friends/queries";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/user/current-user";

export const metadata: Metadata = { title: "Friends" };

type Props = { searchParams: Promise<{ q?: string }> };

export default async function FriendsPage({ searchParams }: Props) {
  const user = await requireUser("/friends");
  const search = ((await searchParams).q ?? "").slice(0, 40);
  const supabase = await createClient();
  const circle = await loadCircle(supabase);
  const connected = [...circle.friends, ...circle.following, ...circle.followers].map((p) => p.id);
  const suggestions = await loadPeopleToFollow(supabase, user.id, connected, search);
  const stats = [
    { label: "Friends", value: circle.counts.friends },
    { label: "Following", value: circle.counts.following },
    { label: "Followers", value: circle.counts.followers },
  ];

  return (
    <Screen>
      <ScreenHeader
        title="Friends"
        subline="Follow travellers with public profiles. When you follow each other, you're friends."
      />

      <dl className="grid grid-cols-3 divide-x divide-rule rounded-card bg-panel">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col-reverse gap-0.5 px-5 py-4">
            <dt className="text-meta text-muted">{stat.label}</dt>
            <dd className="font-display text-[2rem] leading-none font-medium tabular-nums">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>

      {circle.followers.length > 0 ? (
        <People
          heading="Follow back"
          people={circle.followers}
          empty=""
          note={() => "Follows you"}
        />
      ) : null}

      <People
        heading="Friends"
        people={circle.friends}
        empty="No friends yet. Follow someone who follows you, and you're friends."
      />

      {circle.following.length > 0 ? (
        <People
          heading="Following"
          people={circle.following}
          empty=""
          note={() => "Hasn't followed you back"}
        />
      ) : null}

      <div className="flex flex-col gap-3">
        <form action="/friends" className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-ui font-semibold">
            Find travellers
            <input
              type="search"
              name="q"
              defaultValue={search}
              maxLength={40}
              placeholder="Name or handle"
              className="min-h-11 rounded-control border border-control bg-panel px-3 text-body font-normal"
            />
          </label>
          <button
            type="submit"
            className="pressable min-h-11 rounded-control border border-control bg-panel px-4 text-ui font-semibold hover:bg-raised"
          >
            Search
          </button>
        </form>
        <People
          heading={search ? `Travellers matching "${search}"` : "People you could follow"}
          people={suggestions}
          empty={
            search
              ? "Nobody with a public profile matches that."
              : "Nobody else has a public profile yet."
          }
        />
      </div>
    </Screen>
  );
}
