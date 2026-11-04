export type LngLat = [longitude: number, latitude: number];

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/**
 * The point on the globe "between" a set of places: the average of their 3D unit vectors projected
 * back onto the sphere. Unlike averaging longitudes it handles the antimeridian (Fiji and Samoa
 * average to the Pacific, not Africa). Returns null for no points or perfectly opposed points.
 */
export function sphericalCentroid(points: readonly LngLat[]): LngLat | null {
  if (points.length === 0) return null;
  let x = 0;
  let y = 0;
  let z = 0;
  for (const [lng, lat] of points) {
    const phi = toRad(lat);
    const lambda = toRad(lng);
    x += Math.cos(phi) * Math.cos(lambda);
    y += Math.cos(phi) * Math.sin(lambda);
    z += Math.sin(phi);
  }
  const length = Math.hypot(x, y, z);
  if (length < 1e-9) return null;
  return [toDeg(Math.atan2(y, x)), toDeg(Math.asin(z / length))];
}

/** Largest great-circle distance (degrees) from the centroid to any point: how spread out they are. */
export function angularSpread(points: readonly LngLat[], centre: LngLat): number {
  const [cLng, cLat] = centre.map(toRad) as [number, number];
  let widest = 0;
  for (const [lng, lat] of points) {
    const cos =
      Math.sin(cLat) * Math.sin(toRad(lat)) +
      Math.cos(cLat) * Math.cos(toRad(lat)) * Math.cos(toRad(lng) - cLng);
    widest = Math.max(widest, toDeg(Math.acos(Math.min(1, Math.max(-1, cos)))));
  }
  return widest;
}

/** Above this spread a whole-globe view reads better than zooming to fit. */
export const WIDE_SPREAD_DEGREES = 40;
