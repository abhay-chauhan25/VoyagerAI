import { continentOf } from "./countries";
import type { ContinentCode } from "./continents";

export type VisitLike = { country_code: string; city_id: number | null };

export type AtlasStats = {
  countries: number;
  cities: number;
  continents: ContinentCode[];
};

/** Counts computed from the visit rows themselves, so the numbers always match the list. */
export function atlasStats(visits: readonly VisitLike[]): AtlasStats {
  const countries = new Set(visits.map((v) => v.country_code));
  const cities = new Set(visits.filter((v) => v.city_id !== null).map((v) => v.city_id));
  const continents = new Set<ContinentCode>();
  for (const code of countries) {
    const continent = continentOf(code);
    if (continent) continents.add(continent);
  }
  return { countries: countries.size, cities: cities.size, continents: [...continents].sort() };
}
