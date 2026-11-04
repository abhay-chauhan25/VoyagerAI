/**
 * What Voyager assumes about a stop from its type until the traveller says otherwise: how long a
 * visit usually takes, a rough price level, and whether rain or darkness spoils it. These are
 * planning defaults, shown as editable guesses, never presented as facts about the place.
 */

export const PRICE_LEVELS = [0, 1, 2, 3] as const;
export type PriceLevel = (typeof PRICE_LEVELS)[number];
export const PRICE_LABELS: Record<PriceLevel, string> = { 0: "Free", 1: "$", 2: "$$", 3: "$$$" };

type Profile = {
  dwell: number; // minutes
  price: PriceLevel;
  outdoor: boolean; // worse in rain
  evening: boolean; // better late in the day
};

const DEFAULT: Profile = { dwell: 60, price: 1, outdoor: false, evening: false };

const BY_CATEGORY: Record<string, Profile> = {
  Museum: { dwell: 120, price: 1, outdoor: false, evening: false },
  Gallery: { dwell: 90, price: 1, outdoor: false, evening: false },
  "Public art": { dwell: 20, price: 0, outdoor: true, evening: false },
  Viewpoint: { dwell: 30, price: 0, outdoor: true, evening: false },
  Castle: { dwell: 120, price: 1, outdoor: true, evening: false },
  "Historic site": { dwell: 45, price: 0, outdoor: true, evening: false },
  Landmark: { dwell: 45, price: 0, outdoor: true, evening: false },
  "Landmark building": { dwell: 45, price: 0, outdoor: false, evening: false },
  Square: { dwell: 30, price: 0, outdoor: true, evening: false },
  Market: { dwell: 60, price: 1, outdoor: false, evening: false },
  Restaurant: { dwell: 90, price: 2, outdoor: false, evening: false },
  Café: { dwell: 45, price: 1, outdoor: false, evening: false },
  Bar: { dwell: 90, price: 2, outdoor: false, evening: true },
  "Music venue": { dwell: 120, price: 2, outdoor: false, evening: true },
  "Arts venue": { dwell: 120, price: 2, outdoor: false, evening: true },
  "Wine shop": { dwell: 45, price: 2, outdoor: false, evening: false },
  Winery: { dwell: 120, price: 2, outdoor: false, evening: false },
  Park: { dwell: 60, price: 0, outdoor: true, evening: false },
  Beach: { dwell: 150, price: 0, outdoor: true, evening: false },
  Zoo: { dwell: 150, price: 2, outdoor: true, evening: false },
  Shopping: { dwell: 90, price: 1, outdoor: false, evening: false },
};

export function stopProfile(category: string): Profile {
  return BY_CATEGORY[category] ?? DEFAULT;
}

/** Stops per day for each pace, and the busy hours a day of that pace comfortably holds. */
export const PACE_PLAN = {
  slow: { stops: 3, busyMinutes: 5 * 60 },
  balanced: { stops: 4, busyMinutes: 7 * 60 },
  full: { stops: 6, busyMinutes: 9 * 60 },
} as const;

/** Price points (the sum of levels) a day comfortably holds for each budget band. */
export const BUDGET_PLAN = {
  shoestring: { points: 2 },
  comfortable: { points: 5 },
  splurge: { points: 9 },
} as const;
