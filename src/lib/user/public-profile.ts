import { cache } from "react";
import { HANDLE_PATTERN } from "@/lib/auth/schemas";
import { createClient } from "@/lib/supabase/server";

export type PublicProfile = {
  id: string;
  displayName: string;
  homeCity: string | null;
  handle: string;
  isPublic: boolean;
};

/**
 * A profile by handle, or null. Row-level security decides visibility: anyone can read a public
 * profile; a private one is returned only to its owner.
 */
export const findProfileByHandle = cache(
  async (rawHandle: string): Promise<PublicProfile | null> => {
    const handle = rawHandle.toLowerCase();
    if (!HANDLE_PATTERN.test(handle)) return null;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, home_city, handle, is_public")
      .eq("handle", handle)
      .maybeSingle();
    if (error) throw new Error(`Could not load profile (${error.code})`);
    if (!data?.handle) return null;
    return {
      id: data.id,
      displayName: data.display_name,
      homeCity: data.home_city,
      handle: data.handle,
      isPublic: data.is_public,
    };
  },
);
