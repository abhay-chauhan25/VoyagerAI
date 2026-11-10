import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { activityCardSchema, type ActivityCard } from "@/lib/drift/cards";
import type { Database } from "@/lib/supabase/database.types";
import { loadCitySaves, type TripRole } from "@/lib/trips/queries";
import { toMember, type Member, type Swipe } from "./group";

type Client = SupabaseClient<Database>;

export type TripMember = Member & { role: TripRole };

/** Everyone on the trip, with what members share: name, role, pace and top three interests. */
export async function loadMembers(supabase: Client, tripId: string): Promise<TripMember[]> {
  const { data, error } = await supabase.rpc("trip_member_profiles", { p_trip: tripId });
  if (error) throw new Error(`Could not load members (${error.code})`);
  return data.map((row) => ({ ...toMember(row), role: row.role }));
}

export type InviteLink = { id: string; role: TripRole; expiresAt: string; usable: boolean };

/** The owner's invite links (the secrets themselves are never stored, so they can't be shown again). */
export async function loadInviteLinks(supabase: Client, tripId: string): Promise<InviteLink[]> {
  const { data, error } = await supabase
    .from("trip_invites")
    .select("id, role, expires_at, revoked_at")
    .eq("trip_id", tripId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load invite links (${error.code})`);
  const now = Date.now();
  return data.map((row) => ({
    id: row.id,
    role: row.role,
    expiresAt: row.expires_at,
    usable: new Date(row.expires_at).getTime() > now,
  }));
}

export type PendingPersonInvite = { id: string; name: string; role: TripRole };

/** People the owner invited by handle who haven't answered yet. */
export async function loadPersonInvites(
  supabase: Client,
  tripId: string,
): Promise<PendingPersonInvite[]> {
  const { data, error } = await supabase
    .from("trip_person_invites")
    .select("id, role, status, invitee:profiles!trip_person_invites_invitee_fkey(display_name)")
    .eq("trip_id", tripId)
    .eq("status", "pending");
  if (error) throw new Error(`Could not load invitations (${error.code})`);
  return data.map((row) => ({
    id: row.id,
    role: row.role,
    // The invitee's profile may be private; the owner still knows whom they invited by handle.
    name: row.invitee?.display_name ?? "Invited traveller",
  }));
}

export type Invitation = Database["public"]["Functions"]["my_trip_invitations"]["Returns"][number];

export async function loadMyInvitations(supabase: Client): Promise<Invitation[]> {
  const { data, error } = await supabase.rpc("my_trip_invitations");
  if (error) throw new Error(`Could not load invitations (${error.code})`);
  return data;
}

export type VoteTally = { up: string[]; down: string[]; mine: -1 | 0 | 1 };

/** Votes per subject ("proposal:<id>" or "place:<key>"), with voters' names. */
export async function loadVotes(
  supabase: Client,
  tripId: string,
  userId: string,
  members: readonly TripMember[],
): Promise<Record<string, VoteTally>> {
  const { data, error } = await supabase
    .from("trip_votes")
    .select("user_id, subject, value")
    .eq("trip_id", tripId);
  if (error) throw new Error(`Could not load votes (${error.code})`);
  const names = new Map(members.map((m) => [m.id, m.name]));
  const tallies: Record<string, VoteTally> = {};
  for (const vote of data) {
    const tally = (tallies[vote.subject] ??= { up: [], down: [], mine: 0 });
    const name = names.get(vote.user_id) ?? "A former member";
    if (vote.value > 0) tally.up.push(name);
    else tally.down.push(name);
    if (vote.user_id === userId) tally.mine = vote.value > 0 ? 1 : -1;
  }
  return tallies;
}

export type GroupSwipe = Swipe & { card: ActivityCard };

export async function loadGroupSwipes(supabase: Client, tripId: string): Promise<GroupSwipe[]> {
  const { data, error } = await supabase
    .from("group_swipes")
    .select("user_id, source_key, verdict, card")
    .eq("trip_id", tripId);
  if (error) throw new Error(`Could not load swipes (${error.code})`);
  let invalid = 0;
  const swipes = data.flatMap((row) => {
    const card = activityCardSchema.safeParse(row.card);
    if (!card.success) {
      invalid += 1;
      return [];
    }
    return [
      { userId: row.user_id, sourceKey: row.source_key, verdict: row.verdict, card: card.data },
    ];
  });
  if (invalid > 0) console.error("Group swipes failed validation", { invalid });
  return swipes;
}

/**
 * Places that can be added to a shared trip: the caller's own saves in the city, plus every place
 * a member loved in Group Drift. One entry per place.
 */
export async function loadPool(
  supabase: Client,
  userId: string,
  trip: { id: string; cityId: number },
): Promise<ActivityCard[]> {
  const [saves, swipes] = await Promise.all([
    loadCitySaves(supabase, userId, trip.cityId),
    loadGroupSwipes(supabase, trip.id),
  ]);
  const pool = new Map(saves.map((card) => [card.sourceKey, card]));
  for (const swipe of swipes) {
    if (swipe.verdict !== "pass" && !pool.has(swipe.sourceKey))
      pool.set(swipe.sourceKey, swipe.card);
  }
  return [...pool.values()];
}
