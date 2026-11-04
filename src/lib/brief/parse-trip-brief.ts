/**
 * Turns a free-text trip wish ("three slow days in Lisbon in May, mostly food, €600 each, four of
 * us") into a structured brief. Deterministic and rule-based on purpose: it runs on every keystroke
 * in the browser, costs nothing, and gives the AI planner a clean, validated starting point later.
 * Anything it cannot read stays null rather than being guessed.
 */

import type { Interest } from "@/lib/interests";

export type Pace = "Slow" | "Balanced" | "Full";
export type Currency = "EUR" | "USD" | "GBP";

export type TripBrief = {
  destination: string | null;
  days: number | null;
  when: string | null;
  pace: Pace;
  paceStated: boolean;
  interests: Interest[];
  budget: { amount: number; currency: Currency; per: "person" | "total" | "unspecified" } | null;
  travellers: number | null;
};

export const MAX_TRIP_DAYS = 60;
export const MAX_TRAVELLERS = 20;
const MAX_BUDGET = 1_000_000;

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};
const NUMBER_PATTERN = `(\\d{1,3}|${Object.keys(NUMBER_WORDS).join("|")})`;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;
const SEASONS: Record<string, string> = {
  spring: "Spring",
  summer: "Summer",
  autumn: "Autumn",
  fall: "Autumn",
  winter: "Winter",
};

/** Canonical interest → words that signal it. Order here is only a tiebreak; output follows the text. */
const INTEREST_WORDS: Record<Interest, readonly string[]> = {
  Food: ["food", "foodie", "eat", "eating", "restaurants", "cuisine", "street food", "tapas"],
  Viewpoints: ["view", "views", "viewpoint", "viewpoints", "miradouro", "sunset", "sunsets"],
  Museums: ["museum", "museums", "gallery", "galleries"],
  Art: ["art", "street art", "design"],
  History: ["history", "historic", "castle", "castles", "ruins"],
  Architecture: ["architecture", "buildings", "churches", "cathedral", "cathedrals"],
  Markets: ["market", "markets", "flea market"],
  Nightlife: ["nightlife", "bars", "clubbing", "cocktails"],
  Music: ["music", "fado", "jazz", "concert", "concerts", "live music"],
  Beaches: ["beach", "beaches", "surf", "surfing", "swimming"],
  Hiking: ["hike", "hikes", "hiking", "trek", "trekking", "walks", "walking"],
  Nature: ["nature", "parks", "gardens", "mountains", "wildlife"],
  Wine: ["wine", "wineries", "vineyards", "port"],
  Coffee: ["coffee", "cafes", "cafés", "pastries", "bakeries"],
  Shopping: ["shopping", "boutiques", "vintage"],
};

const SLOW_WORDS = [
  "slow",
  "relaxed",
  "relaxing",
  "lazy",
  "unhurried",
  "easy",
  "laid-back",
  "chill",
];
const FULL_WORDS = [
  "packed",
  "busy",
  "full",
  "fast",
  "intense",
  "action-packed",
  "nonstop",
  "non-stop",
];

const STOP_WORDS = new Set(["I", "We", "My", "Our", "The", "A", "An", "And", "Just", "Mostly"]);

function toNumber(token: string): number | null {
  const lower = token.toLowerCase();
  if (lower in NUMBER_WORDS) return NUMBER_WORDS[lower] ?? null;
  const n = Number.parseInt(token, 10);
  return Number.isFinite(n) ? n : null;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wordRegex(word: string): RegExp {
  return new RegExp(`(?<![\\p{L}])${escapeRegExp(word)}(?![\\p{L}])`, "iu");
}

function findDays(text: string): number | null {
  const lower = text.toLowerCase();
  if (/\blong weekend\b/.test(lower)) return 3;
  if (/\bweekend\b/.test(lower)) return 2;
  if (/\bfortnight\b/.test(lower)) return 14;

  // Up to two describing words may sit between the count and the unit ("three slow days").
  const unit = new RegExp(
    `\\b${NUMBER_PATTERN}((?:[\\s-]+[a-z]+){0,2}?)[\\s-]*(day|days|night|nights|week|weeks)\\b`,
    "i",
  );
  const match = unit.exec(text);
  if (!match?.[1] || !match[3]) return null;
  // "a few days" or "a couple of days" are vague, not a count of one.
  if (/\b(few|couple|several|many|some|of)\b/i.test(match[2] ?? "")) return null;
  const count = toNumber(match[1]);
  if (count === null || count < 1) return null;

  const kind = match[3].toLowerCase();
  const days = kind.startsWith("week") ? count * 7 : kind.startsWith("night") ? count + 1 : count;
  return days <= MAX_TRIP_DAYS ? days : null;
}

function findWhen(text: string): string | null {
  for (const month of MONTHS) {
    if (month === "May") {
      // "may" is also a verb, so the month needs its capital or a preceding "in"/"early"/"late".
      if (/\bMay\b/.test(text) || /\b(?:in|early|late|mid)[\s-]+may\b/i.test(text)) return month;
      continue;
    }
    if (new RegExp(`\\b(?:${month}|${month.slice(0, 3)})\\b`, "i").test(text)) return month;
  }
  for (const [word, season] of Object.entries(SEASONS)) {
    if (wordRegex(word).test(text)) return season;
  }
  return null;
}

function isCalendarWord(word: string): boolean {
  const lower = word.toLowerCase();
  return MONTHS.some((m) => m.toLowerCase() === lower) || lower in SEASONS;
}

function findDestination(text: string): string | null {
  const pattern =
    /\b(?:in|to|around|visit|visiting|explore|exploring|through)\s+((?:\p{Lu}[\p{L}'’.-]*)(?:\s+(?:\p{Lu}[\p{L}'’.-]*|de|da|do|del|di|la|le|el|of))*)/gu;
  for (const match of text.matchAll(pattern)) {
    const words = (match[1] ?? "").split(/\s+/);
    // Drop trailing connectors and calendar words ("Lisbon in May" must not become "Lisbon May").
    while (words.length > 0) {
      const last = words[words.length - 1] ?? "";
      if (isCalendarWord(last) || /^(?:de|da|do|del|di|la|le|el|of)$/.test(last)) words.pop();
      else break;
    }
    const first = words[0];
    if (!first || isCalendarWord(first) || STOP_WORDS.has(first)) continue;
    return words.join(" ").replace(/[.,;:!?]+$/, "");
  }
  return null;
}

function findPace(text: string): { pace: Pace; stated: boolean } {
  if (SLOW_WORDS.some((w) => wordRegex(w).test(text))) return { pace: "Slow", stated: true };
  if (FULL_WORDS.some((w) => wordRegex(w).test(text))) return { pace: "Full", stated: true };
  return { pace: "Balanced", stated: false };
}

function findInterests(text: string): Interest[] {
  const found: { label: Interest; index: number }[] = [];
  for (const [label, words] of Object.entries(INTEREST_WORDS)) {
    let first = -1;
    for (const word of words) {
      const match = wordRegex(word).exec(text);
      if (match && (first === -1 || match.index < first)) first = match.index;
    }
    if (first !== -1) found.push({ label: label as Interest, index: first });
  }
  return found.sort((a, b) => a.index - b.index).map((f) => f.label);
}

const CURRENCY_BY_TOKEN: Record<string, Currency> = {
  "€": "EUR",
  eur: "EUR",
  euro: "EUR",
  euros: "EUR",
  $: "USD",
  usd: "USD",
  dollar: "USD",
  dollars: "USD",
  "£": "GBP",
  gbp: "GBP",
  pound: "GBP",
  pounds: "GBP",
};

function parseAmount(digits: string, thousands: string | undefined): number | null {
  const normalised = digits.replace(/,(?=\d{3}\b)/g, "");
  const value = Number.parseFloat(normalised);
  if (!Number.isFinite(value)) return null;
  const amount = Math.round(thousands ? value * 1000 : value);
  return amount > 0 && amount <= MAX_BUDGET ? amount : null;
}

function findBudget(text: string): TripBrief["budget"] {
  const before = /([€$£])\s?(\d[\d,]*(?:\.\d+)?)\s?(k)?\b/i;
  const after = /\b(\d[\d,]*(?:\.\d+)?)\s?(k)?\s?(€|eur|euros?|usd|dollars?|gbp|pounds?)\b/i;

  let amount: number | null = null;
  let currency: Currency | undefined;
  let end = 0;

  const pre = before.exec(text);
  if (pre?.[1] && pre[2]) {
    amount = parseAmount(pre[2], pre[3]);
    currency = CURRENCY_BY_TOKEN[pre[1]];
    end = pre.index + pre[0].length;
  } else {
    const post = after.exec(text);
    if (post?.[1] && post[3]) {
      amount = parseAmount(post[1], post[2]);
      currency = CURRENCY_BY_TOKEN[post[3].toLowerCase()];
      end = post.index + post[0].length;
    }
  }
  if (amount === null || !currency) return null;

  const tail = text.slice(end, end + 24).toLowerCase();
  const per = /\b(each|per person|a person|pp|a head|apiece)\b/.test(tail)
    ? "person"
    : /\b(total|in total|altogether|for all|for everyone)\b/.test(tail)
      ? "total"
      : "unspecified";
  return { amount, currency, per };
}

function clampTravellers(n: number | null): number | null {
  return n !== null && n >= 1 && n <= MAX_TRAVELLERS ? n : null;
}

function findTravellers(text: string): number | null {
  const lower = text.toLowerCase();
  if (/\b(solo|alone|by myself|just me|on my own)\b/.test(lower)) return 1;

  const ofUs = new RegExp(`\\b${NUMBER_PATTERN}\\s+of\\s+us\\b`, "i").exec(text);
  if (ofUs?.[1]) return clampTravellers(toNumber(ofUs[1]));

  const familyOf = new RegExp(`\\bfamily of\\s+${NUMBER_PATTERN}\\b`, "i").exec(text);
  if (familyOf?.[1]) return clampTravellers(toNumber(familyOf[1]));

  const withFriends = new RegExp(
    `\\bwith\\s+${NUMBER_PATTERN}\\s+(friends|people|others|kids|children)\\b`,
    "i",
  ).exec(text);
  if (withFriends?.[1]) {
    const n = toNumber(withFriends[1]);
    return clampTravellers(n === null ? null : n + 1);
  }

  const group = new RegExp(
    `\\b${NUMBER_PATTERN}\\s+(people|travellers|travelers|adults|friends)\\b`,
    "i",
  ).exec(text);
  if (group?.[1]) return clampTravellers(toNumber(group[1]));

  if (
    /\b(couple|two of us|honeymoon|with my (partner|wife|husband|girlfriend|boyfriend))\b/.test(
      lower,
    )
  )
    return 2;
  return null;
}

export function parseTripBrief(input: string): TripBrief {
  const text = input.normalize("NFC");
  const { pace, stated } = findPace(text);
  return {
    destination: findDestination(text),
    days: findDays(text),
    when: findWhen(text),
    pace,
    paceStated: stated,
    interests: findInterests(text),
    budget: findBudget(text),
    travellers: findTravellers(text),
  };
}

const CURRENCY_SYMBOL: Record<Currency, string> = { EUR: "€", USD: "$", GBP: "£" };

export function formatBudget(budget: NonNullable<TripBrief["budget"]>): string {
  const amount = `${CURRENCY_SYMBOL[budget.currency]}${budget.amount.toLocaleString("en-GB")}`;
  if (budget.per === "person") return `${amount} per person`;
  if (budget.per === "total") return `${amount} in total`;
  return amount;
}
