import type { CSSProperties } from "react";
import type { Interest } from "@/lib/interests";

/**
 * Voyager's six travel hues (defined per theme in globals.css). Each encodes something: a trip day,
 * an interest family or a section of the app. They never appear as decoration.
 */
export const HUES = ["cobalt", "sea", "vermilion", "saffron", "rose", "moss"] as const;
export type Hue = (typeof HUES)[number];

export function hueVar(hue: Hue): string {
  return `var(--hue-${hue})`;
}

/** Sets --hue for the .hue-* classes. */
export function hueStyle(hue: Hue): CSSProperties {
  return { "--hue": hueVar(hue) } as CSSProperties;
}

/** Day 1 is cobalt, day 2 sea, and so on, repeating after six days. */
export function dayHue(dayIndex: number): Hue {
  return HUES[((dayIndex % HUES.length) + HUES.length) % HUES.length]!;
}

/** Interests share a hue with their family: food and drink, culture, the city, night, outdoors, water. */
export const INTEREST_HUE: Record<Interest, Hue> = {
  Food: "vermilion",
  Coffee: "vermilion",
  Wine: "vermilion",
  Markets: "vermilion",
  Museums: "rose",
  Art: "rose",
  History: "rose",
  Architecture: "cobalt",
  Viewpoints: "cobalt",
  Shopping: "cobalt",
  Nightlife: "saffron",
  Music: "saffron",
  Nature: "moss",
  Hiking: "moss",
  Beaches: "sea",
};

/** Each main section's mark in the navigation. */
export const SECTION_HUE: Record<string, Hue> = {
  "/drift": "vermilion",
  "/trips": "cobalt",
  "/atlas": "sea",
  "/notes": "saffron",
  "/dna": "rose",
};

/** A stable hue for a name, so a place without a photo always gets the same colour. */
export function nameHue(name: string): Hue {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return HUES[hash % HUES.length]!;
}

/** The resolved colour of a hue in the current theme, for canvases (Mapbox) that can't read CSS. */
export function resolveHue(hue: Hue, fallback = "#2456d6"): string {
  if (typeof document === "undefined") return fallback;
  return (
    getComputedStyle(document.documentElement).getPropertyValue(`--hue-${hue}`).trim() || fallback
  );
}
