import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Wordmark } from "@/components/brand/mark";
import { AtlasMap } from "@/components/atlas/atlas-map";
import { StatsStrip } from "@/components/atlas/stats-strip";
import { VisitList } from "@/components/atlas/visit-list";
import { Avatar } from "@/components/shell/avatar";
import { loadVisits } from "@/lib/atlas/queries";
import { atlasStats } from "@/lib/atlas/stats";
import { loadTravelDna } from "@/lib/dna/queries";
import { describeWeight, rankTraits } from "@/lib/dna/score";
import { PACE_LABELS } from "@/lib/dna/schemas";
import { publicEnv } from "@/lib/env";
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
        </div>

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
      </main>
    </div>
  );
}
