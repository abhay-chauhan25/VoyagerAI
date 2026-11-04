import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { consumeAiQuota } from "@/lib/ai/quota";
import type { TravelDna } from "@/lib/dna/queries";
import { UpstreamError } from "@/lib/places/http";
import type { Database } from "@/lib/supabase/database.types";
import { activityCardSchema, parseStoredCards, type ActivityCard } from "./cards";
import { loadCachedDeck, loadSaves, storeDeck } from "./context";
import { photosForWikidata } from "./enrich";
import type { City } from "./ground";
import { describeProfile } from "./prompts";
import { providers, type Providers } from "./providers";
import { rankActivities, templateWhy } from "./rank";

type Client = SupabaseClient<Database>;

export const ACTIVITY_DECK_SIZE = 12;

/**
 * Places near a city: OpenStreetMap first (richest: hours, cafés, markets), then Wikipedia's
 * notable places when the volunteer-run Overpass servers are down. Says whether any source answered,
 * so "unreachable" and "nothing found" are reported differently.
 */
async function findPlaces(p: Providers, city: City) {
  let reached = false;
  for (const [label, lookup] of [
    ["OpenStreetMap", () => p.activities(city.latitude, city.longitude)],
    ["Wikipedia", () => p.nearbyLandmarks(city.latitude, city.longitude)],
  ] as const) {
    try {
      const found = await lookup();
      reached = true;
      if (found.skipped > 0)
        console.warn("Skipped unusable place records", { source: label, skipped: found.skipped });
      if (found.activities.length > 0) return { found, reached };
    } catch (error) {
      if (!(error instanceof UpstreamError)) throw error;
      console.error("Place lookup failed", {
        source: label,
        service: error.service,
        status: error.status,
      });
    }
  }
  return { found: null, reached };
}

export type ActivityOutcome =
  | { ok: true; cards: ActivityCard[]; source: "compass" | "fallback" }
  | { ok: false; message: string };

/**
 * A deck of real places near a destination, ranked by the traveller's Travel DNA. Compass writes
 * the "why" lines when it can; otherwise they come from the traveller's own interests.
 */
export async function activityDeck(
  supabase: Client,
  userId: string,
  dna: TravelDna,
  city: City,
  { force = false }: { force?: boolean } = {},
): Promise<ActivityOutcome> {
  const deckKey = `activities:${city.geoname_id}`;
  if (!force) {
    const cached = await loadCachedDeck(supabase, userId, deckKey);
    if (cached) {
      const cards = parseStoredCards(cached.cards).filter(
        (c): c is ActivityCard => c.kind === "activity",
      );
      return { ok: true, cards, source: cached.source };
    }
  }

  const p = providers();
  const { found, reached } = await findPlaces(p, city);
  if (!found) {
    return {
      ok: false,
      message: reached
        ? `We couldn't find places to suggest around ${city.name} yet.`
        : "We couldn't reach OpenStreetMap or Wikipedia just now. Try again in a minute.",
    };
  }

  const judged = new Set((await loadSaves(supabase, userId)).map((s) => s.card.sourceKey));
  const ranked = rankActivities(
    found.activities.filter((a) => !judged.has(a.sourceKey)),
    dna.weights,
    ACTIVITY_DECK_SIZE,
  );
  if (ranked.length === 0) {
    return { ok: false, message: `We couldn't find places to suggest around ${city.name} yet.` };
  }

  const photos = await photosForWikidata(
    p,
    ranked.map((a) => a.wikidata),
  );
  const items = ranked.map((a, index) => ({
    id: `p${index + 1}`,
    name: a.name,
    category: a.category,
  }));
  let lines = new Map<string, string>();
  let source: "compass" | "fallback" = "fallback";
  if (await consumeAiQuota(supabase)) {
    const ai = await p.writeWhyLines(describeProfile(dna), items);
    if (ai.ok) {
      lines = new Map(ai.data.lines.map((line) => [line.id, line.why]));
      if (lines.size > 0) source = "compass";
    }
  }

  const cards: ActivityCard[] = [];
  ranked.forEach((activity, index) => {
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
      why:
        lines.get(`p${index + 1}`) ??
        templateWhy(activity.interests, dna.weights, activity.category),
      photo: photos[index] ?? null,
    });
    if (parsed.success) cards.push(parsed.data);
    else
      console.error("Dropped an activity card that failed validation", {
        sourceKey: activity.sourceKey,
      });
  });

  await storeDeck(supabase, userId, deckKey, source, cards);
  return { ok: true, cards, source };
}
