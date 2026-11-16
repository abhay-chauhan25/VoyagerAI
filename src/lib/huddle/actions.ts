"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { consumeAiQuota } from "@/lib/ai/quota";
import { activityCardSchema } from "@/lib/drift/cards";
import { REACTIONS } from "@/lib/dna/score";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { visitState } from "@/lib/trips/hours";
import { tripProviders } from "@/lib/trips/providers";
import { loadTrip } from "@/lib/trips/queries";
import { stopProfile } from "@/lib/trips/stops";
import { consensusPlan, memberScore, nameList, planChanges, PICK_THRESHOLD } from "./group";
import { loadGroupSwipes, loadMembers, loadPool } from "./queries";
import { INVITE_TOKEN, newInviteToken } from "./tokens";

export type HuddleResult =
  { ok: true; message?: string; link?: string } | { ok: false; message: string };

const FAILED: HuddleResult = { ok: false, message: "That didn't work. Try again." };
const NOT_FOUND: HuddleResult = { ok: false, message: "That trip no longer exists." };
const OWNER_ONLY: HuddleResult = { ok: false, message: "Only the trip's owner can do that." };
const NOT_A_MEMBER: HuddleResult = { ok: false, message: "You're no longer on this trip." };

const INVITE_ROLES = ["editor", "viewer"] as const;

async function session(next: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  return { supabase, userId };
}

async function withTrip(tripId: string) {
  const s = await session(`/trips/${tripId}`);
  const trip = await loadTrip(s.supabase, s.userId, tripId);
  return trip ? { ...s, trip } : null;
}

function refresh(tripId: string) {
  revalidatePath(`/trips/${tripId}`, "layout");
  revalidatePath("/trips");
}

/* ---------- Invites ---------- */

const linkInput = z.object({ tripId: z.uuid(), role: z.enum(INVITE_ROLES) });

/**
 * Creates an invite link. The secret is returned once, to show and copy; only its hash is stored,
 * so a lost link can't be recovered, only revoked and replaced.
 */
export async function createInviteLink(input: unknown): Promise<HuddleResult> {
  const parsed = linkInput.safeParse(input);
  if (!parsed.success) return FAILED;
  const ctx = await withTrip(parsed.data.tripId);
  if (!ctx) return NOT_FOUND;
  if (ctx.trip.role !== "owner") return OWNER_ONLY;
  const { token, hash } = newInviteToken();
  const { error } = await ctx.supabase.from("trip_invites").insert({
    trip_id: ctx.trip.id,
    created_by: ctx.userId,
    role: parsed.data.role,
    token_hash: hash,
  });
  if (error) {
    console.error("Creating an invite link failed", { code: error.code });
    return FAILED;
  }
  refresh(ctx.trip.id);
  const link = new URL(`/trips/join/${token}`, publicEnv().NEXT_PUBLIC_SITE_URL).toString();
  return { ok: true, link, message: "Link ready. Copy it now: it won't be shown again." };
}

const revokeInput = z.object({ tripId: z.uuid(), inviteId: z.uuid() });

export async function revokeInviteLink(input: unknown): Promise<HuddleResult> {
  const parsed = revokeInput.safeParse(input);
  if (!parsed.success) return FAILED;
  const { supabase } = await session(`/trips/${parsed.data.tripId}`);
  const { data, error } = await supabase
    .from("trip_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", parsed.data.inviteId)
    .eq("trip_id", parsed.data.tripId)
    .select("id");
  if (error) {
    console.error("Revoking an invite link failed", { code: error.code });
    return FAILED;
  }
  if (data.length === 0) return OWNER_ONLY;
  refresh(parsed.data.tripId);
  return { ok: true, message: "Link revoked. Anyone who hasn't joined yet can't use it." };
}

const handleInput = z.object({
  tripId: z.uuid(),
  handle: z
    .string()
    .trim()
    .transform((h) => h.replace(/^@/, "").toLowerCase())
    .pipe(
      z.string().regex(/^[a-z0-9_]{3,30}$/, "Handles are 3–30 letters, numbers or underscores."),
    ),
  role: z.enum(INVITE_ROLES),
});

/**
 * Invites a traveller by handle. The answer is the same whether or not the handle exists, so this
 * can't be used to find out who has an account.
 */
export async function inviteByHandle(input: unknown): Promise<HuddleResult> {
  const parsed = handleInput.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the handle." };
  const ctx = await withTrip(parsed.data.tripId);
  if (!ctx) return NOT_FOUND;
  if (ctx.trip.role !== "owner") return OWNER_ONLY;
  const { error } = await ctx.supabase.rpc("invite_by_handle", {
    p_trip: ctx.trip.id,
    p_handle: parsed.data.handle,
    p_role: parsed.data.role,
  });
  if (error) {
    console.error("Inviting by handle failed", { code: error.code });
    return FAILED;
  }
  refresh(ctx.trip.id);
  return {
    ok: true,
    message: `If @${parsed.data.handle} is on Voyager, they'll find the invitation on their Trips page.`,
  };
}

const friendInput = z.object({
  tripId: z.uuid(),
  friendId: z.uuid(),
  role: z.enum(INVITE_ROLES),
});

/** Invites one of the owner's friends to the trip. The database checks they really are friends. */
export async function inviteFriend(input: unknown): Promise<HuddleResult> {
  const parsed = friendInput.safeParse(input);
  if (!parsed.success) return FAILED;
  const ctx = await withTrip(parsed.data.tripId);
  if (!ctx) return NOT_FOUND;
  if (ctx.trip.role !== "owner") return OWNER_ONLY;
  const { error } = await ctx.supabase.rpc("invite_friend", {
    p_trip: ctx.trip.id,
    p_friend: parsed.data.friendId,
    p_role: parsed.data.role,
  });
  if (error) {
    if (error.code === "42501")
      return { ok: false, message: "You can only invite people you're friends with this way." };
    console.error("Inviting a friend failed", { code: error.code });
    return FAILED;
  }
  refresh(ctx.trip.id);
  return { ok: true, message: "Invited. They'll find the invitation on their Trips page." };
}

const respondInput = z.object({ inviteId: z.uuid(), accept: z.boolean() });

export async function respondToInvitation(input: unknown): Promise<HuddleResult> {
  const parsed = respondInput.safeParse(input);
  if (!parsed.success) return FAILED;
  const { supabase } = await session("/trips");
  const { data, error } = await supabase.rpc("respond_to_trip_invitation", {
    p_invite: parsed.data.inviteId,
    p_accept: parsed.data.accept,
  });
  if (error) {
    if (error.code === "22023")
      return { ok: false, message: "That invitation was withdrawn or already answered." };
    console.error("Answering an invitation failed", { code: error.code });
    return FAILED;
  }
  revalidatePath("/trips");
  if (parsed.data.accept && data) redirect(`/trips/${data}`);
  return { ok: true, message: "Invitation declined." };
}

/** Joins a trip from an invite link (the page shows what joining shares first). */
export async function joinWithLink(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  if (!INVITE_TOKEN.test(token)) redirect("/trips");
  const { supabase } = await session(`/trips/join/${token}`);
  const { data, error } = await supabase.rpc("accept_trip_invite", { p_token: token });
  if (error || !data) {
    if (error?.code !== "22023") console.error("Joining with a link failed", { code: error?.code });
    redirect(`/trips/join/${token}?failed=1`);
  }
  revalidatePath("/trips");
  redirect(`/trips/${data}`);
}

/* ---------- Members ---------- */

const roleInput = z.object({ tripId: z.uuid(), userId: z.uuid(), role: z.enum(INVITE_ROLES) });

export async function setMemberRole(input: unknown): Promise<HuddleResult> {
  const parsed = roleInput.safeParse(input);
  if (!parsed.success) return FAILED;
  const { supabase } = await session(`/trips/${parsed.data.tripId}`);
  const { data, error } = await supabase
    .from("trip_members")
    .update({ role: parsed.data.role })
    .eq("trip_id", parsed.data.tripId)
    .eq("user_id", parsed.data.userId)
    .select("user_id");
  if (error) {
    console.error("Changing a role failed", { code: error.code });
    return FAILED;
  }
  if (data.length === 0) return OWNER_ONLY;
  refresh(parsed.data.tripId);
  return { ok: true };
}

const memberInput = z.object({ tripId: z.uuid(), userId: z.uuid() });

/** The owner removes a member, or a member leaves (their own id). The owner can't be removed. */
export async function removeMember(input: unknown): Promise<HuddleResult> {
  const parsed = memberInput.safeParse(input);
  if (!parsed.success) return FAILED;
  const { supabase, userId } = await session(`/trips/${parsed.data.tripId}`);
  const { data, error } = await supabase
    .from("trip_members")
    .delete()
    .eq("trip_id", parsed.data.tripId)
    .eq("user_id", parsed.data.userId)
    .select("user_id");
  if (error) {
    console.error("Removing a member failed", { code: error.code });
    return FAILED;
  }
  if (data.length === 0) return OWNER_ONLY;
  if (parsed.data.userId === userId) {
    revalidatePath("/trips");
    redirect("/trips");
  }
  refresh(parsed.data.tripId);
  return { ok: true };
}

/* ---------- Votes ---------- */

const voteInput = z.object({
  tripId: z.uuid(),
  subject: z
    .string()
    .regex(/^(proposal:[0-9a-f-]{36}|place:(osm:(node|way|relation)\/\d+|wikipedia:\d+))$/),
  value: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
});

/** Votes for or against a proposal or a place; 0 takes the vote back. Every member may vote. */
export async function castVote(input: unknown): Promise<HuddleResult> {
  const parsed = voteInput.safeParse(input);
  if (!parsed.success) return FAILED;
  const { supabase, userId } = await session(`/trips/${parsed.data.tripId}`);
  const { tripId, subject, value } = parsed.data;
  const { error } =
    value === 0
      ? await supabase
          .from("trip_votes")
          .delete()
          .eq("trip_id", tripId)
          .eq("user_id", userId)
          .eq("subject", subject)
      : await supabase
          .from("trip_votes")
          .upsert(
            { trip_id: tripId, user_id: userId, subject, value },
            { onConflict: "trip_id,user_id,subject" },
          );
  if (error) {
    console.error("Voting failed", { code: error.code });
    return error.code === "42501" ? NOT_A_MEMBER : FAILED;
  }
  refresh(tripId);
  return { ok: true };
}

/* ---------- Group Drift ---------- */

const swipeInput = z.object({
  tripId: z.uuid(),
  card: activityCardSchema,
  verdict: z.enum(REACTIONS),
});

export async function swipeGroupCard(input: unknown): Promise<HuddleResult> {
  const parsed = swipeInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That card couldn't be saved." };
  const { supabase, userId } = await session(`/trips/${parsed.data.tripId}/drift`);
  const { error } = await supabase.from("group_swipes").upsert(
    {
      trip_id: parsed.data.tripId,
      user_id: userId,
      source_key: parsed.data.card.sourceKey,
      verdict: parsed.data.verdict,
      card: parsed.data.card,
    },
    { onConflict: "trip_id,user_id,source_key" },
  );
  if (error) {
    console.error("Saving a group swipe failed", { code: error.code });
    return error.code === "42501" ? NOT_A_MEMBER : FAILED;
  }
  refresh(parsed.data.tripId);
  return { ok: true };
}

/* ---------- Consensus ---------- */

const consensusInput = z.object({ tripId: z.uuid() });

/**
 * Drafts a plan that balances every member's top interests and pace, from the trip's stops and the
 * places the group loved, and stores it as a proposal. Nothing changes until an editor accepts it.
 */
export async function proposeConsensus(input: unknown): Promise<HuddleResult> {
  const parsed = consensusInput.safeParse(input);
  if (!parsed.success) return FAILED;
  const ctx = await withTrip(parsed.data.tripId);
  if (!ctx) return NOT_FOUND;
  const { supabase, userId, trip } = ctx;
  if (trip.role === "viewer")
    return { ok: false, message: "Only editors can ask for a Consensus plan." };

  const [members, pool, swipes] = await Promise.all([
    loadMembers(supabase, trip.id),
    loadPool(supabase, userId, trip),
    loadGroupSwipes(supabase, trip.id),
  ]);
  if (members.length < 2) {
    return { ok: false, message: "Consensus needs at least two members. Invite someone first." };
  }

  const loves = new Map<string, number>();
  for (const s of swipes)
    if (s.verdict !== "pass") loves.set(s.sourceKey, (loves.get(s.sourceKey) ?? 0) + 1);
  const places = new Map(trip.stops.map((s) => [s.sourceKey, s.place]));
  for (const card of pool) if (!places.has(card.sourceKey)) places.set(card.sourceKey, card);
  const candidates = [...places.values()].map((place) => {
    const profile = stopProfile(place.category);
    return {
      key: place.sourceKey,
      name: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
      score: 0,
      dwell: trip.stops.find((s) => s.sourceKey === place.sourceKey)?.dwell ?? profile.dwell,
      evening: profile.evening,
      hours: place.openingHours,
      interests: place.interests,
      lovedBy: loves.get(place.sourceKey) ?? 0,
    };
  });

  const plan = consensusPlan(members, candidates, {
    days: trip.dayCount,
    startDate: trip.startDate,
    check: visitState,
  });
  const fansOf = (key: string) => {
    const place = places.get(key);
    return place
      ? members.filter((m) => memberScore(place.interests, m) >= PICK_THRESHOLD).map((m) => m.name)
      : [];
  };
  const changes = planChanges(
    trip.stops.map((s) => ({ id: s.id, sourceKey: s.sourceKey, day: s.day })),
    plan.days,
    (key, kind) => {
      const fans = fansOf(key);
      if (kind === "remove") return "The group's other picks fit the days better.";
      if (kind === "move")
        return "Groups it with nearby stops so each day has something for everyone.";
      return fans.length ? `A pick for ${nameList(fans)}.` : "Loved by the group in Group Drift.";
    },
  );

  let summary = plan.facts[0] ?? "A plan that balances everyone.";
  let source: "compass" | "rules" = "rules";
  if (await consumeAiQuota(supabase)) {
    const ai = await tripProviders().consensusSummary(plan.facts);
    if (ai.ok) {
      summary = ai.data.summary;
      source = "compass";
    }
  }
  if (changes.length === 0) summary = "Your plan already balances everyone. Nothing to change.";

  const { error } = await supabase.from("proposals").insert({
    trip_id: trip.id,
    user_id: userId,
    request: "Consensus plan for the group",
    source,
    summary: summary.slice(0, 300),
    changes,
    details: plan.notes,
  });
  if (error) {
    console.error("Storing a Consensus proposal failed", { code: error.code });
    return FAILED;
  }
  refresh(trip.id);
  return { ok: true };
}
