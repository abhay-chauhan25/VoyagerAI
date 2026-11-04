import { continentOf } from "@/lib/atlas/countries";
import { describeWeight, type InterestWeights } from "@/lib/dna/score";
import type { Interest } from "@/lib/interests";
import type { Activity } from "@/lib/places/types";

const NOTABLE_BONUS = 0.15; // has a Wikidata entry: usually a landmark people travel for
const HOURS_BONUS = 0.05; // opening hours known: easier to plan
const REPEAT_PENALTY = 0.25; // per card already dealt in the same category

/** How well an activity fits a traveller: their strongest matching interest, plus small bonuses. */
export function scoreActivity(activity: Activity, weights: InterestWeights): number {
  const fit = Math.max(...activity.interests.map((i) => weights[i] ?? 0), 0);
  const worst = Math.min(...activity.interests.map((i) => weights[i] ?? 0), 0);
  // If every interest it signals is one the traveller skips, it scores below zero.
  const base = fit > 0 ? fit : worst;
  return base + (activity.wikidata ? NOTABLE_BONUS : 0) + (activity.openingHours ? HOURS_BONUS : 0);
}

/**
 * The best `count` activities for a traveller, varied: each pick is the highest score after a
 * penalty for categories already chosen. Things the traveller skips come last, never first.
 */
export function rankActivities(
  activities: readonly Activity[],
  weights: InterestWeights,
  count: number,
): Activity[] {
  const pool = activities.map((activity) => ({
    activity,
    score: scoreActivity(activity, weights),
  }));
  const chosen: Activity[] = [];
  const perCategory = new Map<string, number>();
  while (chosen.length < count && pool.length > 0) {
    let bestIndex = 0;
    let bestScore = -Infinity;
    pool.forEach((entry, index) => {
      const adjusted =
        entry.score - REPEAT_PENALTY * (perCategory.get(entry.activity.category) ?? 0);
      if (
        adjusted > bestScore ||
        (adjusted === bestScore && entry.activity.name < (pool[bestIndex]?.activity.name ?? ""))
      ) {
        bestScore = adjusted;
        bestIndex = index;
      }
    });
    const [picked] = pool.splice(bestIndex, 1);
    if (!picked) break;
    chosen.push(picked.activity);
    perCategory.set(picked.activity.category, (perCategory.get(picked.activity.category) ?? 0) + 1);
  }
  return chosen;
}

const VERB: Record<string, string> = { Loves: "love", Enjoys: "enjoy", "Open to": "are open to" };

/** A plain-words reason built from the traveller's own weights, used when the AI can't write one. */
export function templateWhy(
  interests: readonly Interest[],
  weights: InterestWeights,
  category: string,
): string {
  const best = [...interests].sort((a, b) => (weights[b] ?? 0) - (weights[a] ?? 0))[0];
  const weight = best ? (weights[best] ?? 0) : 0;
  const verb = VERB[describeWeight(weight)];
  if (best && weight > 0 && verb) {
    return `You ${verb} ${best.toLowerCase()}, and this ${category.toLowerCase()} is close by.`;
  }
  return `A well-known ${category.toLowerCase()} nearby.`;
}

type CityRow = { geoname_id: number; name: string; country_code: string; population: number };

/**
 * The non-AI destination deck: large cities the traveller hasn't been to or already judged, taken
 * in turn from each continent so the deck isn't all one region.
 */
export function pickFallbackDestinations(
  cities: readonly CityRow[],
  exclude: ReadonlySet<number>,
  count: number,
): CityRow[] {
  const byContinent = new Map<string, CityRow[]>();
  for (const city of [...cities].sort((a, b) => b.population - a.population)) {
    if (exclude.has(city.geoname_id)) continue;
    const continent = continentOf(city.country_code) ?? "??";
    const list = byContinent.get(continent) ?? [];
    // One city per country keeps the deck varied (no five Chinese megacities in a row).
    if (!list.some((c) => c.country_code === city.country_code)) list.push(city);
    byContinent.set(continent, list);
  }
  const queues = [...byContinent.values()];
  const picked: CityRow[] = [];
  for (let round = 0; picked.length < count && queues.some((q) => q.length > round); round += 1) {
    for (const queue of queues) {
      const city = queue[round];
      if (city && picked.length < count) picked.push(city);
    }
  }
  return picked;
}
