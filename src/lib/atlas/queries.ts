import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export type Visit = {
  id: string;
  country_code: string;
  city_id: number | null;
  visited_year: number | null;
  city: { name: string; region: string | null; latitude: number; longitude: number } | null;
};

/** A traveller's visits with their city details, newest first. RLS decides who may read them. */
export async function loadVisits(supabase: Client, userId: string): Promise<Visit[]> {
  const { data, error } = await supabase
    .from("visits")
    .select(
      "id, country_code, city_id, visited_year, city:cities(name, region, latitude, longitude)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load visits (${error.code})`);
  return data;
}
