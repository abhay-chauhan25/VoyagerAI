import { z } from "zod";
import { asData, DATA_RULE } from "@/lib/ai/untrusted";

/** The parts of a trip a story is written from: places and days only. */
export type StoryTrip = {
  title: string;
  cityName: string;
  days: { title: string | null; places: string[] }[];
};

export const storyDraftSchema = z.object({
  title: z.string().min(3).max(80),
  body: z.string().min(40).max(1500),
});
export type StoryDraft = z.infer<typeof storyDraftSchema>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Trims an answer that is slightly too long rather than throwing the whole draft away. */
export function repairStoryDraft(json: unknown): unknown {
  if (!isRecord(json) || typeof json.title !== "string" || typeof json.body !== "string")
    return json;
  return { title: json.title.trim().slice(0, 80), body: json.body.trim().slice(0, 1500) };
}

export function storyPrompt(trip: StoryTrip) {
  const days = trip.days
    .map((day, i) => `Day ${i + 1}${day.title ? ` (${day.title})` : ""}: ${day.places.join("; ")}`)
    .join("\n");
  return {
    system: [
      "You are Compass, the travel guide inside Voyager. You are warm, specific and brief. You never invent places or facts.",
      DATA_RULE,
      "Draft a short trip story (a title and 80 to 160 words) for the traveller to edit and publish.",
      "Write in the first person, in the order of the days. Mention only the places listed. Do not invent what happened there, opinions, prices, weather or companions: describe the shape of the trip and leave room for the traveller to add their own details.",
    ].join("\n"),
    user: `City: ${asData("city", trip.cityName, 100)}\nTrip: ${asData("trip", trip.title, 100)}\n\nDays:\n${asData("days", days, 3000)}`,
    maxOutputTokens: 700,
    repair: repairStoryDraft,
  };
}

function list(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** A plain draft made without AI: what the trip was, day by day, for the traveller to rewrite. */
export function templateStory(trip: StoryTrip): StoryDraft {
  const days = trip.days.filter((day) => day.places.length > 0);
  const lines = days.map((day, i) => {
    const heading = day.title ? `Day ${i + 1}, ${day.title}` : `Day ${i + 1}`;
    return `${heading}: ${list(day.places)}.`;
  });
  const length = `${trip.days.length} ${trip.days.length === 1 ? "day" : "days"}`;
  const body = [`${length} in ${trip.cityName}.`, ...lines].join("\n\n").slice(0, 1500);
  return {
    title: trip.title.slice(0, 80),
    body: body.length >= 40 ? body : `${body} Add what you'd tell a friend about it.`,
  };
}
