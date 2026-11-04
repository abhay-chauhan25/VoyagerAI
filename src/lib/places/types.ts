import { z } from "zod";
import { INTERESTS } from "@/lib/interests";

/** A freely licensed photo and the credit its licence requires. */
export const photoSchema = z.object({
  url: z.url(),
  author: z.string().max(200),
  license: z.string().max(60),
  licenseUrl: z.url().nullable(),
  page: z.url(),
});

/** Text quoted from Wikivoyage or Wikipedia, with its source for attribution (CC BY-SA). */
export const blurbSchema = z.object({
  text: z.string().max(600),
  source: z.enum(["Wikivoyage", "Wikipedia"]),
  page: z.url(),
});

export const ACTIVITY_SOURCE_KEY = /^(osm:(node|way|relation)\/\d+|wikipedia:\d+)$/;
export const DATA_SOURCES = ["OpenStreetMap", "Wikipedia"] as const;

export const activitySchema = z.object({
  sourceKey: z.string().regex(ACTIVITY_SOURCE_KEY),
  dataSource: z.enum(DATA_SOURCES),
  /** The record this place came from, for attribution. */
  sourceUrl: z.url(),
  name: z.string().min(1).max(120),
  category: z.string().max(60),
  interests: z.array(z.enum(INTERESTS)).max(4),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  openingHours: z.string().max(200).nullable(),
  wikidata: z
    .string()
    .regex(/^Q\d+$/)
    .nullable(),
  website: z.url().nullable(),
});

export type Photo = z.infer<typeof photoSchema>;
export type Blurb = z.infer<typeof blurbSchema>;
export type Activity = z.infer<typeof activitySchema>;
