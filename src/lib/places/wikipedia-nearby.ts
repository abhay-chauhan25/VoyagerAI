import "server-only";
import { z } from "zod";
import type { Interest } from "@/lib/interests";
import { fetchJson } from "./http";
import type { Activity } from "./types";

type Rule = { pattern: RegExp; category: string; interests: Interest[] };

/**
 * Wikipedia's short descriptions ("Museum in Lisbon, Portugal") classify nearby articles. Order
 * matters; anything unmatched (parishes, schools, companies, stations) is not a place to visit.
 */
const RULES: readonly Rule[] = [
  { pattern: /\bmuseum\b/i, category: "Museum", interests: ["Museums", "History"] },
  { pattern: /\b(art gallery|gallery)\b/i, category: "Gallery", interests: ["Art", "Museums"] },
  {
    pattern: /\b(viewpoint|lookout|belvedere|miradouro)\b/i,
    category: "Viewpoint",
    interests: ["Viewpoints"],
  },
  {
    pattern: /\b(castle|fortress|fort|palace|citadel)\b/i,
    category: "Castle",
    interests: ["History", "Architecture"],
  },
  {
    pattern:
      /\b(cathedral|church|basilica|monastery|convent|mosque|temple|synagogue|abbey|chapel)\b/i,
    category: "Landmark building",
    interests: ["Architecture", "History"],
  },
  { pattern: /\b(market|bazaar|souk)\b/i, category: "Market", interests: ["Markets", "Food"] },
  { pattern: /\b(park|garden|gardens|botanical)\b/i, category: "Park", interests: ["Nature"] },
  {
    pattern: /\b(theatre|theater|opera|concert hall|music venue|jazz club)\b/i,
    category: "Arts venue",
    interests: ["Music", "Art"],
  },
  { pattern: /\bbeach\b/i, category: "Beach", interests: ["Beaches", "Nature"] },
  {
    pattern: /\b(square|plaza|piazza|boulevard)\b/i,
    category: "Square",
    interests: ["Architecture", "History"],
  },
  {
    pattern: /\b(funicular|tower|lighthouse|aqueduct|bridge|elevator)\b/i,
    category: "Landmark",
    interests: ["Viewpoints", "Architecture"],
  },
  {
    pattern: /\b(monument|memorial|statue|historic site|ruins|archaeological)\b/i,
    category: "Historic site",
    interests: ["History"],
  },
  { pattern: /\b(zoo|aquarium)\b/i, category: "Zoo", interests: ["Nature"] },
  { pattern: /\b(wine|winery|vineyard|ch[aâ]teau)\b/i, category: "Winery", interests: ["Wine"] },
];

export function classifyDescription(
  description: string | undefined,
): { category: string; interests: Interest[] } | null {
  if (!description) return null;
  for (const rule of RULES)
    if (rule.pattern.test(description))
      return { category: rule.category, interests: [...rule.interests] };
  return null;
}

const responseSchema = z.object({
  query: z
    .object({
      pages: z.array(
        z.object({
          pageid: z.number().int().positive(),
          title: z.string(),
          description: z.string().optional(),
          coordinates: z.array(z.object({ lat: z.number(), lon: z.number() })).optional(),
          pageprops: z.object({ wikibase_item: z.string().optional() }).optional(),
        }),
      ),
    })
    .optional(),
});

export function parseNearby(raw: unknown): { activities: Activity[]; skipped: number } {
  const parsed = responseSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Wikipedia nearby response had an unexpected shape");
  const activities: Activity[] = [];
  let skipped = 0;
  for (const page of parsed.data.query?.pages ?? []) {
    const kind = classifyDescription(page.description);
    const coords = page.coordinates?.[0];
    if (!kind || !coords) {
      skipped += 1;
      continue;
    }
    const wikidata = page.pageprops?.wikibase_item;
    activities.push({
      sourceKey: `wikipedia:${page.pageid}`,
      dataSource: "Wikipedia",
      sourceUrl: `https://en.wikipedia.org/?curid=${page.pageid}`,
      name: page.title.slice(0, 120),
      category: kind.category,
      interests: kind.interests,
      latitude: coords.lat,
      longitude: coords.lon,
      openingHours: null,
      wikidata: wikidata && /^Q\d+$/.test(wikidata) ? wikidata : null,
      website: null,
    });
  }
  return { activities, skipped };
}

/** Notable places near a point from Wikipedia: a keyless fallback when OpenStreetMap is down. */
export async function fetchWikipediaNearby(
  latitude: number,
  longitude: number,
  radiusMeters = 6000,
) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    generator: "geosearch",
    ggscoord: `${latitude.toFixed(5)}|${longitude.toFixed(5)}`,
    ggsradius: String(Math.min(radiusMeters, 10_000)),
    ggslimit: "80",
    prop: "description|coordinates|pageprops",
    // Without this, coordinates come back for only the first 10 pages.
    colimit: "max",
    ppprop: "wikibase_item",
  });
  return parseNearby(await fetchJson("Wikipedia", `https://en.wikipedia.org/w/api.php?${params}`));
}
