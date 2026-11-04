"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/auth/form-state";
import { toFieldErrors } from "@/lib/auth/schemas";
import { createClient } from "@/lib/supabase/server";
import { countryName } from "./countries";
import { addVisitSchema, removeVisitSchema } from "./schemas";

const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";

async function requireSignedIn() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/sign-in?next=/atlas");
  return supabase;
}

export async function addVisit(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = addVisitSchema.safeParse({
    cityId: formData.get("cityId") || undefined,
    countryCode: formData.get("countryCode") || undefined,
    year: formData.get("year") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: toFieldErrors(parsed.error) };
  }

  const supabase = await requireSignedIn();
  const { cityId, countryCode, year } = parsed.data;
  // The database trigger replaces country_code with the city's country, so a placeholder is fine.
  const { data: added, error } = await supabase
    .from("visits")
    .insert({ city_id: cityId ?? null, country_code: countryCode ?? "XX", visited_year: year })
    .select("country_code, city:cities(name)")
    .single();

  if (error?.code === UNIQUE_VIOLATION) {
    return { status: "error", message: "That place is already on your map." };
  }
  if (error?.code === FOREIGN_KEY_VIOLATION) {
    return { status: "error", message: "We couldn't find that city. Search again." };
  }
  if (error) {
    console.error("Adding a visit failed", { code: error.code });
    return { status: "error", message: "We couldn't add that place. Try again." };
  }
  revalidatePath("/atlas");
  // Name the place, so each add is confirmed on its own (not by the previous add's message).
  const country = countryName(added.country_code);
  const place = added.city ? `${added.city.name}, ${country}` : country;
  return { status: "success", message: `Added ${place} to your map` };
}

export async function removeVisit(formData: FormData): Promise<void> {
  const parsed = removeVisitSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) throw new Error("Invalid visit id");
  const supabase = await requireSignedIn();
  const { error } = await supabase.from("visits").delete().eq("id", parsed.data.id);
  if (error) throw new Error(`Could not remove visit (${error.code})`);
  revalidatePath("/atlas");
}
