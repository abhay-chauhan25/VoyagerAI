import { z } from "zod";
import { asData, DATA_RULE } from "@/lib/ai/untrusted";
import type { Plan } from "./plan";
import { MAX_DAYS, type Change } from "./schemas";

const ROLE =
  "You are Compass, the travel guide inside Voyager. You are warm, specific and brief. You never invent places or facts.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/* ---------- Day titles ---------- */

export const dayTitlesSchema = z.object({
  titles: z
    .array(
      z.object({
        day: z.number().int().min(1).max(MAX_DAYS),
        title: z.string().min(2).max(40),
      }),
    )
    .max(MAX_DAYS),
});
export type DayTitles = z.infer<typeof dayTitlesSchema>;

export function repairDayTitles(json: unknown): unknown {
  if (!isRecord(json) || !Array.isArray(json.titles)) return json;
  return {
    titles: json.titles
      .flatMap((t) =>
        isRecord(t) && typeof t.day === "number" && typeof t.title === "string"
          ? [{ day: Math.round(t.day), title: t.title.trim().replace(/\s+/g, " ").slice(0, 40) }]
          : [],
      )
      .slice(0, MAX_DAYS),
  };
}

export function dayTitlesPrompt(
  city: string,
  days: readonly { day: number; places: { name: string; category: string }[] }[],
) {
  const list = days
    .map((d) => `Day ${d.day}: ${d.places.map((p) => `${p.name} (${p.category})`).join("; ")}`)
    .join("\n");
  return {
    system: [
      ROLE,
      DATA_RULE,
      "Give each day of the trip a short title of 2 to 5 words that says what the day is about, using its places: a neighbourhood they share, or their common theme.",
      "Do not invent facts. Keep the day numbers exactly as given. Skip days with no places.",
    ].join("\n"),
    user: `City: ${asData("city", city, 100)}\n\nDays:\n${asData("days", list, 3000)}`,
    maxOutputTokens: 512,
    repair: repairDayTitles,
  };
}

/* ---------- Proposed changes ---------- */

const ACTIONS = ["move", "remove", "add"] as const;

export const proposalAnswerSchema = z.object({
  summary: z.string().min(1).max(240),
  changes: z
    .array(
      z.object({
        action: z.enum(ACTIONS),
        stop: z
          .string()
          .regex(/^s\d{1,3}$/)
          .optional(),
        save: z
          .string()
          .regex(/^a\d{1,3}$/)
          .optional(),
        day: z.number().int().min(1).max(MAX_DAYS).optional(),
        reason: z.string().min(1).max(200),
      }),
    )
    .max(8),
});
export type ProposalAnswer = z.infer<typeof proposalAnswerSchema>;

export function repairProposal(json: unknown): unknown {
  if (!isRecord(json) || !Array.isArray(json.changes)) return json;
  const changes = json.changes.flatMap((c) => {
    if (!isRecord(c) || typeof c.action !== "string" || typeof c.reason !== "string") return [];
    if (!(ACTIONS as readonly string[]).includes(c.action)) return [];
    return [
      {
        action: c.action,
        ...(typeof c.stop === "string" ? { stop: c.stop.trim() } : {}),
        ...(typeof c.save === "string" ? { save: c.save.trim() } : {}),
        ...(typeof c.day === "number" ? { day: Math.round(c.day) } : {}),
        reason: c.reason.trim().slice(0, 200),
      },
    ];
  });
  return {
    summary: typeof json.summary === "string" ? json.summary.trim().slice(0, 240) : json.summary,
    changes: changes.slice(0, 8),
  };
}

/** Short ids for the prompt, so the model never sees or echoes database ids. */
export function planRefs(plan: Plan) {
  const stops = [...plan.stops].sort((a, b) => a.day - b.day || a.position - b.position);
  return {
    stops: stops.map((s, i) => ({ ref: `s${i + 1}`, stop: s })),
    spares: plan.spares.slice(0, 40).map((s, i) => ({ ref: `a${i + 1}`, spare: s })),
  };
}

export function proposalPrompt(profile: string, plan: Plan, request: string) {
  const refs = planRefs(plan);
  const days = Array.from({ length: plan.days }, (_, d) => {
    const items = refs.stops
      .filter((r) => r.stop.day === d)
      .map(
        (r) => `${r.ref} ${r.stop.name} (${r.stop.category}${r.stop.outdoor ? ", outdoors" : ""})`,
      );
    return `Day ${d + 1}: ${items.join("; ") || "nothing yet"}`;
  }).join("\n");
  const spares =
    refs.spares
      .map(
        (r) =>
          `${r.ref} ${r.spare.name} (${r.spare.category}${r.spare.outdoor ? ", outdoors" : ""})`,
      )
      .join("; ") || "none";
  return {
    system: [
      ROLE,
      DATA_RULE,
      "The traveller wants to change their trip. Propose changes using only these actions:",
      "- move: move stop `stop` to day `day`;",
      "- remove: remove stop `stop` from the trip;",
      "- add: add saved place `save` to day `day`.",
      "Use the ids exactly as given; days are numbered from 1. Propose at most 8 changes, the fewest that do the job.",
      "Each reason is one sentence of at most 20 words. 'summary' is one sentence describing the change as a whole.",
      "If the request cannot be met with these actions, return no changes and say why in 'summary'.",
    ].join("\n"),
    user: `Traveller:\n${profile}\n\nThe trip:\n${asData("trip", days, 4000)}\n\nSaved places not in the trip:\n${asData("saved", spares, 3000)}\n\nTheir request:\n${asData("request", request, 300)}`,
    maxOutputTokens: 1024,
    repair: repairProposal,
  };
}

/** Maps the model's short ids back to real stops and saves; anything that doesn't resolve is dropped. */
export function resolveProposal(answer: ProposalAnswer, plan: Plan): Change[] {
  const refs = planRefs(plan);
  const stopByRef = new Map(refs.stops.map((r) => [r.ref, r.stop]));
  const spareByRef = new Map(refs.spares.map((r) => [r.ref, r.spare]));
  return answer.changes.flatMap((c): Change[] => {
    const day = c.day === undefined ? undefined : c.day - 1;
    if (c.action === "remove") {
      const stop = c.stop ? stopByRef.get(c.stop) : undefined;
      return stop ? [{ type: "remove", stopId: stop.id, reason: c.reason }] : [];
    }
    if (day === undefined || day < 0 || day >= plan.days) return [];
    if (c.action === "move") {
      const stop = c.stop ? stopByRef.get(c.stop) : undefined;
      return stop && stop.day !== day
        ? [{ type: "move", stopId: stop.id, toDay: day, reason: c.reason }]
        : [];
    }
    const spare = c.save ? spareByRef.get(c.save) : undefined;
    return spare ? [{ type: "add", sourceKey: spare.sourceKey, toDay: day, reason: c.reason }] : [];
  });
}
