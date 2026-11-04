import "server-only";
import { mapLimited, UpstreamError } from "@/lib/places/http";
import type { Blurb, Photo } from "@/lib/places/types";
import { summaryTitles } from "@/lib/places/wikimedia";
import type { City } from "./ground";
import type { Providers } from "./providers";

const CONCURRENCY = 4;

/**
 * Adds a description and a freely licensed photo to each city. A failed lookup leaves that card
 * without them (and is logged); it never fails the deck.
 */
export async function describeCities(
  p: Providers,
  cities: readonly City[],
): Promise<{ blurb: Blurb | null; photo: Photo | null }[]> {
  let failures = 0;
  const results = await mapLimited(cities, CONCURRENCY, async (city) => {
    try {
      const { blurb, photoFile } = await p.summary(
        summaryTitles(city.name, city.region),
        city.latitude,
        city.longitude,
      );
      const photo = photoFile ? await p.photo(photoFile) : null;
      return { blurb, photo };
    } catch (error) {
      if (!(error instanceof UpstreamError)) throw error;
      failures += 1;
      return { blurb: null, photo: null };
    }
  });
  if (failures > 0) console.warn("Some city descriptions could not be fetched", { failures });
  return results;
}

export async function photosForWikidata(
  p: Providers,
  ids: readonly (string | null)[],
): Promise<(Photo | null)[]> {
  let failures = 0;
  const results = await mapLimited(ids, CONCURRENCY, async (qid) => {
    if (!qid) return null;
    try {
      const file = await p.wikidataImage(qid);
      return file ? await p.photo(file) : null;
    } catch (error) {
      if (!(error instanceof UpstreamError)) throw error;
      failures += 1;
      return null;
    }
  });
  if (failures > 0) console.warn("Some place photos could not be fetched", { failures });
  return results;
}
