"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { consumeAiQuota } from "@/lib/ai/quota";
import type { FormState } from "@/lib/auth/form-state";
import { readFields, toFieldErrors } from "@/lib/auth/schemas";
import { describeProfile } from "@/lib/drift/prompts";
import { loadTravelDna, type TravelDna } from "@/lib/dna/queries";
import { createClient } from "@/lib/supabase/server";
import { applyChanges } from "./plan";
import { resolveProposal } from "./prompts";
import { tripProviders } from "./providers";
import { loadCitySaves, loadTrip, toPlan, type StoredTrip } from "./queries";
import { ruleProposal } from "./rules";
import {
  changeRequestSchema,
  composeSchema,
  layoutSchema,
  MAX_STOPS_PER_DAY,
  TRAVEL_MODES,
  type Layout,
} from "./schemas";
import { arrangeStops, composeTrip, syncRoutes, type Placed } from "./service";
import { PRICE_LEVELS, stopProfile } from "./stops";

export type TripActionResult = { ok: true; message?: string } | { ok: false; message: string };

const FAILED: TripActionResult = { ok: false, message: "That didn't save. Try again." };
const NOT_FOUND: TripActionResult = { ok: false, message: "That trip no longer exists." };

async function requireSignedIn(next: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  return { supabase, userId };
}

type Session = Awaited<ReturnType<typeof requireSignedIn>>;

async function withTrip(tripId: unknown) {
  const id = z.uuid().safeParse(tripId);
  if (!id.success) return null;
  const session = await requireSignedIn(`/trips/${id.data}`);
  const trip = await loadTrip(session.supabase, session.userId, id.data);
  return trip ? { ...session, trip } : null;
}

const weightsOf = (dna: TravelDna | null) => dna?.weights ?? {};

/** Writes a new arrangement in one transaction, then refreshes travel times for days that changed. */
async function writeArrangement(
  { supabase, userId }: Session,
  trip: StoredTrip,
  layout: Layout,
  remove: string[] = [],
  add: { id: string; day: number; position: number; place: Placed["place"] }[] = [],
): Promise<TripActionResult> {
  const { error } = await supabase.rpc("arrange_trip", {
    p_trip: trip.id,
    p_layout: layout.map((l) => ({ id: l.id, day_index: l.day, position: l.position })),
    p_remove: remove,
    p_add: add.map((a) => ({
      id: a.id,
      day_index: a.day,
      position: a.position,
      source_key: a.place.sourceKey,
      place: a.place,
      dwell_minutes: stopProfile(a.place.category).dwell,
      price_level: stopProfile(a.place.category).price,
    })),
  });
  if (error) {
    console.error("Arranging a trip failed", { code: error.code });
    return error.code === "22023"
      ? { ok: false, message: "The trip changed in another tab. Reload to see the latest." }
      : FAILED;
  }
  const fresh = await loadTrip(supabase, userId, trip.id);
  if (fresh) {
    try {
      await syncRoutes(supabase, fresh);
    } catch (routeError) {
      // The new order is saved; only its travel times are stale, and they are retried next change.
      console.error("Refreshing travel times failed", {
        message: routeError instanceof Error ? routeError.message : "unknown",
      });
    }
  }
  revalidatePath(`/trips/${trip.id}`);
  revalidatePath("/trips");
  return { ok: true };
}

/** Normalises a client layout: positions become 0..n per day, in the order given. */
function normalise(layout: Layout): Layout {
  const sorted = [...layout].sort((a, b) => a.day - b.day || a.position - b.position);
  const next = new Map<number, number>();
  return sorted.map((l) => {
    const position = next.get(l.day) ?? 0;
    next.set(l.day, position + 1);
    return { ...l, position };
  });
}

function fits(layout: Layout, dayCount: number): boolean {
  const counts = new Map<number, number>();
  for (const l of layout) counts.set(l.day, (counts.get(l.day) ?? 0) + 1);
  return (
    layout.every((l) => l.day < dayCount) &&
    [...counts.values()].every((n) => n <= MAX_STOPS_PER_DAY)
  );
}

/* ---------- Compose ---------- */

export async function composeTripAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = readFields(formData, ["cityId", "startDate", "days", "pace", "title"] as const);
  const values = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v ?? ""]));
  const parsed = composeSchema.safeParse({ ...raw, title: raw.title || undefined });
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };

  const { supabase, userId } = await requireSignedIn("/trips/new");
  const input = parsed.data;
  const [{ data: city, error: cityError }, saves, dna] = await Promise.all([
    supabase
      .from("cities")
      .select("name, country_code")
      .eq("geoname_id", input.cityId)
      .maybeSingle(),
    loadCitySaves(supabase, userId, input.cityId),
    loadTravelDna(supabase, userId),
  ]);
  if (cityError) {
    console.error("Loading a city failed", { code: cityError.code });
    return { status: "error", message: "We couldn't compose that trip. Try again.", values };
  }
  if (!city) return { status: "error", fieldErrors: { cityId: "Choose a city." }, values };
  if (saves.length === 0) {
    return {
      status: "error",
      fieldErrors: { cityId: `Save some places in ${city.name} in Drift first.` },
      values,
    };
  }

  let tripId: string;
  try {
    tripId = await composeTrip(
      supabase,
      {
        cityId: input.cityId,
        cityName: city.name,
        countryCode: city.country_code,
        title: input.title || `${city.name}, ${input.days} ${input.days === 1 ? "day" : "days"}`,
        startDate: input.startDate,
        days: input.days,
        pace: input.pace,
        budget: dna?.budget ?? "comfortable",
      },
      saves,
      weightsOf(dna),
    );
  } catch (error) {
    console.error("Composing a trip failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return { status: "error", message: "We couldn't compose that trip. Try again.", values };
  }
  revalidatePath("/trips");
  redirect(`/trips/${tripId}`);
}

/* ---------- Canvas edits ---------- */

const arrangeInput = z.object({ tripId: z.uuid(), layout: layoutSchema });

/** Saves a drag-and-drop (or keyboard) rearrangement, keeping the traveller's order exactly. */
export async function arrangeTrip(input: unknown): Promise<TripActionResult> {
  const parsed = arrangeInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That move isn't possible." };
  const ctx = await withTrip(parsed.data.tripId);
  if (!ctx) return NOT_FOUND;
  const layout = normalise(parsed.data.layout);
  if (!fits(layout, ctx.trip.dayCount)) {
    return { ok: false, message: `A day holds at most ${MAX_STOPS_PER_DAY} stops.` };
  }
  return writeArrangement(ctx, ctx.trip, layout);
}

const dayInput = z.object({ tripId: z.uuid(), day: z.number().int().min(0).max(13) });

/** Re-orders one day for the shortest travel that respects opening hours. */
export async function optimiseDay(input: unknown): Promise<TripActionResult> {
  const parsed = dayInput.safeParse(input);
  if (!parsed.success) return FAILED;
  const ctx = await withTrip(parsed.data.tripId);
  if (!ctx) return NOT_FOUND;
  const dna = await loadTravelDna(ctx.supabase, ctx.userId);
  const layout = arrangeStops(
    ctx.trip.stops,
    [parsed.data.day],
    { ...ctx.trip, modes: ctx.trip.days.map((d) => d.mode) },
    weightsOf(dna),
  );
  return writeArrangement(ctx, ctx.trip, layout);
}

const modeInput = dayInput.extend({ mode: z.enum(TRAVEL_MODES) });

export async function setDayMode(input: unknown): Promise<TripActionResult> {
  const parsed = modeInput.safeParse(input);
  if (!parsed.success) return FAILED;
  const ctx = await withTrip(parsed.data.tripId);
  if (!ctx) return NOT_FOUND;
  const { error } = await ctx.supabase
    .from("trip_days")
    .update({ mode: parsed.data.mode })
    .eq("trip_id", ctx.trip.id)
    .eq("day_index", parsed.data.day);
  if (error) {
    console.error("Changing travel mode failed", { code: error.code });
    return FAILED;
  }
  const fresh = await loadTrip(ctx.supabase, ctx.userId, ctx.trip.id);
  if (fresh) await syncRoutes(ctx.supabase, fresh);
  revalidatePath(`/trips/${ctx.trip.id}`);
  return { ok: true };
}

const stopInput = z.object({
  tripId: z.uuid(),
  stopId: z.uuid(),
  priceLevel: z
    .number()
    .int()
    .refine((n) => (PRICE_LEVELS as readonly number[]).includes(n))
    .optional(),
  costAmount: z.number().min(0).max(99_999_999).multipleOf(0.01).nullable().optional(),
  dwell: z.number().int().min(15).max(480).optional(),
});

/** Changes a stop's price level, exact amount or visit length. */
export async function updateStop(input: unknown): Promise<TripActionResult> {
  const parsed = stopInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Enter an amount of 0 or more." };
  const ctx = await withTrip(parsed.data.tripId);
  if (!ctx) return NOT_FOUND;
  const { priceLevel, costAmount, dwell } = parsed.data;
  const { error } = await ctx.supabase
    .from("trip_stops")
    .update({
      ...(priceLevel !== undefined ? { price_level: priceLevel } : {}),
      ...(costAmount !== undefined ? { cost_amount: costAmount } : {}),
      ...(dwell !== undefined ? { dwell_minutes: dwell } : {}),
    })
    .eq("id", parsed.data.stopId)
    .eq("trip_id", ctx.trip.id);
  if (error) {
    console.error("Updating a stop failed", { code: error.code });
    return FAILED;
  }
  revalidatePath(`/trips/${ctx.trip.id}`);
  return { ok: true };
}

const removeInput = z.object({ tripId: z.uuid(), stopId: z.uuid() });

export async function removeStop(input: unknown): Promise<TripActionResult> {
  const parsed = removeInput.safeParse(input);
  if (!parsed.success) return FAILED;
  const ctx = await withTrip(parsed.data.tripId);
  if (!ctx) return NOT_FOUND;
  const layout = normalise(
    ctx.trip.stops
      .filter((s) => s.id !== parsed.data.stopId)
      .map((s) => ({ id: s.id, day: s.day, position: s.position })),
  );
  return writeArrangement(ctx, ctx.trip, layout, [parsed.data.stopId]);
}

const addInput = z.object({
  tripId: z.uuid(),
  sourceKey: z.string().max(80),
  day: z.number().int().min(0).max(13),
});

/** Adds one of the traveller's saves in this city to a day, at the end. */
export async function addStop(input: unknown): Promise<TripActionResult> {
  const parsed = addInput.safeParse(input);
  if (!parsed.success) return FAILED;
  const ctx = await withTrip(parsed.data.tripId);
  if (!ctx) return NOT_FOUND;
  const { trip } = ctx;
  if (parsed.data.day >= trip.dayCount) return FAILED;
  const saves = await loadCitySaves(ctx.supabase, ctx.userId, trip.cityId);
  const place = saves.find((s) => s.sourceKey === parsed.data.sourceKey);
  if (!place || trip.stops.some((s) => s.sourceKey === place.sourceKey)) {
    return { ok: false, message: "That place is already in the trip or no longer saved." };
  }
  const onDay = trip.stops.filter((s) => s.day === parsed.data.day).length;
  if (onDay >= MAX_STOPS_PER_DAY) {
    return { ok: false, message: `A day holds at most ${MAX_STOPS_PER_DAY} stops.` };
  }
  const id = randomUUID();
  const layout = [
    ...trip.stops.map((s) => ({ id: s.id, day: s.day, position: s.position })),
    { id, day: parsed.data.day, position: onDay },
  ];
  return writeArrangement(
    ctx,
    trip,
    layout,
    [],
    [{ id, day: parsed.data.day, position: onDay, place }],
  );
}

/* ---------- Proposals ---------- */

/**
 * Turns a request ("make day 2 slower") into a list of proposed changes, stored for the traveller
 * to accept or reject one by one. Compass when available; the rule-based parser otherwise. Nothing
 * in the trip changes here.
 */
export async function askForChanges(input: unknown): Promise<TripActionResult> {
  const parsed = changeRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Say what you'd like to change.",
    };
  }
  const ctx = await withTrip(parsed.data.tripId);
  if (!ctx) return NOT_FOUND;
  const { supabase, userId, trip } = ctx;
  const [dna, saves] = await Promise.all([
    loadTravelDna(supabase, userId),
    loadCitySaves(supabase, userId, trip.cityId),
  ]);
  const plan = toPlan(trip, saves, weightsOf(dna));

  let answer: { summary: string; changes: ReturnType<typeof resolveProposal> } | null = null;
  let source: "compass" | "rules" = "rules";
  if (dna && (await consumeAiQuota(supabase))) {
    const ai = await tripProviders().proposeChanges(
      describeProfile(dna),
      plan,
      parsed.data.request,
    );
    if (ai.ok) {
      answer = { summary: ai.data.summary, changes: resolveProposal(ai.data, plan) };
      source = "compass";
    }
  }
  answer ??= ruleProposal(parsed.data.request, plan);

  const { error } = await supabase.from("proposals").insert({
    trip_id: trip.id,
    user_id: userId,
    request: parsed.data.request,
    source,
    summary: answer.summary.slice(0, 300),
    changes: answer.changes,
  });
  if (error) {
    console.error("Storing a proposal failed", { code: error.code });
    return FAILED;
  }
  revalidatePath(`/trips/${trip.id}`);
  return { ok: true };
}

const decideInput = z.object({
  tripId: z.uuid(),
  proposalId: z.uuid(),
  accept: z.array(z.number().int().min(0).max(9)).max(10),
});

/** Applies the accepted changes of a proposal (none = dismiss it), then re-orders touched days. */
export async function decideProposal(input: unknown): Promise<TripActionResult> {
  const parsed = decideInput.safeParse(input);
  if (!parsed.success) return FAILED;
  const ctx = await withTrip(parsed.data.tripId);
  if (!ctx) return NOT_FOUND;
  const { supabase, userId, trip } = ctx;
  const proposal = trip.proposals.find((p) => p.id === parsed.data.proposalId);
  if (!proposal) return { ok: false, message: "That proposal was already decided." };

  const accepted = [...new Set(parsed.data.accept)]
    .sort((a, b) => a - b)
    .flatMap((i) => (proposal.changes[i] ? [proposal.changes[i]] : []));
  let result: TripActionResult = { ok: true, message: "Dismissed." };

  if (accepted.length > 0) {
    const [dna, saves] = await Promise.all([
      loadTravelDna(supabase, userId),
      loadCitySaves(supabase, userId, trip.cityId),
    ]);
    const weights = weightsOf(dna);
    const applied = applyChanges(toPlan(trip, saves, weights), accepted);
    const savesByKey = new Map(saves.map((s) => [s.sourceKey, s]));
    const added = applied.add.flatMap((a) => {
      const place = savesByKey.get(a.sourceKey);
      return place ? [{ id: randomUUID(), day: a.day, position: a.position, place }] : [];
    });
    const byId = new Map(trip.stops.map((s) => [s.id, s]));
    const entries: Placed[] = [
      ...applied.layout.flatMap((l) => {
        const stop = byId.get(l.id);
        return stop ? [{ ...l, place: stop.place, dwell: stop.dwell }] : [];
      }),
      ...added.map((a) => ({ ...a, dwell: stopProfile(a.place.category).dwell })),
    ];
    const layout = arrangeStops(
      entries,
      applied.touchedDays,
      { ...trip, modes: trip.days.map((d) => d.mode) },
      weights,
    );
    result = await writeArrangement(ctx, trip, layout, applied.remove, added);
    if (!result.ok) return result;
    const done = accepted.length - applied.skipped;
    result = {
      ok: true,
      message:
        applied.skipped > 0
          ? `Applied ${done} of ${accepted.length} changes; ${applied.skipped} no longer fit the trip.`
          : `Applied ${done} ${done === 1 ? "change" : "changes"}.`,
    };
  }

  const { error } = await supabase
    .from("proposals")
    .update({
      status: accepted.length > 0 ? "applied" : "dismissed",
      decided_at: new Date().toISOString(),
    })
    .eq("id", proposal.id);
  if (error) {
    console.error("Closing a proposal failed", { code: error.code });
    return FAILED;
  }
  revalidatePath(`/trips/${trip.id}`);
  return result;
}

/* ---------- The trip itself ---------- */

const renameInput = z.object({
  tripId: z.uuid(),
  title: z.string().trim().min(1, "Give the trip a name.").max(80, "Keep it under 80 characters."),
});

export async function renameTrip(input: unknown): Promise<TripActionResult> {
  const parsed = renameInput.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid name." };
  const ctx = await withTrip(parsed.data.tripId);
  if (!ctx) return NOT_FOUND;
  const { error } = await ctx.supabase
    .from("trips")
    .update({ title: parsed.data.title })
    .eq("id", ctx.trip.id);
  if (error) {
    console.error("Renaming a trip failed", { code: error.code });
    return FAILED;
  }
  revalidatePath(`/trips/${ctx.trip.id}`);
  revalidatePath("/trips");
  return { ok: true };
}

export async function deleteTrip(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get("tripId"));
  if (!id.success) throw new Error("Invalid trip id");
  const { supabase } = await requireSignedIn("/trips");
  const { error } = await supabase.from("trips").delete().eq("id", id.data);
  if (error) throw new Error(`Could not delete trip (${error.code})`);
  revalidatePath("/trips");
  redirect("/trips");
}
