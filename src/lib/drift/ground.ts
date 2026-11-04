import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;
export type City = Database["public"]["Tables"]["cities"]["Row"];
export type Suggestion = { name: string; countryCode: string };

/**
 * Checks AI suggestions against the GeoNames list: a suggestion counts only if a city with that
 * name exists in that country. Unmatched suggestions are dropped and counted, never shown; repeats
 * and excluded cities are removed.
 */
export async function groundSuggestions<T extends Suggestion>(
  supabase: Client,
  suggestions: readonly T[],
  exclude: ReadonlySet<number> = new Set(),
): Promise<{ matched: { suggestion: T; city: City }[]; dropped: number }> {
  // Look every suggestion up at once; order and de-duplication are applied afterwards.
  const lookups = await Promise.all(
    suggestions.map(async (suggestion) => {
      const { data, error } = await supabase.rpc("search_cities", {
        query: suggestion.name,
        max_results: 10,
      });
      if (error) throw new Error(`City lookup failed (${error.code})`);
      const prefix = suggestion.name.toLowerCase().slice(0, 4);
      return data.find(
        (c) => c.country_code === suggestion.countryCode && c.name.toLowerCase().startsWith(prefix),
      );
    }),
  );
  const matched: { suggestion: T; city: City }[] = [];
  const seen = new Set<number>(exclude);
  let dropped = 0;
  suggestions.forEach((suggestion, index) => {
    const city = lookups[index];
    if (!city) {
      dropped += 1;
      return;
    }
    if (seen.has(city.geoname_id)) return;
    seen.add(city.geoname_id);
    matched.push({ suggestion, city });
  });
  if (dropped > 0) console.warn("Dropped AI suggestions that matched no real city", { dropped });
  return { matched, dropped };
}
