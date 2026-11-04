import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { consumeAiQuota } from "@/lib/ai/quota";
import { continentName, continentOf } from "@/lib/atlas/countries";
import type { TravelDna } from "@/lib/dna/queries";
import type { Database } from "@/lib/supabase/database.types";
import { destinationCardSchema, parseStoredCards, type DestinationCard } from "./cards";
import { loadCachedDeck, loadSaves, loadVisitedCities, storeDeck } from "./context";
import { describeCities } from "./enrich";
import { groundSuggestions, type City } from "./ground";
import { describeProfile } from "./prompts";
import { providers } from "./providers";
import { pickFallbackDestinations } from "./rank";

type Client = SupabaseClient<Database>;

export const DECK_SIZE = 10;
const MIN_GROUNDED = 3; // fewer real cities than this and the fallback deck is better
const FALLBACK_MIN_POPULATION = 1_000_000;

export type DeckSource = "compass" | "fallback";
export type DeckOutcome = { cards: DestinationCard[]; source: DeckSource };

function toCard(
  city: City,
  why: string,
  interests: DestinationCard["interests"],
  extra: Pick<DestinationCard, "blurb" | "photo">,
) {
  return destinationCardSchema.safeParse({
    kind: "destination",
    sourceKey: `geonames:${city.geoname_id}`,
    cityId: city.geoname_id,
    name: city.name,
    region: city.region,
    countryCode: city.country_code,
    latitude: city.latitude,
    longitude: city.longitude,
    why,
    interests,
    ...extra,
  });
}

async function fallbackCities(
  supabase: Client,
  exclude: ReadonlySet<number>,
): Promise<{ city: City; why: string }[]> {
  const { data, error } = await supabase
    .from("cities")
    .select("*")
    .gte("population", FALLBACK_MIN_POPULATION)
    .order("population", { ascending: false })
    .limit(400);
  if (error) throw new Error(`Could not load cities (${error.code})`);
  return pickFallbackDestinations(data, exclude, DECK_SIZE).map((row) => {
    const city = data.find((c) => c.geoname_id === row.geoname_id) as City;
    const continent = continentOf(city.country_code);
    return {
      city,
      why: `One of ${continent ? continentName(continent) : "the world"}'s great cities, and somewhere you haven't been yet.`,
    };
  });
}

/**
 * Today's destination deck: Compass suggestions grounded in real cities, or (when the AI is off,
 * out of quota or fails) large cities the traveller hasn't seen. Cached per day; `force` rebuilds.
 */
export async function destinationDeck(
  supabase: Client,
  userId: string,
  dna: TravelDna,
  { force = false }: { force?: boolean } = {},
): Promise<DeckOutcome> {
  if (!force) {
    const cached = await loadCachedDeck(supabase, userId, "destinations");
    if (cached) {
      const cards = parseStoredCards(cached.cards).filter(
        (c): c is DestinationCard => c.kind === "destination",
      );
      return { cards, source: cached.source };
    }
  }

  const [saves, visited] = await Promise.all([
    loadSaves(supabase, userId),
    loadVisitedCities(supabase, userId),
  ]);
  const judged = saves.filter((s) => s.card.kind === "destination");
  const exclude = new Set([...visited.map((v) => v.id), ...judged.map((s) => s.card.cityId)]);
  const excludeNames = [...visited.map((v) => v.name), ...judged.map((s) => s.card.name)].slice(
    0,
    80,
  );
  const p = providers();

  let picks: { city: City; why: string; interests: DestinationCard["interests"] }[] = [];
  let source: DeckSource = "fallback";
  if (await consumeAiQuota(supabase)) {
    const ai = await p.suggestDestinations(describeProfile(dna), excludeNames, DECK_SIZE);
    if (ai.ok) {
      const { matched } = await groundSuggestions(supabase, ai.data.destinations, exclude);
      if (matched.length >= MIN_GROUNDED) {
        picks = matched.slice(0, DECK_SIZE).map(({ suggestion, city }) => ({
          city,
          why: suggestion.why,
          interests: suggestion.interests,
        }));
        source = "compass";
      }
    }
  }
  if (picks.length === 0) {
    picks = (await fallbackCities(supabase, exclude)).map((pick) => ({ ...pick, interests: [] }));
  }

  const details = await describeCities(
    p,
    picks.map((pick) => pick.city),
  );
  const cards: DestinationCard[] = [];
  picks.forEach((pick, index) => {
    const parsed = toCard(
      pick.city,
      pick.why,
      pick.interests,
      details[index] ?? { blurb: null, photo: null },
    );
    if (parsed.success) cards.push(parsed.data);
    else
      console.error("Dropped a destination card that failed validation", {
        city: pick.city.geoname_id,
      });
  });

  await storeDeck(supabase, userId, "destinations", source, cards);
  return { cards, source };
}

export { toCard as destinationCardFor };
