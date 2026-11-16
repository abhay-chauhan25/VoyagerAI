"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/auth/form-state";
import { readFields, toFieldErrors } from "@/lib/auth/schemas";
import { createClient } from "@/lib/supabase/server";
import { aboutSchema } from "./about";

const FIELDS = [
  "bio",
  "website",
  "contactEmail",
  "phone",
  "emailAudience",
  "phoneAudience",
] as const;

/** Saves the bio, link and contact details, with who may see each contact detail. */
export async function updateAbout(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = readFields(formData, FIELDS);
  const values = Object.fromEntries(FIELDS.map((field) => [field, raw[field] ?? ""]));
  const parsed = aboutSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/sign-in?next=/account");

  const profile = await supabase
    .from("profiles")
    .update({ bio: parsed.data.bio, website: parsed.data.website })
    .eq("id", userId);
  const contact = await supabase.from("profile_contacts").upsert(
    {
      contact_email: parsed.data.contactEmail,
      phone: parsed.data.phone,
      email_audience: parsed.data.emailAudience,
      phone_audience: parsed.data.phoneAudience,
    },
    { onConflict: "user_id" },
  );
  if (profile.error || contact.error) {
    console.error("Saving profile details failed", {
      profile: profile.error?.code,
      contact: contact.error?.code,
    });
    return { status: "error", message: "We couldn't save that. Try again.", values };
  }
  revalidatePath("/", "layout");
  return { status: "success", message: "Saved", values };
}
