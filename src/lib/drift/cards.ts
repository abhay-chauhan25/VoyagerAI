import { z } from "zod";
import { INTERESTS } from "@/lib/interests";
import { ACTIVITY_SOURCE_KEY, DATA_SOURCES, blurbSchema, photoSchema } from "@/lib/places/types";

const interests = z.array(z.enum(INTERESTS)).max(4);

export const destinationCardSchema = z.object({
  kind: z.literal("destination"),
  sourceKey: z.string().regex(/^geonames:\d+$/),
  cityId: z.number().int().positive(),
  name: z.string().min(1).max(200),
  region: z.string().max(200).nullable(),
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  why: z.string().min(1).max(220),
  interests,
  blurb: blurbSchema.nullable(),
  photo: photoSchema.nullable(),
});

export const activityCardSchema = z.object({
  kind: z.literal("activity"),
  sourceKey: z.string().regex(ACTIVITY_SOURCE_KEY),
  dataSource: z.enum(DATA_SOURCES),
  sourceUrl: z.url(),
  cityId: z.number().int().positive(),
  cityName: z.string().min(1).max(200),
  name: z.string().min(1).max(120),
  category: z.string().max(60),
  interests,
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  openingHours: z.string().max(200).nullable(),
  website: z.url().nullable(),
  why: z.string().min(1).max(220),
  photo: photoSchema.nullable(),
});

export const cardSchema = z.discriminatedUnion("kind", [destinationCardSchema, activityCardSchema]);

export type DestinationCard = z.infer<typeof destinationCardSchema>;
export type ActivityCard = z.infer<typeof activityCardSchema>;
export type Card = z.infer<typeof cardSchema>;

/** Deck rows come from the database as JSON; invalid cards are reported and left out. */
export function parseStoredCards(value: unknown): Card[] {
  if (!Array.isArray(value)) return [];
  const cards: Card[] = [];
  let invalid = 0;
  for (const item of value) {
    const parsed = cardSchema.safeParse(item);
    if (parsed.success) cards.push(parsed.data);
    else invalid += 1;
  }
  if (invalid > 0) console.error("Stored deck contained invalid cards", { invalid });
  return cards;
}
