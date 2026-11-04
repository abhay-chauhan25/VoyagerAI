/**
 * The interest vocabulary shared by Travel DNA, the trip-brief parser and (later) Drift.
 * Keeping one list means a "Food" lover in their DNA and "food" in a typed wish mean the same thing.
 */
export const INTERESTS = [
  "Food",
  "Viewpoints",
  "Museums",
  "Art",
  "History",
  "Architecture",
  "Markets",
  "Nightlife",
  "Music",
  "Beaches",
  "Hiking",
  "Nature",
  "Wine",
  "Coffee",
  "Shopping",
] as const;

export type Interest = (typeof INTERESTS)[number];

export function isInterest(value: string): value is Interest {
  return (INTERESTS as readonly string[]).includes(value);
}
