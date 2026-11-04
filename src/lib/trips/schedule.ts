import { distanceKm } from "@/lib/geo";
import type { TravelMode } from "./schemas";

export type OpenState = "open" | "closed" | "closes-during" | "unknown";
export type HoursCheck = (spec: string | null, arrive: Date, leave: Date) => OpenState;

/** Days start at 09:30 local time; the traveller can see every time is derived from this. */
export const DAY_START_MINUTE = 9 * 60 + 30;

/** Straight lines understate real paths; this factor is a common rule of thumb for city streets. */
const DETOUR = 1.3;
const WALK_METRES_PER_SECOND = 1.3; // about 4.7 km/h
const DRIVE_METRES_PER_SECOND = 7.5; // about 27 km/h in town traffic
const DRIVE_OVERHEAD_SECONDS = 4 * 60; // finding the car, parking
/** Beyond this straight-line hop, a day is planned by car. */
export const WALKING_LIMIT_KM = 2;

export type Point = { latitude: number; longitude: number };
export type Leg = { seconds: number; meters: number };

/** A labelled estimate of one leg, used when real travel times are unavailable. */
export function estimateLeg(a: Point, b: Point, mode: TravelMode): Leg {
  const meters = Math.round(
    distanceKm(a.latitude, a.longitude, b.latitude, b.longitude) * 1000 * DETOUR,
  );
  const seconds =
    mode === "walking"
      ? meters / WALK_METRES_PER_SECOND
      : meters / DRIVE_METRES_PER_SECOND + DRIVE_OVERHEAD_SECONDS;
  return { seconds: Math.round(seconds), meters };
}

export function estimateLegs(points: readonly Point[], mode: TravelMode): Leg[] {
  return points.slice(1).map((point, i) => estimateLeg(points[i]!, point, mode));
}

/** Walk when every hop is short; otherwise drive. The traveller can switch either way. */
export function chooseMode(points: readonly Point[]): TravelMode {
  const longest = Math.max(
    0,
    ...points
      .slice(1)
      .map((p, i) =>
        distanceKm(points[i]!.latitude, points[i]!.longitude, p.latitude, p.longitude),
      ),
  );
  return longest > WALKING_LIMIT_KM ? "driving" : "walking";
}

/** A local wall-clock time on a trip day, as a Date whose local fields hold it. */
export function localTime(startDate: string, dayIndex: number, minute: number): Date {
  const [year, month, day] = startDate.split("-").map(Number) as [number, number, number];
  return new Date(year, month - 1, day + dayIndex, Math.floor(minute / 60), minute % 60);
}

export type Timed = { arrive: number; leave: number; state: OpenState };

/**
 * Times for a day: start at DAY_START_MINUTE, stay `dwell` minutes, travel each leg, and check each
 * visit against the place's opening hours.
 */
export function scheduleDay(
  stops: readonly { dwell: number; hours: string | null }[],
  legs: readonly Leg[],
  startDate: string,
  dayIndex: number,
  check: HoursCheck,
): Timed[] {
  let clock = DAY_START_MINUTE;
  return stops.map((stop, i) => {
    if (i > 0) clock += Math.round((legs[i - 1]?.seconds ?? 0) / 60);
    const arrive = clock;
    const leave = arrive + stop.dwell;
    clock = leave;
    const state = check(
      stop.hours,
      localTime(startDate, dayIndex, arrive),
      localTime(startDate, dayIndex, leave),
    );
    return { arrive, leave, state };
  });
}

export function formatMinute(minute: number): string {
  const wrapped = ((minute % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

export function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}
