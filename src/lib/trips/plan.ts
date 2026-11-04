import type { Change, Layout } from "./schemas";

/** A stop as the change logic sees it. */
export type PlanStop = {
  id: string;
  day: number;
  position: number;
  sourceKey: string;
  name: string;
  category: string;
  outdoor: boolean;
  score: number;
  latitude: number;
  longitude: number;
};

/** A saved place in the trip's city that isn't in the trip. */
export type PlanSpare = Omit<PlanStop, "id" | "day" | "position">;

export type Plan = { days: number; startDate: string; stops: PlanStop[]; spares: PlanSpare[] };

export type Applied = {
  layout: Layout;
  remove: string[];
  add: { sourceKey: string; day: number; position: number }[];
  /** Days whose stops changed, so they can be re-ordered and re-timed. */
  touchedDays: number[];
  skipped: number;
};

const MAX_PER_DAY = 12;

/**
 * Applies accepted changes to a plan. Changes that no longer fit (a stop already removed, a day
 * that is full, a place already added) are skipped and counted, never forced.
 */
export function applyChanges(plan: Plan, changes: readonly Change[]): Applied {
  const days: string[][] = Array.from({ length: plan.days }, () => []);
  for (const stop of [...plan.stops].sort((a, b) => a.day - b.day || a.position - b.position)) {
    days[stop.day]?.push(stop.id);
  }
  const live = new Set(plan.stops.map((s) => s.id));
  const inTrip = new Set(plan.stops.map((s) => s.sourceKey));
  const spares = new Map(plan.spares.map((s) => [s.sourceKey, s]));
  const remove: string[] = [];
  const addedKeys = new Map<string, number>(); // sourceKey -> day
  const touched = new Set<number>();
  let skipped = 0;

  const dayOf = (id: string) => days.findIndex((d) => d.includes(id));
  const size = (day: number) =>
    days[day]!.length + [...addedKeys.values()].filter((d) => d === day).length;

  for (const change of changes) {
    if (change.type === "remove") {
      const from = dayOf(change.stopId);
      if (!live.has(change.stopId) || from < 0) {
        skipped += 1;
        continue;
      }
      days[from] = days[from]!.filter((id) => id !== change.stopId);
      remove.push(change.stopId);
      touched.add(from);
    } else if (change.type === "move") {
      const from = dayOf(change.stopId);
      if (from < 0 || change.toDay >= plan.days || from === change.toDay) {
        skipped += 1;
        continue;
      }
      if (size(change.toDay) >= MAX_PER_DAY) {
        skipped += 1;
        continue;
      }
      days[from] = days[from]!.filter((id) => id !== change.stopId);
      days[change.toDay]!.push(change.stopId);
      touched.add(from).add(change.toDay);
    } else {
      if (
        change.toDay >= plan.days ||
        !spares.has(change.sourceKey) ||
        inTrip.has(change.sourceKey) ||
        addedKeys.has(change.sourceKey) ||
        size(change.toDay) >= MAX_PER_DAY
      ) {
        skipped += 1;
        continue;
      }
      addedKeys.set(change.sourceKey, change.toDay);
      touched.add(change.toDay);
    }
  }

  const layout: Layout = days.flatMap((ids, day) =>
    ids.map((id, position) => ({ id, day, position })),
  );
  // New stops go after the day's existing stops, in the order they were proposed.
  const next = days.map((ids) => ids.length);
  const add = [...addedKeys.entries()].map(([sourceKey, day]) => ({
    sourceKey,
    day,
    position: next[day]!++,
  }));
  return { layout, remove, add, touchedDays: [...touched].sort((a, b) => a - b), skipped };
}
