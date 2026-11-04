import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
  displayName: string;
  homeCity: string | null;
  handle: string | null;
  isPublic: boolean;
  tripIdea: string | null;
};

/**
 * The signed-in traveller with their profile, or a redirect to sign-in. Deduplicated per request.
 * The proxy already guards app routes; this is the second, authoritative check (getUser() asks the
 * auth server, so a revoked session is caught even if its cookie is still present).
 */
export const requireUser = cache(async (nextPath: string): Promise<CurrentUser> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);

  const user = data.user;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name, home_city, handle, is_public")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    // A signed-in user without a profile means the sign-up trigger failed: surface it, don't paper over it.
    throw new Error(`Profile missing for signed-in user (${profileError?.code ?? "no row"})`);
  }

  const tripIdea = user.user_metadata?.trip_idea;
  return {
    id: user.id,
    email: user.email ?? "",
    displayName: profile.display_name,
    homeCity: profile.home_city,
    handle: profile.handle,
    isPublic: profile.is_public,
    tripIdea: typeof tripIdea === "string" && tripIdea.trim() ? tripIdea.trim() : null,
  };
});
