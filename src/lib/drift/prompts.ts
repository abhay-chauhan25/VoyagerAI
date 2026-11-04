import { z } from "zod";
import { asData, DATA_RULE } from "@/lib/ai/untrusted";
import type { TravelDna } from "@/lib/dna/queries";
import { BUDGET_LABELS, COMPANION_LABELS, PACE_LABELS, COMPANIONS } from "@/lib/dna/schemas";
import { INTERESTS, isInterest } from "@/lib/interests";

const interestList = z.array(z.enum(INTERESTS)).min(1).max(3);
const destinationIdea = z.object({
  name: z.string().min(2).max(80),
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  why: z.string().min(10).max(220),
  interests: interestList,
});

export const destinationIdeasSchema = z.object({
  destinations: z.array(destinationIdea).min(1).max(12),
});
export const searchAnswerSchema = z.object({
  summary: z.string().min(1).max(220),
  destinations: z.array(destinationIdea).max(6),
});
export const whyLinesSchema = z.object({
  lines: z.array(z.object({ id: z.string().max(40), why: z.string().min(5).max(220) })).max(20),
});

export type DestinationIdeas = z.infer<typeof destinationIdeasSchema>;
export type SearchAnswer = z.infer<typeof searchAnswerSchema>;
export type WhyLines = z.infer<typeof whyLinesSchema>;

const MAX_WHY = 220;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Keeps the usable ideas from an answer: real-looking fields, known interests, trimmed text. */
export function repairIdeas(json: unknown, max: number): unknown {
  if (!isRecord(json) || !Array.isArray(json.destinations)) return json;
  const destinations = json.destinations.flatMap((item) => {
    if (!isRecord(item) || typeof item.name !== "string" || typeof item.why !== "string") return [];
    const countryCode =
      typeof item.countryCode === "string" ? item.countryCode.trim().toUpperCase() : "";
    const interests = Array.isArray(item.interests)
      ? [
          ...new Set(
            item.interests.filter((i): i is string => typeof i === "string" && isInterest(i)),
          ),
        ].slice(0, 3)
      : [];
    if (!/^[A-Z]{2}$/.test(countryCode) || interests.length === 0) return [];
    return [
      { name: item.name.trim(), countryCode, why: item.why.trim().slice(0, MAX_WHY), interests },
    ];
  });
  return {
    ...json,
    destinations: destinations.slice(0, max),
    ...(typeof json.summary === "string" ? { summary: json.summary.slice(0, MAX_WHY) } : {}),
  };
}

export function repairWhyLines(json: unknown): unknown {
  if (!isRecord(json) || !Array.isArray(json.lines)) return json;
  const lines = json.lines.flatMap((line) =>
    isRecord(line) && typeof line.id === "string" && typeof line.why === "string"
      ? [{ id: line.id.slice(0, 40), why: line.why.trim().slice(0, MAX_WHY) }]
      : [],
  );
  return { lines: lines.slice(0, 20) };
}

const ROLE =
  "You are Compass, the travel guide inside Voyager. You are warm, specific and brief. You only ever suggest real places that exist today.";

/** The traveller's Travel DNA as compact facts for a prompt. Our own data, so not wrapped as untrusted. */
export function describeProfile(dna: TravelDna): string {
  const ranked = Object.entries(dna.weights).sort((a, b) => b[1] - a[1]);
  const loves = ranked.filter(([, w]) => w >= 0.4).map(([i, w]) => `${i} (${w.toFixed(2)})`);
  const skips = ranked.filter(([, w]) => w <= -0.4).map(([i]) => i);
  const companions = dna.companions
    .filter((c): c is (typeof COMPANIONS)[number] => (COMPANIONS as readonly string[]).includes(c))
    .map((c) => COMPANION_LABELS[c].toLowerCase());
  return [
    `Loves: ${loves.join(", ") || "nothing strong yet"}.`,
    `Skips: ${skips.join(", ") || "nothing in particular"}.`,
    `Pace: ${PACE_LABELS[dna.pace]}. Budget: ${BUDGET_LABELS[dna.budget]}. Travels ${companions.join(" or ") || "in any company"}.`,
  ].join("\n");
}

export function destinationsPrompt(profile: string, exclude: readonly string[], count: number) {
  return {
    system: [
      ROLE,
      DATA_RULE,
      `Suggest ${count} cities this traveller would love, spread across different countries and regions.`,
      "Use each city's common English name and its ISO 3166-1 alpha-2 country code.",
      "Each 'why' is one sentence of at most 25 words, speaking to the traveller ('you'), tied to their interests.",
      "'interests' lists 1-3 of the traveller's interests the city is genuinely good for.",
    ].join("\n"),
    user: `Traveller:\n${profile}\n\nDo not suggest these places they have already been to or judged:\n${asData("exclude", exclude.join(", "), 1500)}`,
    maxOutputTokens: 2048,
    repair: (json: unknown) => repairIdeas(json, 12),
  };
}

export function searchPrompt(profile: string, query: string) {
  return {
    system: [
      ROLE,
      DATA_RULE,
      "Answer the traveller's request with up to 6 real cities that fit it and their Travel DNA.",
      "If the request names a place, include it. If it cannot be answered with real places, return no destinations.",
      "'summary' is one sentence restating what you looked for. Each 'why' is one sentence of at most 25 words.",
      "Use common English city names and ISO 3166-1 alpha-2 country codes.",
    ].join("\n"),
    user: `Traveller:\n${profile}\n\nTheir request:\n${asData("request", query, 300)}`,
    maxOutputTokens: 1536,
    repair: (json: unknown) => repairIdeas(json, 6),
  };
}

export function whyLinesPrompt(
  profile: string,
  items: readonly { id: string; name: string; category: string }[],
) {
  const list = items.map((item) => `${item.id} | ${item.name} | ${item.category}`).join("\n");
  return {
    system: [
      ROLE,
      DATA_RULE,
      "For each place, write one sentence of at most 22 words on why this traveller would enjoy it.",
      "Use only the facts given and their interests. Do not invent opening times, prices or history. Keep each id exactly as given.",
    ].join("\n"),
    user: `Traveller:\n${profile}\n\nPlaces (id | name | category):\n${asData("places", list, 3000)}`,
    maxOutputTokens: 1536,
    repair: repairWhyLines,
  };
}
