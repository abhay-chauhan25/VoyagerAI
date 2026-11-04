import "server-only";
import OpeningHours from "opening_hours";
import type { OpenState } from "./schedule";

/** Parsed specs, reused across a request: the same few places are checked many times while ordering. */
const parsed = new Map<string, OpeningHours | null>();
const MAX_CACHED = 500;

function parse(spec: string): OpeningHours | null {
  if (parsed.has(spec)) return parsed.get(spec) ?? null;
  let value: OpeningHours | null;
  try {
    // mode 0: opening times only. No address is passed, so public-holiday rules are evaluated as
    // ordinary days; that is a known simplification, and the UI says hours are from OpenStreetMap.
    value = new OpeningHours(spec, null, 0);
  } catch {
    value = null; // Not valid OpenStreetMap syntax: treated as unknown, never as closed.
  }
  if (parsed.size >= MAX_CACHED) parsed.clear();
  parsed.set(spec, value);
  return value;
}

/**
 * Whether a place is open for a whole visit. Times are local wall-clock times at the destination,
 * passed as Dates whose local fields hold them (the library reads local fields).
 */
export function visitState(spec: string | null, arrive: Date, leave: Date): OpenState {
  if (!spec) return "unknown";
  const hours = parse(spec);
  if (!hours) return "unknown";
  try {
    if (hours.getUnknown(arrive)) return "unknown";
    if (!hours.getState(arrive)) return "closed";
    const lastMinute = new Date(leave.getTime() - 60_000);
    return hours.getState(lastMinute) ? "open" : "closes-during";
  } catch {
    return "unknown";
  }
}
