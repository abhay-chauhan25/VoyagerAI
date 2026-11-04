import "server-only";
import { z } from "zod";
import { fetchJson } from "./http";
import type { Blurb, Photo } from "./types";

const COMMONS_HOSTS = new Set(["upload.wikimedia.org", "thumb.wikimedia.org"]);
const COMMONS_PATH = "/wikipedia/commons/";
const PHOTO_WIDTH = 900;

/** Strips HTML (Commons credits are HTML fragments) and collapses whitespace. */
export function plainText(html: string, maxLength = 200): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

/** A Wikimedia Commons file URL without tracking parameters, or null if it isn't one. */
export function cleanCommonsUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (
    url.protocol !== "https:" ||
    !COMMONS_HOSTS.has(url.hostname) ||
    !url.pathname.startsWith(COMMONS_PATH)
  ) {
    return null;
  }
  url.search = "";
  url.hash = "";
  return url.toString();
}

/**
 * The file name behind a Commons image URL. Only files hosted on Commons are used: Commons accepts
 * freely licensed files only (Wikipedia's own uploads may be non-free and are refused).
 */
export function commonsFileName(imageUrl: string): string | null {
  const clean = cleanCommonsUrl(imageUrl);
  if (!clean) return null;
  const path = new URL(clean).pathname.slice(COMMONS_PATH.length).split("/");
  // a/ab/File.jpg  or  thumb/a/ab/File.jpg/800px-File.jpg
  const name = path[0] === "thumb" ? path[3] : path[2];
  try {
    return name ? decodeURIComponent(name) : null;
  } catch {
    return null;
  }
}

const imageInfoSchema = z.object({
  query: z.object({
    pages: z.record(
      z.string(),
      z.object({
        imageinfo: z
          .array(
            z.object({
              thumburl: z.url().optional(),
              url: z.url(),
              descriptionurl: z.url(),
              extmetadata: z.record(z.string(), z.object({ value: z.unknown() })).optional(),
            }),
          )
          .optional(),
      }),
    ),
  }),
});

const metaText = (meta: Record<string, { value: unknown }> | undefined, key: string) =>
  typeof meta?.[key]?.value === "string" ? (meta[key].value as string) : "";

/** A Commons file's sized URL with the author and licence its terms require; null if unusable. */
export async function commonsPhoto(fileName: string): Promise<Photo | null> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "1",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: String(PHOTO_WIDTH),
    titles: `File:${fileName}`,
  });
  const raw = await fetchJson(
    "Wikimedia Commons",
    `https://commons.wikimedia.org/w/api.php?${params}`,
  );
  const parsed = imageInfoSchema.safeParse(raw);
  if (!parsed.success) return null;
  const info = Object.values(parsed.data.query.pages)[0]?.imageinfo?.[0];
  if (!info) return null;
  const license = plainText(metaText(info.extmetadata, "LicenseShortName"), 60);
  if (!license) return null; // no licence stated: don't use it
  const licenseUrl = metaText(info.extmetadata, "LicenseUrl");
  const url = cleanCommonsUrl(info.thumburl ?? info.url);
  if (!url) return null;
  return {
    url,
    author: plainText(metaText(info.extmetadata, "Artist")) || "Unknown author",
    license,
    licenseUrl: /^https?:\/\//.test(licenseUrl) ? licenseUrl : null,
    page: info.descriptionurl,
  };
}

const summarySchema = z.object({
  type: z.string(),
  title: z.string(),
  description: z.string().optional(),
  extract: z.string().optional(),
  coordinates: z.object({ lat: z.number(), lon: z.number() }).optional(),
  originalimage: z.object({ source: z.string() }).optional(),
  content_urls: z.object({ desktop: z.object({ page: z.url() }) }).optional(),
});

/** Great-circle distance in km, used to check a summary is about the right place. */
export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((bLat - aLat) * rad) / 2) ** 2 +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(((bLon - aLon) * rad) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const SAME_PLACE_KM = 40;
/** A page whose short description says it is a region, not a town, describes the wrong thing. */
const REGION_WORDS =
  /\b(state|province|region|department|prefecture|county|governorate|oblast|canton|country|island|river)\b/i;
const TOWN_WORDS = /\b(city|town|capital|village|municipality|commune|metropolis|port)\b/i;

export function isAboutTheTown(description: string | undefined): boolean {
  if (!description) return true;
  return TOWN_WORDS.test(description) || !REGION_WORDS.test(description);
}

/** Titles to try for a city, most specific first (Wikivoyage uses "Name (city)" for clashes). */
export function summaryTitles(name: string, region: string | null): string[] {
  const titles = [
    `${name} (city)`,
    name,
    region && region !== name ? `${name} (${region})` : null,
    `${name} City`,
  ];
  return [...new Set(titles.filter((t): t is string => Boolean(t)))];
}

/**
 * A short description of a city from Wikivoyage (travel-focused), falling back to Wikipedia, and a
 * lead photo hosted on Commons from whichever source has one. Pages far from the city or describing
 * a region rather than the town are rejected, so "Oaxaca" never describes the state.
 */
export async function placeSummary(
  titles: readonly string[],
  latitude: number,
  longitude: number,
): Promise<{ blurb: Blurb | null; photoFile: string | null }> {
  let blurb: Blurb | null = null;
  let photoFile: string | null = null;
  for (const [source, host] of [
    ["Wikivoyage", "en.wikivoyage.org"],
    ["Wikipedia", "en.wikipedia.org"],
  ] as const) {
    for (const title of titles) {
      if (blurb && photoFile) return { blurb, photoFile };
      const raw = await fetchJson(
        source,
        `https://${host}/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      );
      const summary = summarySchema.safeParse(raw);
      if (!summary.success || summary.data.type !== "standard") continue;
      const { coordinates, description, content_urls, extract, originalimage } = summary.data;
      if (
        !coordinates ||
        distanceKm(latitude, longitude, coordinates.lat, coordinates.lon) > SAME_PLACE_KM
      )
        continue;
      if (!isAboutTheTown(description)) continue;
      const text = plainText(extract ?? "", 600);
      if (!blurb && content_urls && text) blurb = { text, source, page: content_urls.desktop.page };
      if (!photoFile && originalimage) photoFile = commonsFileName(originalimage.source);
      break; // this source matched the town: no need to try its other titles
    }
  }
  return { blurb, photoFile };
}

const claimsSchema = z.object({
  claims: z.object({
    P18: z
      .array(
        z.object({ mainsnak: z.object({ datavalue: z.object({ value: z.string() }).optional() }) }),
      )
      .optional(),
  }),
});

/** The main image (Wikidata P18, always a Commons file) of a Wikidata item. */
export async function wikidataImage(qid: string): Promise<string | null> {
  if (!/^Q\d+$/.test(qid)) return null;
  const params = new URLSearchParams({
    action: "wbgetclaims",
    format: "json",
    entity: qid,
    property: "P18",
  });
  const raw = await fetchJson("Wikidata", `https://www.wikidata.org/w/api.php?${params}`);
  const parsed = claimsSchema.safeParse(raw);
  return parsed.success ? (parsed.data.claims.P18?.[0]?.mainsnak.datavalue?.value ?? null) : null;
}
