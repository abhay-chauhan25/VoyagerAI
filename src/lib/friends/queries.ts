import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export type Person = {
  id: string;
  name: string;
  /** Null when they have no public address. */
  handle: string | null;
  isPublic: boolean;
  iFollow: boolean;
  followsMe: boolean;
};

export type Circle = {
  /** People who follow each other. */
  friends: Person[];
  /** People the traveller follows who don't follow back. */
  following: Person[];
  /** People who follow the traveller and aren't followed back yet. */
  followers: Person[];
  counts: { friends: number; following: number; followers: number };
};

/** Sorts connections into friends, following and followers, and counts each the usual way. */
export function sortCircle(people: readonly Person[]): Circle {
  const friends = people.filter((person) => person.iFollow && person.followsMe);
  const following = people.filter((person) => person.iFollow && !person.followsMe);
  const followers = people.filter((person) => person.followsMe && !person.iFollow);
  return {
    friends,
    following,
    followers,
    counts: {
      friends: friends.length,
      // The totals count everyone followed and everyone following, friends included.
      following: people.filter((person) => person.iFollow).length,
      followers: people.filter((person) => person.followsMe).length,
    },
  };
}

/** Everyone connected to the traveller by a follow in either direction. */
export async function loadCircle(supabase: Client): Promise<Circle> {
  const { data, error } = await supabase.rpc("my_connections");
  if (error) throw new Error(`Could not load your connections (${error.code})`);
  return sortCircle(
    data.map((row) => ({
      id: row.user_id,
      name: row.display_name,
      handle: row.handle,
      isPublic: row.is_public,
      iFollow: row.i_follow,
      followsMe: row.follows_me,
    })),
  );
}

const SUGGESTION_LIMIT = 24;

/**
 * Public profiles the traveller isn't connected to yet, optionally narrowed by a name or handle.
 * Only public profiles are readable at all, so private accounts can never appear here.
 */
export async function loadPeopleToFollow(
  supabase: Client,
  userId: string,
  connected: readonly string[],
  search: string,
): Promise<Person[]> {
  let query = supabase
    .from("profiles")
    .select("id, display_name, handle")
    .eq("is_public", true)
    .neq("id", userId)
    .order("display_name")
    .limit(SUGGESTION_LIMIT + connected.length);
  // Letters, digits, spaces and underscores only: nothing that could alter the filter.
  const term = search
    .replace(/[^\p{L}\p{N} _]/gu, "")
    .trim()
    .slice(0, 40);
  if (term) query = query.or(`display_name.ilike.%${term}%,handle.ilike.%${term}%`);
  const { data, error } = await query;
  if (error) throw new Error(`Could not load travellers (${error.code})`);
  const known = new Set(connected);
  return data
    .filter((row) => !known.has(row.id))
    .slice(0, SUGGESTION_LIMIT)
    .map((row) => ({
      id: row.id,
      name: row.display_name,
      handle: row.handle,
      isPublic: true,
      iFollow: false,
      followsMe: false,
    }));
}
