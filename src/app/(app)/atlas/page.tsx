import type { Metadata } from "next";
import Link from "next/link";
import { Screen, ScreenHeader } from "@/components/app/screen";
import { AddPlaceForm } from "@/components/atlas/add-place-form";
import { AtlasMap } from "@/components/atlas/atlas-map";
import { StatsStrip } from "@/components/atlas/stats-strip";
import { VisitList } from "@/components/atlas/visit-list";
import { loadVisits } from "@/lib/atlas/queries";
import { atlasStats } from "@/lib/atlas/stats";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/user/current-user";

export const metadata: Metadata = { title: "Atlas" };

export default async function AtlasPage() {
  const user = await requireUser("/atlas");
  const supabase = await createClient();
  const visits = await loadVisits(supabase, user.id);
  const stats = atlasStats(visits);
  const countryCodes = [...new Set(visits.map((v) => v.country_code))];
  const cities = visits.flatMap((v) => (v.city && v.city_id ? [{ id: v.city_id, ...v.city }] : []));

  const subline =
    stats.countries === 0
      ? "Every place you've been, on one map. Add the first one."
      : `${stats.countries} ${stats.countries === 1 ? "country" : "countries"} across ${stats.continents.length} ${
          stats.continents.length === 1 ? "continent" : "continents"
        }.`;

  return (
    <Screen>
      <ScreenHeader
        title="Atlas"
        subline={subline}
        action={
          <Link href="/dna" className="text-ui font-semibold underline underline-offset-4">
            Your Travel DNA
          </Link>
        }
      />
      <StatsStrip stats={stats} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="h-[50svh] lg:h-[34rem]">
          <AtlasMap
            token={publicEnv().NEXT_PUBLIC_MAPBOX_TOKEN}
            countryCodes={countryCodes}
            cities={cities}
            label={`Globe with ${stats.countries} visited countries highlighted`}
          />
        </div>
        <section
          aria-labelledby="add-heading"
          className="flex flex-col gap-4 rounded-card bg-panel p-5"
        >
          <h2 id="add-heading" className="text-body font-semibold">
            Add a place
          </h2>
          <AddPlaceForm />
        </section>
      </div>

      <section aria-labelledby="places-heading" className="flex flex-col gap-3">
        <h2 id="places-heading" className="text-body font-semibold">
          Places you&apos;ve been
        </h2>
        {visits.length === 0 ? (
          <p className="rounded-card border border-dashed border-control px-5 py-6 text-ui text-muted">
            Nothing yet. Search for a city above, or add a whole country if you don&apos;t remember
            where.
          </p>
        ) : (
          <div className="rounded-card border border-border bg-panel px-5 py-2">
            <VisitList visits={visits} editable />
          </div>
        )}
      </section>

      <p className="text-meta text-muted">
        City data from{" "}
        <a
          href="https://www.geonames.org/"
          className="underline underline-offset-2"
          rel="noreferrer"
          target="_blank"
        >
          GeoNames
        </a>{" "}
        (CC BY 4.0). Country outlines from Natural Earth (public domain).
      </p>
    </Screen>
  );
}
