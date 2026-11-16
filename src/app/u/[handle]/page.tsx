import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Wordmark } from "@/components/brand/mark";
import { AtlasMap } from "@/components/atlas/atlas-map";
import { StatsStrip } from "@/components/atlas/stats-strip";
import { VisitList } from "@/components/atlas/visit-list";
import { Feed } from "@/components/notes/feed";
import { FollowButton } from "@/components/notes/note-controls";
import { Avatar } from "@/components/shell/avatar";
import { loadVisits } from "@/lib/atlas/queries";
import { atlasStats } from "@/lib/atlas/stats";
import { loadTravelDna } from "@/lib/dna/queries";
import { describeWeight, rankTraits } from "@/lib/dna/score";
import { PACE_LABELS } from "@/lib/dna/schemas";
import { publicEnv } from "@/lib/env";
import { loadFeed } from "@/lib/notes/queries";
import { createClient } from "@/lib/supabase/server";
import { findProfileByHandle } from "@/lib/user/public-profile";

type Params = { params: Promise<{ handle: string }> };

const TOP_TRAITS = 5;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const profile = await findProfileByHandle((await params).handle);
  return profile ? { title: `${profile.displayName}'s travels` } : { title: "Profile not found" };
}

export default async function PublicProfilePage({ params }: Params) {
  const profile = await findProfileByHandle((await params).handle);
  if (!profile) notFound();

  const supabase = await createClient();
  const [visits, dna] = await Promise.all([
    loadVisits(supabase, profile.id),
    loadTravelDna(supabase, profile.id),
  ]);
  // A signed-in visitor can follow a public profile; visitors and the owner see no button.
  const { data: session } = await supabase.auth.getClaims();
  const viewerId = session?.claims?.sub ?? null;
  const canFollow = Boolean(viewerId) && viewerId !== profile.id && profile.isPublic;
  // Notes and contact details are for signed-in travellers; each is filtered by its owner's choices.
  const [notes, contactRows] = viewerId
    ? await Promise.all([
        loadFeed(supabase, profile.id, "mine"),
        supabase.rpc("profile_contact", { p_user: profile.id }),
      ])
    : [[], null];
  const contact = contactRows?.data?.[0] ?? null;
  let followsMe = false;
  let following = false;
  if (canFollow && viewerId) {
    const { data: back } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", profile.id)
      .eq("followee_id", viewerId)
      .maybeSingle();
    followsMe = Boolean(back);
    const { data: follow } = await supabase
      .from("follows")
      .select("followee_id")
      .eq("follower_id", viewerId)
      .eq("followee_id", profile.id)
      .maybeSingle();
    following = Boolean(follow);
  }
  const stats = atlasStats(visits);
  const traits = dna ? rankTraits(dna.weights, {}).slice(0, TOP_TRAITS) : [];
  const countryCodes = [...new Set(visits.map((v) => v.country_code))];
  const cities = visits.flatMap((v) => (v.city && v.city_id ? [{ id: v.city_id, ...v.city }] : []));

  return (
    <div className="min-h-svh bg-ground text-ink">
      <header className="flex h-14 items-center justify-between px-4 sm:px-8">
        <Link href="/" aria-label="Voyager home" className="rounded-control">
          <Wordmark />
        </Link>
        <Link href="/sign-up" className="text-ui font-semibold underline underline-offset-4">
          Plan with Voyager
        </Link>
      </header>

      <main
        id="main"
        className="mx-auto flex w-full max-w-[72rem] flex-col gap-8 px-4 py-6 sm:px-8 lg:py-10"
      >
        {!profile.isPublic ? (
          <p role="status" className="rounded-control bg-surface px-4 py-3 text-ui">
            Only you can see this page. Turn on Public profile in Account to share it.
          </p>
        ) : null}

        <div className="flex items-center gap-4">
          <Avatar id={profile.id} name={profile.displayName} size={48} />
          <div className="flex flex-col">
            <h1 className="text-title font-semibold">{profile.displayName}</h1>
            <p className="text-ui text-muted">
              @{profile.handle}
              {profile.homeCity ? ` · ${profile.homeCity}` : ""}
            </p>
          </div>
          {canFollow ? (
            <div className="ml-auto">
              <FollowButton
                userId={profile.id}
                name={profile.displayName}
                following={following}
                followsMe={followsMe}
              />
            </div>
          ) : null}
        </div>

        {profile.bio || profile.website || contact?.contact_email || contact?.phone ? (
          <section aria-label="About" className="flex max-w-[60ch] flex-col gap-3">
            {profile.bio ? <p className="text-body whitespace-pre-line">{profile.bio}</p> : null}
            <ul className="flex flex-wrap gap-x-6 gap-y-1 text-ui">
              {profile.website ? (
                <li>
                  <a
                    href={profile.website}
                    rel="noopener noreferrer nofollow"
                    target="_blank"
                    className="font-semibold underline underline-offset-4"
                  >
                    {profile.website.replace(/^https:\/\//, "").replace(/\/$/, "")}
                  </a>
                </li>
              ) : null}
              {contact?.contact_email ? (
                <li>
                  <a
                    href={`mailto:${contact.contact_email}`}
                    className="font-semibold underline underline-offset-4"
                  >
                    {contact.contact_email}
                  </a>
                </li>
              ) : null}
              {contact?.phone ? (
                <li>
                  <a
                    href={`tel:${contact.phone.replace(/[^+0-9]/g, "")}`}
                    className="font-semibold underline underline-offset-4"
                  >
                    {contact.phone}
                  </a>
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}

        <StatsStrip stats={stats} />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="h-[50svh] lg:h-[32rem]">
            <AtlasMap
              token={publicEnv().NEXT_PUBLIC_MAPBOX_TOKEN}
              countryCodes={countryCodes}
              cities={cities}
              label={`Globe with ${stats.countries} countries ${profile.displayName} has visited`}
            />
          </div>
          <section
            aria-labelledby="dna-heading"
            className="flex flex-col gap-3 self-start rounded-card bg-panel p-5"
          >
            <h2 id="dna-heading" className="text-body font-semibold">
              Travel DNA
            </h2>
            {dna && traits.length > 0 ? (
              <>
                <ul className="flex flex-col">
                  {traits.map((trait) => (
                    <li
                      key={trait.interest}
                      className="flex items-baseline justify-between border-t border-rule py-2 first:border-t-0"
                    >
                      <span className="text-ui font-semibold">{trait.interest}</span>
                      <span className="text-meta text-muted">{describeWeight(trait.weight)}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-meta text-muted">
                  Travels at a {PACE_LABELS[dna.pace].toLowerCase()} pace.
                </p>
              </>
            ) : (
              <p className="text-ui text-muted">Not shared yet.</p>
            )}
          </section>
        </div>

        <section aria-labelledby="places-heading" className="flex flex-col gap-3">
          <h2 id="places-heading" className="text-body font-semibold">
            Places
          </h2>
          {visits.length === 0 ? (
            <p className="rounded-card border border-dashed border-control px-5 py-6 text-ui text-muted">
              No places yet.
            </p>
          ) : (
            <div className="rounded-card border border-border bg-panel px-5 py-2">
              <VisitList visits={visits} editable={false} />
            </div>
          )}
        </section>
        <section aria-labelledby="notes-heading" className="flex flex-col gap-3">
          <h2 id="notes-heading" className="text-body font-semibold">
            Notes and stories
          </h2>
          {!viewerId ? (
            <p className="rounded-card border border-dashed border-control px-5 py-6 text-ui text-muted">
              Sign in to read what {profile.displayName} has shared.
            </p>
          ) : notes.length === 0 ? (
            <p className="rounded-card border border-dashed border-control px-5 py-6 text-ui text-muted">
              Nothing shared with you yet.
            </p>
          ) : (
            <Feed
              items={notes}
              context={{
                me: viewerId,
                following: new Set(following ? [profile.id] : []),
                // The byline is already this page's subject: no second link or follow button.
                handles: new Map(),
              }}
            />
          )}
        </section>
      </main>
    </div>
  );
}
