import { distanceKm } from "@/lib/geo";
import type { InterestWeights } from "@/lib/dna/score";
import type { Interest } from "@/lib/interests";
import { isInterest } from "@/lib/interests";
import { composePlan, orderDay, type Candidate } from "@/lib/trips/compose";
import type { HoursCheck } from "@/lib/trips/schedule";
import { MAX_CHANGES, type Change } from "@/lib/trips/schemas";
import { PACE_PLAN } from "@/lib/trips/stops";

/**
 * Group logic for shared trips. Members share only their top three interests and pace, so that is
 * all this works from: a member's top interest counts 1, the second 0.8, the third 0.6.
 */

export type Pace = keyof typeof PACE_PLAN;
export type Member = { id: string; name: string; pace: Pace | null; top: Interest[] };

const RANK_WEIGHTS = [1, 0.8, 0.6] as const;
/** A place counts as one of a member's picks when it matches one of their top interests this well. */
export const PICK_THRESHOLD = 0.6;
/** How much the group's Group Drift loves lift a place, at most (everyone loved it). */
const LOVE_BONUS = 0.3;
const PACE_ORDER: Pace[] = ["slow", "balanced", "full"];

export function toMember(row: {
  user_id: string;
  display_name: string;
  pace: Pace | null;
  top_interests: string[];
}): Member {
  return {
    id: row.user_id,
    name: row.display_name,
    pace: row.pace,
    top: row.top_interests.filter(isInterest).slice(0, 3),
  };
}

/** How well a place fits one member: their best-ranked top interest the place offers. */
export function memberScore(interests: readonly Interest[], member: Member): number {
  let best = 0;
  member.top.forEach((interest, rank) => {
    if (interests.includes(interest)) best = Math.max(best, RANK_WEIGHTS[rank] ?? 0);
  });
  return best;
}

/** Everyone's top interests blended into one set of weights (for ranking a shared deck). */
export function groupWeights(members: readonly Member[]): InterestWeights {
  const weights: InterestWeights = {};
  if (members.length === 0) return weights;
  for (const member of members) {
    member.top.forEach((interest, rank) => {
      weights[interest] = (weights[interest] ?? 0) + (RANK_WEIGHTS[rank] ?? 0) / members.length;
    });
  }
  return weights;
}

/** The slowest pace in the group: a plan everyone can keep up with. */
export function groupPace(members: readonly Member[]): Pace {
  const paces = members.map((m) => m.pace).filter((p): p is Pace => p !== null);
  if (paces.length === 0) return "balanced";
  return PACE_ORDER.find((p) => paces.includes(p)) ?? "balanced";
}

/** "Ana", "Ana and Ben", "Ana, Ben and Kai". */
export function nameList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** Why a shared card suits the group, from the members it matches. Our own facts, never invented. */
export function groupWhy(interests: readonly Interest[], members: readonly Member[]): string {
  const fans = members.filter((m) => memberScore(interests, m) >= PICK_THRESHOLD);
  if (fans.length === 0) return "Something different for the group.";
  const shared = interests.filter((i) => fans.some((m) => m.top.includes(i)));
  const what = shared.length ? shared.slice(0, 2).join(" and ") : "this";
  if (fans.length === members.length && members.length > 1) return `Everyone here loves ${what}.`;
  return `${nameList(fans.map((m) => m.name))} ${fans.length === 1 ? "loves" : "love"} ${what}.`;
}

export type Swipe = { userId: string; sourceKey: string; verdict: "pass" | "love" | "more" };

/**
 * Matches: places everyone who swiped them loved (or wanted more of), with at least two such
 * members. One pass from anyone and it is not a match.
 */
export function findMatches(swipes: readonly Swipe[]): { sourceKey: string; fans: string[] }[] {
  const byPlace = new Map<string, { fans: string[]; passed: boolean }>();
  for (const swipe of swipes) {
    const entry = byPlace.get(swipe.sourceKey) ?? { fans: [], passed: false };
    if (swipe.verdict === "pass") entry.passed = true;
    else entry.fans.push(swipe.userId);
    byPlace.set(swipe.sourceKey, entry);
  }
  return [...byPlace.entries()]
    .filter(([, e]) => !e.passed && e.fans.length >= 2)
    .map(([sourceKey, e]) => ({ sourceKey, fans: e.fans }))
    .sort((a, b) => b.fans.length - a.fans.length || a.sourceKey.localeCompare(b.sourceKey));
}

/* ---------- Consensus ---------- */

export type PoolPlace = Candidate & { interests: Interest[]; lovedBy: number };

export type ConsensusPlan = {
  days: string[][];
  pace: Pace;
  /** One line per member: their picks, and any day without one. */
  notes: string[];
  /** Plain facts behind the plan, for the summary. */
  facts: string[];
};

function centre(points: readonly { latitude: number; longitude: number }[]) {
  return {
    latitude: points.reduce((s, p) => s + p.latitude, 0) / points.length,
    longitude: points.reduce((s, p) => s + p.longitude, 0) / points.length,
  };
}

/**
 * A plan that balances everyone. Places are ranked by the group's average fit plus their Group
 * Drift loves and composed at the slowest member's pace; then every member is given at least one
 * of their own picks each day where the pool allows, by swapping out the stop the group needs least.
 */
export function consensusPlan(
  members: readonly Member[],
  pool: readonly PoolPlace[],
  options: { days: number; startDate: string; check: HoursCheck },
): ConsensusPlan {
  const n = Math.max(1, members.length);
  const scored = pool.map((p) => ({
    ...p,
    score:
      members.reduce((sum, m) => sum + memberScore(p.interests, m), 0) / n +
      (LOVE_BONUS * Math.min(p.lovedBy, n)) / n,
  }));
  const byKey = new Map(scored.map((p) => [p.key, p]));
  const pace = groupPace(members);
  const planned = composePlan(scored, {
    days: options.days,
    perDay: PACE_PLAN[pace].stops,
    startDate: options.startDate,
    check: options.check,
  });
  const days = planned.map((d) => d.stops.map((s) => s.key));
  const used = () => new Set(days.flat());
  const gaps: Map<string, number[]> = new Map(members.map((m) => [m.id, []]));

  for (let day = 0; day < days.length; day++) {
    for (const member of members) {
      const picks = (keys: string[]) =>
        keys.filter((k) => memberScore(byKey.get(k)!.interests, member) >= PICK_THRESHOLD);
      if (days[day]!.length === 0 || picks(days[day]!).length > 0) continue;
      const here = centre(days[day]!.map((k) => byKey.get(k)!));
      const taken = used();
      const candidate = scored
        .filter((p) => !taken.has(p.key) && memberScore(p.interests, member) >= PICK_THRESHOLD)
        .sort(
          (a, b) =>
            memberScore(b.interests, member) -
            0.1 * distanceKm(here.latitude, here.longitude, b.latitude, b.longitude) -
            (memberScore(a.interests, member) -
              0.1 * distanceKm(here.latitude, here.longitude, a.latitude, a.longitude)),
        )[0];
      // Swap out the stop the group needs least, unless it is someone else's only pick that day.
      const protectedKeys = new Set(
        members
          .filter((other) => other.id !== member.id)
          .flatMap((other) => {
            const theirs = days[day]!.filter(
              (k) => memberScore(byKey.get(k)!.interests, other) >= PICK_THRESHOLD,
            );
            return theirs.length === 1 ? theirs : [];
          }),
      );
      const out = [...days[day]!]
        .filter((k) => !protectedKeys.has(k))
        .sort((a, b) => byKey.get(a)!.score - byKey.get(b)!.score)[0];
      if (!candidate || !out) {
        gaps.get(member.id)!.push(day);
        continue;
      }
      days[day] = days[day]!.map((k) => (k === out ? candidate.key : k));
    }
    // Re-order the day after any swaps.
    const stops = days[day]!.map((k) => byKey.get(k)!);
    days[day] = orderDay(stops, {
      startDate: options.startDate,
      dayIndex: day,
      mode: planned[day]?.mode ?? "walking",
      check: options.check,
    }).map((s) => s.key);
  }

  const notes = members.map((member) => {
    const count = days
      .flat()
      .filter((k) => memberScore(byKey.get(k)!.interests, member) >= PICK_THRESHOLD).length;
    const missing = gaps.get(member.id)!;
    const interests = member.top.length ? member.top.join(", ") : "no Travel DNA yet";
    return missing.length
      ? `${member.name} (${interests}): ${count} ${count === 1 ? "pick" : "picks"}; none fit on day ${missing.map((d) => d + 1).join(" and ")}.`
      : `${member.name} (${interests}): ${count} ${count === 1 ? "pick" : "picks"}, at least one every day.`;
  });
  const slowest = members.filter((m) => m.pace === pace).map((m) => m.name);
  const facts = [
    `Paced for ${slowest.length ? nameList(slowest) : "the group"}: ${PACE_PLAN[pace].stops} stops a day.`,
    ...notes,
  ];
  return { days, pace, notes, facts };
}

/** The changes that turn the current trip into a new plan, as a proposal the group can vote on. */
export function planChanges(
  current: readonly { id: string; sourceKey: string; day: number }[],
  target: readonly string[][],
  reasonFor: (sourceKey: string, kind: Change["type"]) => string,
): Change[] {
  const want = new Map<string, number>();
  target.forEach((keys, day) => keys.forEach((k) => want.set(k, day)));
  const have = new Set(current.map((s) => s.sourceKey));
  const changes: Change[] = [];
  for (const stop of current) {
    const day = want.get(stop.sourceKey);
    if (day === undefined)
      changes.push({
        type: "remove",
        stopId: stop.id,
        reason: reasonFor(stop.sourceKey, "remove"),
      });
    else if (day !== stop.day)
      changes.push({
        type: "move",
        stopId: stop.id,
        toDay: day,
        reason: reasonFor(stop.sourceKey, "move"),
      });
  }
  for (const [sourceKey, day] of want) {
    if (!have.has(sourceKey))
      changes.push({ type: "add", sourceKey, toDay: day, reason: reasonFor(sourceKey, "add") });
  }
  return changes.slice(0, MAX_CHANGES);
}
