/**
 * Sample content for the landing page's product fragments: one believable day in Lisbon.
 * Real public places; times, durations and walking minutes are illustrative. Totals are computed
 * from the rows so the fragment can never disagree with itself.
 */

export type Stop = {
  time: string;
  name: string;
  kind: string;
  stay: string;
  /** How you get from this stop to the next one. */
  leg?: { mode: "walk" | "tram"; minutes: number; note?: string };
};

export const DAY_ONE = {
  label: "Day 1 · Tuesday",
  area: "Alfama and Graça",
  stops: [
    {
      time: "09:30",
      name: "Miradouro de Santa Luzia",
      kind: "Viewpoint",
      stay: "30 min",
      leg: { mode: "walk", minutes: 4 },
    },
    {
      time: "10:10",
      name: "Castelo de São Jorge",
      kind: "History",
      stay: "1 h 30",
      leg: { mode: "walk", minutes: 9 },
    },
    {
      time: "12:00",
      name: "Lunch in Graça",
      kind: "Food",
      stay: "1 h 15",
      leg: { mode: "walk", minutes: 6 },
    },
    {
      time: "13:30",
      name: "Feira da Ladra",
      kind: "Market · Tue & Sat",
      stay: "1 h",
      leg: { mode: "tram", minutes: 15, note: "Tram 28" },
    },
    { time: "15:00", name: "Miradouro da Senhora do Monte", kind: "Viewpoint", stay: "45 min" },
  ] satisfies Stop[],
};

export function dayTotals(stops: readonly Stop[]) {
  const walkMinutes = stops.reduce(
    (sum, s) => sum + (s.leg?.mode === "walk" ? s.leg.minutes : 0),
    0,
  );
  const tramRides = stops.filter((s) => s.leg?.mode === "tram").length;
  return { stopCount: stops.length, walkMinutes, tramRides };
}

export const DRIFT_CARD = {
  name: "Miradouro de Santa Luzia",
  area: "Alfama",
  kind: "Viewpoint",
  why: "You saved two viewpoints and asked for slow mornings.",
  position: 8,
  deckSize: 20,
  saved: 5,
};

export const TRAVELLERS = [
  { id: "ana", name: "Ana" },
  { id: "ben", name: "Ben" },
  { id: "kai", name: "Kai" },
] as const;

export const VOTE = {
  question: "Day 2, evening",
  options: [
    { title: "Fado in Alfama", detail: "21:00 · 2 h", voters: ["ana", "kai"] },
    { title: "Sunset at LX Factory", detail: "19:30 · 2 h", voters: ["ben"] },
  ],
};

const votesCast = VOTE.options.reduce((sum, option) => sum + option.voters.length, 0);
if (votesCast !== TRAVELLERS.length) {
  throw new Error(
    `Sample vote is inconsistent: ${votesCast} votes for ${TRAVELLERS.length} travellers`,
  );
}
