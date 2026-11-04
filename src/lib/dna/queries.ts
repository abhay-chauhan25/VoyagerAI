import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { REACTIONS, type Reaction } from "./score";
import { parseStoredWeights } from "./schemas";

type Client = SupabaseClient<Database>;

export type TravelDna = {
  pace: Database["public"]["Enums"]["travel_pace"];
  budget: Database["public"]["Enums"]["budget_band"];
  companions: string[];
  weights: ReturnType<typeof parseStoredWeights>;
  updatedAt: string;
};

/** A traveller's Travel DNA, or null if they haven't set it up. RLS decides who may read it. */
export async function loadTravelDna(supabase: Client, userId: string): Promise<TravelDna | null> {
  const { data, error } = await supabase
    .from("travel_dna")
    .select("pace, budget, companions, interest_weights, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Could not load Travel DNA (${error.code})`);
  if (!data) return null;
  return {
    pace: data.pace,
    budget: data.budget,
    companions: data.companions,
    weights: parseStoredWeights(data.interest_weights),
    updatedAt: data.updated_at,
  };
}

/** The owner's deck answers, used to explain where each trait came from. */
export async function loadReactions(
  supabase: Client,
  userId: string,
): Promise<Record<string, Reaction>> {
  const { data, error } = await supabase
    .from("dna_reactions")
    .select("scene_id, reaction")
    .eq("user_id", userId);
  if (error) throw new Error(`Could not load deck answers (${error.code})`);
  const reactions: Record<string, Reaction> = {};
  for (const row of data) {
    if ((REACTIONS as readonly string[]).includes(row.reaction))
      reactions[row.scene_id] = row.reaction;
  }
  return reactions;
}
