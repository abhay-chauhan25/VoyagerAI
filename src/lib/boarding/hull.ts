import type { Vec3 } from "./sections";

/**
 * The fuselage as a function: a tube along the x axis (nose at +x) whose radius narrows at both
 * ends. The nose droops a little and the tail cone sweeps up, as on a real airliner. Everything that
 * sits on the skin (windows, doors, livery, markers) is placed with these, so it follows the shape.
 */
export const HULL = {
  nose: 18.5,
  tail: -19,
  radius: 2,
  /** Where the nose taper and the tail taper begin. */
  noseStart: 11.2,
  tailStart: -6.5,
} as const;

const NOSE_DROOP = 0.38;
const TAIL_SWEEP = 0.78;
const TAIL_TIP_RADIUS = 0.14;

/** Radius of the fuselage at station x, in metres; zero outside the aircraft. */
export function hullRadius(x: number): number {
  if (x > HULL.nose || x < HULL.tail) return 0;
  if (x > HULL.noseStart) {
    const u = (x - HULL.noseStart) / (HULL.nose - HULL.noseStart);
    return HULL.radius * Math.max(0, 1 - u ** 1.85) ** 0.66;
  }
  if (x < HULL.tailStart) {
    const t = (HULL.tailStart - x) / (HULL.tailStart - HULL.tail);
    return HULL.radius * (1 - (1 - TAIL_TIP_RADIUS) * t ** 1.55);
  }
  return HULL.radius;
}

/** Height of the fuselage centre line at station x. */
export function hullCentre(x: number): number {
  const lost = HULL.radius - hullRadius(x);
  if (x > HULL.noseStart) return -lost * NOSE_DROOP;
  if (x < HULL.tailStart) return lost * TAIL_SWEEP;
  return 0;
}

/**
 * A point on (or `offset` metres off) the skin. `angle` runs around the tube: 0 is the right-hand
 * waterline, a negative quarter turn is the roof, a positive quarter turn is the belly.
 */
export function hullPoint(x: number, angle: number, offset = 0): Vec3 {
  const r = hullRadius(x) + offset;
  return [x, hullCentre(x) - r * Math.sin(angle), r * Math.cos(angle)];
}
