import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { consumeAiQuota } from "@/lib/ai/quota";
import { parseTripBrief } from "@/lib/brief/parse-trip-brief";
import type { TravelDna } from "@/lib/dna/queries";
import type { Database } from "@/lib/supabase/database.types";
import type { DestinationCard } from "./cards";
import { destinationCardFor } from "./destinations";
import { describeCities } from "./enrich";
import { groundSuggestions, type City } from "./ground";
import { describeProfile } from "./prompts";
import { providers } from "./providers";

type Client = SupabaseClient<Database>;

export const searchQuerySchema = z
  .string()
  .trim()
  .min(3, "Tell Compass a little more.")
  .max(300, "Keep it under 300 characters.");

export type SearchOutcome = {
  source: "compass" | "fallback";
  summary: string;
  cards: DestinationCard[];
  notice: string | null;
};

async function cardsFor(
  cities: { city: City; why: string; interests: DestinationCard["interests"] }[],
) {
  const details = await describeCities(
    providers(),
    cities.map((c) => c.city),
  );
  return cities.flatMap((pick, index) => {
    const parsed = destinationCardFor(
      pick.city,
      pick.why,
      pick.interests,
      details[index] ?? { blurb: null, photo: null },
    );
    return parsed.success ? [parsed.data] : [];
  });
}

/** Without AI: if the request names a place, find it in the city list; otherwise say so plainly. */
async function fallbackSearch(
  supabase: Client,
  query: string,
  notice: string,
): Promise<SearchOutcome> {
  const brief = parseTripBrief(query);
  if (!brief.destination) {
    return {
      source: "fallback",
      summary: "",
      cards: [],
      notice: `${notice} Name a city to search for it directly.`,
    };
  }
  const { data, error } = await supabase.rpc("search_cities", {
    query: brief.destination,
    max_results: 1,
  });
  if (error) throw new Error(`City lookup failed (${error.code})`);
  const city = data[0];
  if (!city)
    return {
      source: "fallback",
      summary: "",
      cards: [],
      notice: `${notice} We couldn't find "${brief.destination}".`,
    };
  const cards = await cardsFor([
    { city, why: `You asked about ${city.name}.`, interests: brief.interests.slice(0, 3) },
  ]);
  return { source: "fallback", summary: `Places matching "${brief.destination}".`, cards, notice };
}

/** Ask Compass: a plain-language request answered with real, grounded destinations. */
export async function askCompass(
  supabase: Client,
  dna: TravelDna,
  query: string,
): Promise<SearchOutcome> {
  if (!(await consumeAiQuota(supabase))) {
    return fallbackSearch(supabase, query, "You've used today's Compass requests.");
  }
  const ai = await providers().answerSearch(describeProfile(dna), query);
  if (!ai.ok) {
    const notice =
      ai.reason === "disabled"
        ? "Compass is switched off (no Gemini key)."
        : "Compass couldn't answer just now.";
    return fallbackSearch(supabase, query, notice);
  }
  const { matched, dropped } = await groundSuggestions(supabase, ai.data.destinations);
  const cards = await cardsFor(
    matched.map(({ suggestion, city }) => ({
      city,
      why: suggestion.why,
      interests: suggestion.interests,
    })),
  );
  return {
    source: "compass",
    summary: ai.data.summary,
    cards,
    notice:
      dropped > 0
        ? `Compass suggested ${dropped} place${dropped === 1 ? "" : "s"} we couldn't verify, so ${dropped === 1 ? "it was" : "they were"} left out.`
        : null,
  };
}
