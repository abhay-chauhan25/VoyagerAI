import { distanceKm } from "@/lib/geo";
import type { TravelMode } from "./schemas";
import { chooseMode, estimateLegs, scheduleDay, type HoursCheck, type Point } from "./schedule";

/** A saved place Compose may use, already scored against the traveller's Travel DNA. */
export type Candidate = Point & {
  key: string;
  name: string;
  score: number;
  dwell: number;
  evening: boolean;
  hours: string | null;
};

/** Ordering penalties, in seconds of travel they are worth avoiding. */
const CLOSED_PENALTY = 3 * 60 * 60;
const CLOSES_DURING_PENALTY = 45 * 60;
const EVENING_EARLY_PENALTY = 40 * 60;
/** Every order of up to this many stops is tried; beyond it, nearest-neighbour plus 2-opt. */
const EXHAUSTIVE_LIMIT = 7;
const CLUSTER_ROUNDS = 8;

/** The best places for the trip: highest scores first, at most days × stops-per-day of them. */
export function pickCandidates(
  candidates: readonly Candidate[],
  days: number,
  perDay: number,
): Candidate[] {
  return [...candidates]
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key))
    .slice(0, days * perDay);
}

function km(a: Point, b: Point): number {
  return distanceKm(a.latitude, a.longitude, b.latitude, b.longitude);
}

function centroid(points: readonly Point[]): Point {
  const n = points.length;
  return {
    latitude: points.reduce((sum, p) => sum + p.latitude, 0) / n,
    longitude: points.reduce((sum, p) => sum + p.longitude, 0) / n,
  };
}

/**
 * Splits places into `days` groups of nearby places, each no larger than an even share, so no day
 * is overloaded while another is empty. Deterministic: the same saves give the same plan.
 */
export function clusterIntoDays<T extends Candidate>(points: readonly T[], days: number): T[][] {
  if (days <= 0) return [];
  if (points.length <= days) {
    return Array.from({ length: days }, (_, i) => (points[i] ? [points[i]] : []));
  }
  const capacity = Math.ceil(points.length / days);

  // Seeds: the best place, then repeatedly the place farthest from every seed so far.
  const seeds: Point[] = [points[0]!];
  while (seeds.length < days) {
    let best = points[0]!;
    let bestDistance = -1;
    for (const p of points) {
      const nearest = Math.min(...seeds.map((s) => km(p, s)));
      if (nearest > bestDistance) {
        bestDistance = nearest;
        best = p;
      }
    }
    seeds.push(best);
  }

  let centres = seeds;
  let groups: T[][] = [];
  let previous = "";
  for (let round = 0; round < CLUSTER_ROUNDS; round++) {
    groups = Array.from({ length: days }, () => []);
    // Places with the most to lose from a bad assignment choose first.
    const order = points
      .map((p) => {
        const distances = centres.map((c) => km(p, c)).sort((a, b) => a - b);
        return { p, regret: (distances[1] ?? 0) - distances[0]! };
      })
      .sort((a, b) => b.regret - a.regret || a.p.key.localeCompare(b.p.key));
    for (const { p } of order) {
      const ranked = centres
        .map((c, i) => ({ i, d: km(p, c) }))
        .sort((a, b) => a.d - b.d || a.i - b.i);
      const target = ranked.find(({ i }) => groups[i]!.length < capacity)!;
      groups[target.i]!.push(p);
    }
    const signature = groups.map((g) => g.map((p) => p.key).join(",")).join("|");
    if (signature === previous) break;
    previous = signature;
    centres = groups.map((g, i) => (g.length ? centroid(g) : centres[i]!));
  }
  // The day holding the best place comes first; the rest keep their best place's rank.
  const rank = new Map(points.map((p, i) => [p.key, i]));
  const best = (g: T[]) => Math.min(...g.map((p) => rank.get(p.key) ?? Infinity));
  return groups.sort((a, b) => best(a) - best(b));
}

type DayContext = { startDate: string; dayIndex: number; mode: TravelMode; check: HoursCheck };

/** Travel time of an order plus penalties for visits outside opening hours or evening places too early. */
export function orderCost<T extends Candidate>(order: readonly T[], ctx: DayContext): number {
  const legs = estimateLegs(order, ctx.mode);
  const timed = scheduleDay(
    order.map((s) => ({ dwell: s.dwell, hours: s.hours })),
    legs,
    ctx.startDate,
    ctx.dayIndex,
    ctx.check,
  );
  let cost = legs.reduce((sum, leg) => sum + leg.seconds, 0);
  timed.forEach((t, i) => {
    if (t.state === "closed") cost += CLOSED_PENALTY;
    if (t.state === "closes-during") cost += CLOSES_DURING_PENALTY;
    const laterDaytime = order.slice(i + 1).some((s) => !s.evening);
    if (order[i]!.evening && laterDaytime) cost += EVENING_EARLY_PENALTY;
  });
  return cost;
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [items.slice()];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]),
  );
}

function nearestNeighbour<T extends Candidate>(stops: readonly T[]): T[] {
  const rest = stops.slice(1);
  const route = [stops[0]!];
  while (rest.length) {
    const last = route[route.length - 1]!;
    let index = 0;
    rest.forEach((p, i) => {
      if (km(last, p) < km(last, rest[index]!)) index = i;
    });
    route.push(...rest.splice(index, 1));
  }
  return route;
}

function twoOpt<T extends Candidate>(route: T[]): T[] {
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < route.length - 2; i++) {
      for (let j = i + 2; j < route.length - 1; j++) {
        const before = km(route[i]!, route[i + 1]!) + km(route[j]!, route[j + 1]!);
        const after = km(route[i]!, route[j]!) + km(route[i + 1]!, route[j + 1]!);
        if (after + 1e-9 < before) {
          route.splice(i + 1, j - i, ...route.slice(i + 1, j + 1).reverse());
          improved = true;
        }
      }
    }
  }
  return route;
}

/** The order to visit a day's places: shortest travel that respects opening hours where known. */
export function orderDay<T extends Candidate>(stops: readonly T[], ctx: DayContext): T[] {
  if (stops.length <= 1) return stops.slice();
  if (stops.length <= EXHAUSTIVE_LIMIT) {
    let best = stops.slice();
    let bestCost = orderCost(best, ctx);
    for (const order of permutations(stops)) {
      const cost = orderCost(order, ctx);
      if (cost < bestCost - 1e-6) {
        best = order;
        bestCost = cost;
      }
    }
    return best;
  }
  const route = twoOpt(nearestNeighbour(stops));
  // Evening places still belong at the end of a long day.
  return [...route.filter((s) => !s.evening), ...route.filter((s) => s.evening)];
}

export type PlannedDay<T> = { stops: T[]; mode: TravelMode };

/** The whole plan: pick, group into days, choose each day's travel mode, then order each day. */
export function composePlan<T extends Candidate>(
  candidates: readonly T[],
  options: { days: number; perDay: number; startDate: string; check: HoursCheck },
): PlannedDay<T>[] {
  const picked = pickCandidates(candidates, options.days, options.perDay) as T[];
  return clusterIntoDays(picked, options.days).map((group, dayIndex) => {
    const mode = chooseMode(group);
    return {
      mode,
      stops: orderDay(group, {
        startDate: options.startDate,
        dayIndex,
        mode,
        check: options.check,
      }),
    };
  });
}

/** A day's name when Compass isn't available: its best place and what surrounds it. */
export function ruleDayTitle(stops: readonly Candidate[]): string | null {
  if (stops.length === 0) return null;
  const anchor = [...stops].sort((a, b) => b.score - a.score)[0]!;
  const name = anchor.name.length > 40 ? `${anchor.name.slice(0, 39)}…` : anchor.name;
  return stops.length === 1 ? name : `${name} and around`;
}
