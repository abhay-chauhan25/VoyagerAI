import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { cardSchema, type Card } from "./cards";

type Client = SupabaseClient<Database>;
export type Verdict = Database["public"]["Enums"]["dna_reaction"];

export type SavedCard = { id: string; verdict: Verdict; card: Card };

/** Everything the traveller has already judged in Drift, newest first. Invalid snapshots are reported. */
export async function loadSaves(supabase: Client, userId: string): Promise<SavedCard[]> {
  const { data, error } = await supabase
    .from("saves")
    .select("id, verdict, snapshot")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load saves (${error.code})`);
  const saves: SavedCard[] = [];
  let invalid = 0;
  for (const row of data) {
    const card = cardSchema.safeParse(row.snapshot);
    if (card.success) saves.push({ id: row.id, verdict: row.verdict, card: card.data });
    else invalid += 1;
  }
  if (invalid > 0) console.error("Saved cards failed validation", { invalid });
  return saves;
}

/** Cities the traveller has visited, to keep them out of "somewhere new" suggestions. */
export async function loadVisitedCities(
  supabase: Client,
  userId: string,
): Promise<{ id: number; name: string }[]> {
  const { data, error } = await supabase
    .from("visits")
    .select("city_id, city:cities(name)")
    .eq("user_id", userId)
    .not("city_id", "is", null);
  if (error) throw new Error(`Could not load visits (${error.code})`);
  return data.flatMap((row) =>
    row.city_id && row.city ? [{ id: row.city_id, name: row.city.name }] : [],
  );
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function loadCachedDeck(supabase: Client, userId: string, deckKey: string) {
  const { data, error } = await supabase
    .from("drift_decks")
    .select("cards, source, built_on")
    .eq("user_id", userId)
    .eq("deck_key", deckKey)
    .maybeSingle();
  if (error) throw new Error(`Could not load deck (${error.code})`);
  if (!data || data.built_on !== today()) return null;
  return { cards: data.cards, source: data.source as "compass" | "fallback" };
}

export async function storeDeck(
  supabase: Client,
  userId: string,
  deckKey: string,
  source: "compass" | "fallback",
  cards: Card[],
) {
  const { error } = await supabase
    .from("drift_decks")
    .upsert(
      { user_id: userId, deck_key: deckKey, built_on: today(), source, cards },
      { onConflict: "user_id,deck_key" },
    );
  if (error) throw new Error(`Could not store deck (${error.code})`);
}
