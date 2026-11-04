import { z } from "zod";
import { activityCardSchema } from "@/lib/drift/cards";
import { BUDGETS, PACES } from "@/lib/dna/schemas";

export const MAX_DAYS = 14;
export const MAX_STOPS_PER_DAY = 12;
export const TRAVEL_MODES = ["walking", "driving"] as const;
export type TravelMode = (typeof TRAVEL_MODES)[number];

/** A stop's place is the saved Drift activity card, kept as it was when saved. */
export const stopPlaceSchema = activityCardSchema;
export type StopPlace = z.infer<typeof stopPlaceSchema>;

const coordinate = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

/**
 * Travel between a day's stops in their current order. `signature` records the order and mode it
 * was computed for, so a reordered day is recomputed rather than shown with stale times.
 */
export const routeSchema = z.object({
  signature: z.string().max(4000),
  mode: z.enum(TRAVEL_MODES),
  source: z.enum(["mapbox", "estimate"]),
  legs: z
    .array(
      z.object({ seconds: z.number().int().min(0).max(86_400), meters: z.number().int().min(0) }),
    )
    .max(MAX_STOPS_PER_DAY),
  line: z.array(coordinate).max(6000).nullable(),
});
export type Route = z.infer<typeof routeSchema>;

const isoDate = z.iso.date({ error: "Choose a start date." });

/** The Compose form. The city comes from the traveller's saves; dates are local calendar days. */
export const composeSchema = z.object({
  cityId: z.coerce.number().int().positive({ error: "Choose a city." }),
  startDate: isoDate,
  days: z.coerce
    .number({ error: "Choose how many days." })
    .int()
    .min(1, "At least one day.")
    .max(MAX_DAYS, `At most ${MAX_DAYS} days.`),
  pace: z.enum(PACES, { error: "Choose a pace." }),
  title: z.string().trim().max(80, "Keep the name under 80 characters.").optional(),
});
export type ComposeInput = z.infer<typeof composeSchema>;

export const tripSettingsSchema = z.object({
  pace: z.enum(PACES),
  budget: z.enum(BUDGETS),
});

/** A change Compass (or the rule-based fallback) proposes. Applied only when the traveller accepts. */
export const changeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("move"),
    stopId: z.uuid(),
    toDay: z
      .number()
      .int()
      .min(0)
      .max(MAX_DAYS - 1),
    reason: z.string().min(1).max(200),
  }),
  z.object({
    type: z.literal("remove"),
    stopId: z.uuid(),
    reason: z.string().min(1).max(200),
  }),
  z.object({
    type: z.literal("add"),
    sourceKey: z.string().max(80),
    toDay: z
      .number()
      .int()
      .min(0)
      .max(MAX_DAYS - 1),
    reason: z.string().min(1).max(200),
  }),
]);
export const changesSchema = z.array(changeSchema).max(10);
export type Change = z.infer<typeof changeSchema>;

export const changeRequestSchema = z.object({
  tripId: z.uuid(),
  request: z
    .string()
    .trim()
    .min(3, "Say what you'd like to change.")
    .max(300, "Keep it under 300 characters."),
});

/** One stop's new place in a rearranged trip. */
export const layoutSchema = z
  .array(
    z.object({
      id: z.uuid(),
      day: z
        .number()
        .int()
        .min(0)
        .max(MAX_DAYS - 1),
      position: z
        .number()
        .int()
        .min(0)
        .max(MAX_STOPS_PER_DAY - 1),
    }),
  )
  .max(MAX_STOPS_PER_DAY * MAX_DAYS);
export type Layout = z.infer<typeof layoutSchema>;
