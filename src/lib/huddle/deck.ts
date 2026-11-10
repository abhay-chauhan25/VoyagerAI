import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findPlaces } from "@/lib/drift/activities";
import { activityCardSchema, parseStoredCards, type ActivityCard } from "@/lib/drift/cards";
import { today } from "@/lib/drift/context";
import { photosForWikidata } from "@/lib/drift/enrich";
import { providers } from "@/lib/drift/providers";
import { rankActivities } from "@/lib/drift/rank";
import type { Database } from "@/lib/supabase/database.types";
import { groupWeights, groupWhy, type Member } from "./group";

type Client = SupabaseClient<Database>;

export const GROUP_DECK_SIZE = 15;

export type GroupDeckOutcome = { ok: true; cards: ActivityCard[] } | { ok: false; message: string };

/**
 * The shared Group Drift deck for a trip's city: the same cards for every member, ranked by the
 * group's blended top interests, with "why" lines naming who in the group each place suits. No AI:
 * the lines are built from what members share. Built once a day by whoever opens it first.
 */
export async function groupDeck(
  supabase: Client,
  trip: { id: string; cityId: number },
  members: readonly Member[],
): Promise<GroupDeckOutcome> {
  const { data: cached, error: cacheError } = await supabase
    .from("group_decks")
    .select("cards, built_on")
    .eq("trip_id", trip.id)
    .maybeSingle();
  if (cacheError) throw new Error(`Could not load the group deck (${cacheError.code})`);
  if (cached && cached.built_on === today()) {
    return {
      ok: true,
      cards: parseStoredCards(cached.cards).filter((c): c is ActivityCard => c.kind === "activity"),
    };
  }

  const { data: city, error: cityError } = await supabase
    .from("cities")
    .select("*")
    .eq("geoname_id", trip.cityId)
    .single();
  if (cityError) throw new Error(`Could not load the city (${cityError.code})`);

  const p = providers();
  const { found, reached } = await findPlaces(p, city);
  if (!found) {
    return {
      ok: false,
      message: reached
        ? `We couldn't find places around ${city.name} for the group yet.`
        : "We couldn't reach OpenStreetMap or Wikipedia just now. Try again in a minute.",
    };
  }
  const ranked = rankActivities(found.activities, groupWeights(members), GROUP_DECK_SIZE);
  const photos = await photosForWikidata(
    p,
    ranked.map((a) => a.wikidata),
  );
  const cards = ranked.flatMap((activity, index) => {
    const parsed = activityCardSchema.safeParse({
      kind: "activity",
      sourceKey: activity.sourceKey,
      dataSource: activity.dataSource,
      sourceUrl: activity.sourceUrl,
      cityId: city.geoname_id,
      cityName: city.name,
      name: activity.name,
      category: activity.category,
      interests: activity.interests,
      latitude: activity.latitude,
      longitude: activity.longitude,
      openingHours: activity.openingHours,
      website: activity.website,
      why: groupWhy(activity.interests, members),
      photo: photos[index] ?? null,
    });
    if (!parsed.success) {
      console.error("Dropped a group card that failed validation", {
        sourceKey: activity.sourceKey,
      });
      return [];
    }
    return [parsed.data];
  });

  const { error } = await supabase
    .from("group_decks")
    .upsert({ trip_id: trip.id, built_on: today(), cards }, { onConflict: "trip_id" });
  if (error) throw new Error(`Could not store the group deck (${error.code})`);
  return { ok: true, cards };
}
