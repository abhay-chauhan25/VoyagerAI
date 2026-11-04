import "server-only";
import { z } from "zod";
import { fetchJson, UpstreamError } from "./http";
import { classify, overpassFilters } from "./osm-tags";
import type { Activity } from "./types";

/** The main public Overpass server, then a mirror; both are free and volunteer-run. */
const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
const MAX_ELEMENTS = 400;

const elementSchema = z.object({
  type: z.enum(["node", "way", "relation"]),
  id: z.number().int().positive(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  center: z.object({ lat: z.number(), lon: z.number() }).optional(),
  tags: z.record(z.string(), z.string()).optional(),
});
const responseSchema = z.object({ elements: z.array(z.unknown()) });

export function buildQuery(latitude: number, longitude: number, radiusMeters: number): string {
  const around = `(around:${Math.round(radiusMeters)},${latitude.toFixed(5)},${longitude.toFixed(5)})`;
  const parts = overpassFilters().flatMap((filter) => [
    `node${filter}["name"]${around};`,
    `way${filter}["name"]${around};`,
  ]);
  return `[out:json][timeout:20];(${parts.join("")});out center tags ${MAX_ELEMENTS};`;
}

function safeUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Turns an Overpass response into activities. Elements that are malformed, unnamed, unlocated or
 * outside Voyager's categories are skipped; the count of each is returned so nothing disappears
 * silently.
 */
export function parseOverpass(raw: unknown): { activities: Activity[]; skipped: number } {
  const parsed = responseSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Overpass response had an unexpected shape");
  const activities: Activity[] = [];
  let skipped = 0;
  for (const item of parsed.data.elements) {
    const element = elementSchema.safeParse(item);
    if (!element.success) {
      skipped += 1;
      continue;
    }
    const { type, id, tags = {} } = element.data;
    const lat = element.data.lat ?? element.data.center?.lat;
    const lon = element.data.lon ?? element.data.center?.lon;
    const name = tags["name:en"] ?? tags.name;
    const kind = classify(tags);
    if (
      !name ||
      lat === undefined ||
      lon === undefined ||
      !kind ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    ) {
      skipped += 1;
      continue;
    }
    activities.push({
      sourceKey: `osm:${type}/${id}`,
      dataSource: "OpenStreetMap",
      sourceUrl: `https://www.openstreetmap.org/${type}/${id}`,
      name: name.slice(0, 120),
      category: kind.category,
      interests: kind.interests.slice(0, 4),
      latitude: lat,
      longitude: lon,
      openingHours: tags.opening_hours?.slice(0, 200) ?? null,
      wikidata: /^Q\d+$/.test(tags.wikidata ?? "") ? (tags.wikidata as string) : null,
      website: safeUrl(tags.website ?? tags["contact:website"]),
    });
  }
  return { activities, skipped };
}

export async function fetchActivities(latitude: number, longitude: number, radiusMeters = 4000) {
  const body = new URLSearchParams({
    data: buildQuery(latitude, longitude, radiusMeters),
  }).toString();
  let lastError: unknown;
  for (const url of OVERPASS_URLS) {
    try {
      const raw = await fetchJson("OpenStreetMap", url, {
        method: "POST",
        body,
        contentType: "application/x-www-form-urlencoded",
        timeoutMs: 8_000,
      });
      return parseOverpass(raw);
    } catch (error) {
      if (!(error instanceof UpstreamError)) throw error;
      lastError = error;
    }
  }
  throw lastError;
}
