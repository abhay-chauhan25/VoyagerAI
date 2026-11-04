import { distanceKm } from "@/lib/geo";
import type { Plan, PlanSpare, PlanStop } from "./plan";
import type { Change } from "./schemas";

/**
 * The non-AI way to ask for changes. It understands a few common requests ("make day 2 slower",
 * "it's raining on Thursday", "add more to day 3", "remove the castle", "move the market to day 1")
 * and proposes the same kind of change list Compass does. Anything else gets an honest "can't".
 */

export type RuleAnswer = { summary: string; changes: Change[] };

const ORDINALS = [
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth",
  "eleventh",
  "twelfth",
  "thirteenth",
  "fourteenth",
];
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const WEEKDAY_SHORT = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const SLOWER =
  /\b(slow(er)?|lighter|relax(ed|ing)?|easier|tired|calm(er)?|fewer|less|too (much|busy|packed|full))\b/;
const RAIN = /\b(rain(s|y|ing)?|wet|storms?|stormy|showers?|bad weather)\b/;
const BUSIER = /\b(busier|fuller|more|pack(ed)? (in|more)|add)\b/;
const REMOVE = /\b(remove|skip|drop|cut|cancel)\b/;
const MOVE = /\bmove\b/;

const HELP =
  "Try 'make day 2 slower', 'it's raining on day 1', 'add more to day 3', 'remove <place>' or 'move <place> to day 2', or drag stops yourself.";

function weekdayOf(startDate: string, dayIndex: number): number {
  const [y, m, d] = startDate.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + dayIndex)).getUTCDay();
}

/** The trip day a request refers to (0-based), or null when it names none or one outside the trip. */
export function findDay(text: string, plan: Pick<Plan, "days" | "startDate">): number | null {
  const lower = text.toLowerCase();
  const numbered = /\bday\s*(\d{1,2})\b/.exec(lower);
  if (numbered) {
    const index = Number(numbered[1]) - 1;
    return index >= 0 && index < plan.days ? index : null;
  }
  if (/\blast day\b/.test(lower)) return plan.days - 1;
  const ordinal = ORDINALS.findIndex((word) => new RegExp(`\\b${word} day\\b`).test(lower));
  if (ordinal >= 0) return ordinal < plan.days ? ordinal : null;
  const weekday = WEEKDAYS.findIndex(
    (name, i) =>
      new RegExp(`\\b${name}\\b`).test(lower) ||
      new RegExp(`\\b${WEEKDAY_SHORT[i]}\\b`).test(lower),
  );
  if (weekday >= 0) {
    for (let i = 0; i < plan.days; i++) if (weekdayOf(plan.startDate, i) === weekday) return i;
    return null;
  }
  return null;
}

/** The stop a request names: the longest stop name that appears in it, or that its words cover. */
export function findStop(text: string, stops: readonly PlanStop[]): PlanStop | null {
  const lower = text.toLowerCase();
  const byName = [...stops]
    .sort((a, b) => b.name.length - a.name.length)
    .find((s) => lower.includes(s.name.toLowerCase()));
  if (byName) return byName;
  const words = new Set(lower.match(/[\p{L}\p{N}]{4,}/gu) ?? []);
  let best: PlanStop | null = null;
  let bestHits = 0;
  for (const stop of stops) {
    const hits = (stop.name.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []).filter((w) =>
      words.has(w),
    ).length;
    if (hits > bestHits) {
      best = stop;
      bestHits = hits;
    }
  }
  return best;
}

const dayLabel = (i: number) => `Day ${i + 1}`;

function onDay(plan: Plan, day: number) {
  return plan.stops.filter((s) => s.day === day);
}

function centre(stops: readonly { latitude: number; longitude: number }[]) {
  return {
    latitude: stops.reduce((s, p) => s + p.latitude, 0) / stops.length,
    longitude: stops.reduce((s, p) => s + p.longitude, 0) / stops.length,
  };
}

/** The other day with the fewest stops; ties go to the one closest to the stop. */
function roomiestOtherDay(plan: Plan, day: number, near: PlanStop): number | null {
  let best: number | null = null;
  let bestKey = [Infinity, Infinity];
  for (let d = 0; d < plan.days; d++) {
    if (d === day) continue;
    const stops = onDay(plan, d);
    const c = stops.length ? centre(stops) : near;
    const key = [stops.length, distanceKm(near.latitude, near.longitude, c.latitude, c.longitude)];
    if (key[0]! < bestKey[0]! || (key[0] === bestKey[0] && key[1]! < bestKey[1]!)) {
      best = d;
      bestKey = key;
    }
  }
  return best;
}

function slower(plan: Plan, requested: number | null): RuleAnswer {
  const day =
    requested ??
    [...Array(plan.days).keys()].sort((a, b) => onDay(plan, b).length - onDay(plan, a).length)[0]!;
  const stops = onDay(plan, day);
  if (stops.length <= 1)
    return { summary: `${dayLabel(day)} is already as light as it gets.`, changes: [] };
  const weakest = [...stops].sort((a, b) => a.score - b.score)[0]!;
  const target = roomiestOtherDay(plan, day, weakest);
  if (target === null) {
    return {
      summary: `Takes one stop off ${dayLabel(day)} to slow it down.`,
      changes: [
        {
          type: "remove",
          stopId: weakest.id,
          reason: "Your weakest match on this day; dropping it frees the most time.",
        },
      ],
    };
  }
  return {
    summary: `Moves one stop from ${dayLabel(day)} to ${dayLabel(target)}, which has more room.`,
    changes: [
      {
        type: "move",
        stopId: weakest.id,
        toDay: target,
        reason: `Your weakest match on ${dayLabel(day)}; ${dayLabel(target)} has room for it.`,
      },
    ],
  };
}

function rainy(plan: Plan, day: number | null): RuleAnswer {
  if (day === null)
    return { summary: "Which day will it rain? Name a day number or a weekday.", changes: [] };
  if (plan.days < 2)
    return { summary: "With a one-day trip there is no drier day to move things to.", changes: [] };
  const outdoor = onDay(plan, day).filter((s) => s.outdoor);
  if (outdoor.length === 0)
    return { summary: `Everything on ${dayLabel(day)} is already indoors.`, changes: [] };
  const indoorElsewhere = plan.stops.filter((s) => s.day !== day && !s.outdoor);
  const changes: Change[] = [];
  for (const stop of outdoor) {
    const swap = indoorElsewhere
      .filter((s) => !changes.some((c) => c.type === "move" && c.stopId === s.id))
      .sort(
        (a, b) =>
          distanceKm(stop.latitude, stop.longitude, a.latitude, a.longitude) -
          distanceKm(stop.latitude, stop.longitude, b.latitude, b.longitude),
      )[0];
    const target = swap?.day ?? roomiestOtherDay(plan, day, stop);
    if (target === null) continue;
    changes.push({
      type: "move",
      stopId: stop.id,
      toDay: target,
      reason: `Outdoors; better on a dry day.`,
    });
    if (swap)
      changes.push({
        type: "move",
        stopId: swap.id,
        toDay: day,
        reason: "Indoors, so it suits the rain.",
      });
  }
  return {
    summary: `Moves ${outdoor.length === 1 ? "an outdoor stop" : "outdoor stops"} off ${dayLabel(day)} and brings indoor ones in.`,
    changes,
  };
}

function busier(plan: Plan, requested: number | null): RuleAnswer {
  if (plan.spares.length === 0)
    return {
      summary: "Every place you saved in this city is already in the trip. Save more in Drift.",
      changes: [],
    };
  const day =
    requested ??
    [...Array(plan.days).keys()].sort((a, b) => onDay(plan, a).length - onDay(plan, b).length)[0]!;
  const stops = onDay(plan, day);
  const c = stops.length ? centre(stops) : centre(plan.spares);
  // Prefer strong matches, but not at the other end of town.
  const value = (s: PlanSpare) =>
    s.score - 0.1 * distanceKm(c.latitude, c.longitude, s.latitude, s.longitude);
  const pick = [...plan.spares].sort((a, b) => value(b) - value(a))[0]!;
  return {
    summary: `Adds one of your saves to ${dayLabel(day)}.`,
    changes: [
      {
        type: "add",
        sourceKey: pick.sourceKey,
        toDay: day,
        reason: `A strong match for you, close to ${dayLabel(day)}'s other stops.`,
      },
    ],
  };
}

export function ruleProposal(request: string, plan: Plan): RuleAnswer {
  const lower = request.toLowerCase();
  const day = findDay(lower, plan);

  if (MOVE.test(lower)) {
    const stop = findStop(lower, plan.stops);
    if (stop && day !== null && stop.day !== day) {
      return {
        summary: `Moves ${stop.name} to ${dayLabel(day)}.`,
        changes: [{ type: "move", stopId: stop.id, toDay: day, reason: "You asked for this." }],
      };
    }
  }
  if (REMOVE.test(lower)) {
    const stop = findStop(lower, plan.stops);
    if (stop) {
      return {
        summary: `Removes ${stop.name} from the trip.`,
        changes: [{ type: "remove", stopId: stop.id, reason: "You asked for this." }],
      };
    }
  }
  if (RAIN.test(lower)) return rainy(plan, day);
  if (SLOWER.test(lower)) return slower(plan, day);
  if (BUSIER.test(lower)) return busier(plan, day);
  return {
    summary: `Without Compass I can only handle a few kinds of request. ${HELP}`,
    changes: [],
  };
}
