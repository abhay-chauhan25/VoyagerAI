import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findPlaces } from "@/lib/drift/activities";
import { activityCardSchema, type ActivityCard } from "@/lib/drift/cards";
import { providers } from "@/lib/drift/providers";
import { rankActivities } from "@/lib/drift/rank";
import type { InterestWeights } from "@/lib/dna/score";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

/** How many places Compass may choose from beyond the traveller's own saves. */
const BY_TASTE = 18;
const TO_EAT = 8;
const FOOD = new Set(["Food", "Coffee", "Wine", "Markets"]);

/** Words in a request that mean "put more into the trip". */
export const WANTS_MORE =
  /\b(add|more|another|extra|fill|busy|busier|fuller|eat|food|lunch|dinner|breakfast|brunch|coffee|caf[eé]s?|restaurants?|bars?|drinks?|something to do|suggest|recommend)\b/i;

/**
 * Real places in the trip's city that the traveller hasn't saved, for Compass to draw on when
 * asked to add to a trip: the best matches for their Travel DNA, plus places to eat and drink
 * whatever their tastes, since a full day needs meals. Returns nothing (and says why in the log)
 * when the free place services can't be reached, so the request still gets an answer.
 */
export async function citySuggestions(
  supabase: Client,
  cityId: number,
  weights: InterestWeights,
  exclude: ReadonlySet<string>,
): Promise<ActivityCard[]> {
  const { data: city, error } = await supabase
    .from("cities")
    .select("*")
    .eq("geoname_id", cityId)
    .single();
  if (error) throw new Error(`Could not load the city (${error.code})`);

  const { found } = await findPlaces(providers(), city);
  if (!found) return [];
  const fresh = found.activities.filter((activity) => !exclude.has(activity.sourceKey));
  const byTaste = rankActivities(fresh, weights, BY_TASTE);
  const chosen = new Set(byTaste.map((activity) => activity.sourceKey));
  const toEat = rankActivities(
    fresh.filter(
      (activity) => !chosen.has(activity.sourceKey) && activity.interests.some((i) => FOOD.has(i)),
    ),
    weights,
    TO_EAT,
  );

  return [...byTaste, ...toEat].flatMap((activity) => {
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
      why: "Suggested by Compass for this trip.",
      photo: null,
    });
    return parsed.success ? [parsed.data] : [];
  });
}
