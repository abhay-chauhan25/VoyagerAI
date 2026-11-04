import { CONTINENT_BY_COUNTRY, CONTINENT_NAMES, type ContinentCode } from "./continents";

const names = new Intl.DisplayNames(["en"], { type: "region" });

/** English country name for an ISO 3166-1 alpha-2 code; the code itself if it is unknown. */
export function countryName(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return code;
  try {
    return names.of(code) ?? code;
  } catch {
    return code; // Intl rejects codes it doesn't recognise
  }
}

export function continentOf(code: string): ContinentCode | undefined {
  return CONTINENT_BY_COUNTRY[code];
}

export function continentName(code: ContinentCode): string {
  return CONTINENT_NAMES[code];
}

/** Every country code Voyager knows, sorted by English name, for the "add a country" picker. */
export const COUNTRY_CODES: readonly string[] = Object.keys(CONTINENT_BY_COUNTRY).sort((a, b) =>
  countryName(a).localeCompare(countryName(b), "en"),
);
