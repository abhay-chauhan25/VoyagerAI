"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/auth/form-state";
import { toFieldErrors } from "@/lib/auth/schemas";
import { INTERESTS } from "@/lib/interests";
import { scoreReactions } from "./score";
import { dnaEditSchema, onboardingSchema } from "./schemas";

async function requireUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/sign-in?next=/welcome");
  return { supabase, userId };
}

export type OnboardingResult = { ok: false; message: string } | { ok: true };

/**
 * Saves the onboarding deck: every reaction (so traits can be explained later), then the Travel DNA
 * scored from them. Re-running onboarding replaces both.
 */
export async function saveOnboarding(input: unknown): Promise<OnboardingResult> {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Some answers were missing. Go back and answer every scene." };
  }
  const { supabase, userId } = await requireUserId();
  const { reactions, pace, budget, companions } = parsed.data;

  const answered = Object.entries(reactions).filter(
    (entry): entry is [string, NonNullable<(typeof entry)[1]>] => entry[1] !== undefined,
  );
  const rows = answered.map(([scene_id, reaction]) => ({ user_id: userId, scene_id, reaction }));
  const { error: reactionError } = await supabase
    .from("dna_reactions")
    .upsert(rows, { onConflict: "user_id,scene_id" });
  if (reactionError) {
    console.error("Saving deck answers failed", { code: reactionError.code });
    return { ok: false, message: "We couldn't save your answers. Try again." };
  }

  const { error } = await supabase.from("travel_dna").upsert(
    {
      user_id: userId,
      pace,
      budget,
      companions,
      interest_weights: scoreReactions(Object.fromEntries(answered)),
    },
    { onConflict: "user_id" },
  );
  if (error) {
    console.error("Saving Travel DNA failed", { code: error.code });
    return { ok: false, message: "We couldn't save your Travel DNA. Try again." };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Reads the edit form: one numeric field per interest ("weight.Food"), plus the three questions. */
function readEditForm(formData: FormData) {
  const weights: Record<string, number> = {};
  for (const interest of INTERESTS) {
    const raw = formData.get(`weight.${interest}`);
    if (typeof raw === "string" && raw !== "") weights[interest] = Number(raw);
  }
  return {
    weights,
    pace: formData.get("pace"),
    budget: formData.get("budget"),
    // The schema rejects anything that isn't a known companion option.
    companions: formData.getAll("companions"),
  };
}

export async function updateTravelDna(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = dnaEditSchema.safeParse(readEditForm(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Some values weren't valid.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }
  const { supabase, userId } = await requireUserId();
  const { weights, pace, budget, companions } = parsed.data;

  const { error } = await supabase
    .from("travel_dna")
    .update({ pace, budget, companions, interest_weights: weights })
    .eq("user_id", userId);
  if (error) {
    console.error("Updating Travel DNA failed", { code: error.code });
    return { status: "error", message: "We couldn't save your changes. Try again." };
  }
  revalidatePath("/", "layout");
  return { status: "success", message: "Saved" };
}
