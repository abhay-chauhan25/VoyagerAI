"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { REACTIONS } from "@/lib/dna/score";
import { loadTravelDna } from "@/lib/dna/queries";
import { createClient } from "@/lib/supabase/server";
import { cardSchema, type DestinationCard } from "./cards";
import { askCompass, searchQuerySchema } from "./search";

async function requireSignedIn() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/sign-in?next=/drift");
  return { supabase, userId };
}

const judgeSchema = z.object({ card: cardSchema, verdict: z.enum(REACTIONS) });

export type JudgeResult = { ok: true } | { ok: false; message: string };

/** Records a swipe. The whole card is kept as a snapshot so saved places survive without a shared cache. */
export async function judgeCard(input: unknown): Promise<JudgeResult> {
  const parsed = judgeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That card couldn't be saved." };
  const { supabase, userId } = await requireSignedIn();
  const { card, verdict } = parsed.data;

  const { error } = await supabase.from("saves").upsert(
    {
      user_id: userId,
      kind: card.kind,
      source_key: card.sourceKey,
      city_id: card.cityId,
      verdict,
      snapshot: card,
    },
    { onConflict: "user_id,source_key" },
  );
  if (error) {
    console.error("Saving a card failed", { code: error.code });
    return { ok: false, message: "We couldn't save that. Try again." };
  }
  revalidatePath("/drift", "layout");
  return { ok: true };
}

export async function removeSave(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) throw new Error("Invalid save id");
  const { supabase } = await requireSignedIn();
  const { error } = await supabase.from("saves").delete().eq("id", id.data);
  if (error) throw new Error(`Could not remove save (${error.code})`);
  revalidatePath("/drift", "layout");
}

const deckKeySchema = z.string().regex(/^(destinations|activities:\d+)$/);

/** Throws away today's cached deck so the page builds a fresh one (which may use AI quota). */
export async function dealNewDeck(formData: FormData): Promise<void> {
  const deckKey = deckKeySchema.safeParse(formData.get("deckKey"));
  if (!deckKey.success) throw new Error("Invalid deck");
  const { supabase, userId } = await requireSignedIn();
  const { error } = await supabase
    .from("drift_decks")
    .delete()
    .eq("user_id", userId)
    .eq("deck_key", deckKey.data);
  if (error) throw new Error(`Could not reset deck (${error.code})`);
  revalidatePath("/drift", "layout");
}

export type AskState =
  | { status: "idle"; query: string }
  | { status: "error"; query: string; message: string }
  | {
      status: "done";
      query: string;
      source: "compass" | "fallback";
      summary: string;
      cards: DestinationCard[];
      notice: string | null;
    };

export async function askCompassAction(_prev: AskState, formData: FormData): Promise<AskState> {
  const raw = formData.get("query");
  const query = typeof raw === "string" ? raw : "";
  const parsed = searchQuerySchema.safeParse(query);
  if (!parsed.success)
    return { status: "error", query, message: parsed.error.issues[0]?.message ?? "Try again." };

  const { supabase, userId } = await requireSignedIn();
  const dna = await loadTravelDna(supabase, userId);
  if (!dna)
    return {
      status: "error",
      query,
      message: "Set up your Travel DNA first, so Compass knows what you like.",
    };

  const outcome = await askCompass(supabase, dna, parsed.data);
  revalidatePath("/drift", "layout"); // the AI-calls-left count changed
  return { status: "done", query, ...outcome };
}
