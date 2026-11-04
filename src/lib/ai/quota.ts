import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { serverEnv } from "@/lib/server-env";

type Client = SupabaseClient<Database>;

/** Records one AI call for the signed-in traveller; false when today's limit is used up. */
export async function consumeAiQuota(supabase: Client): Promise<boolean> {
  const { data, error } = await supabase.rpc("consume_ai_quota", {
    daily_limit: serverEnv().AI_DAILY_LIMIT,
  });
  if (error) {
    console.error("AI quota check failed", { code: error.code });
    return false; // fail closed: no quota answer means no AI call
  }
  return data === true;
}

/** Calls left today, for the status line. */
export async function aiCallsLeft(supabase: Client, userId: string): Promise<number> {
  const limit = serverEnv().AI_DAILY_LIMIT;
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("ai_usage")
    .select("calls")
    .eq("user_id", userId)
    .eq("day", today)
    .maybeSingle();
  if (error) throw new Error(`Could not read AI usage (${error.code})`);
  return Math.max(0, limit - (data?.calls ?? 0));
}
