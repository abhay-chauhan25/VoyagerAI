import type { Pose, Vec3 } from "./sections";

/** The width that has to fit in view for the whole plane to be seen from any side, in metres. */
export const PLANE_SPAN = 43;
export const FIELD_OF_VIEW = 30;

/** The lowest and highest the camera may orbit: never under the cloud deck, never straight down. */
export const MIN_ELEVATION = -0.12;
export const MAX_ELEVATION = 0.95;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * How far back the camera must sit for `span` metres to fit the view's narrower side. A phone held
 * upright sees a thin slice, so the camera backs away; a wide desktop window lets it come closer.
 */
export function fitDistance(aspect: number, span = PLANE_SPAN, fov = FIELD_OF_VIEW): number {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const halfVertical = Math.tan((fov * Math.PI) / 360);
  const halfHorizontal = halfVertical * safeAspect;
  return span / 2 / Math.min(halfHorizontal, halfVertical * 1.9);
}

/** Where the camera is for a pose, given the distance that fits the plane. */
export function posePosition(pose: Pose, fit: number): Vec3 {
  const distance = pose.zoom * fit;
  const flat = Math.cos(pose.elevation) * distance;
  return [
    pose.target[0] + flat * Math.cos(pose.azimuth),
    pose.target[1] + Math.sin(pose.elevation) * distance,
    pose.target[2] + flat * Math.sin(pose.azimuth),
  ];
}

/** Ease-in-out, for movement that starts and ends on screen. */
export function easeInOut(t: number): number {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** The shorter way round from one angle to another. */
export function angleDelta(from: number, to: number): number {
  const turn = Math.PI * 2;
  return ((((to - from) % turn) + turn + Math.PI) % turn) - Math.PI;
}

export function mixPose(a: Pose, b: Pose, t: number): Pose {
  return {
    azimuth: a.azimuth + angleDelta(a.azimuth, b.azimuth) * t,
    elevation: mix(a.elevation, b.elevation, t),
    zoom: mix(a.zoom, b.zoom, t),
    target: [
      mix(a.target[0], b.target[0], t),
      mix(a.target[1], b.target[1], t),
      mix(a.target[2], b.target[2], t),
    ],
  };
}

/**
 * How much of the remaining distance to cover this frame so that movement feels the same at any
 * frame rate. `rate` is how quickly it settles (higher is snappier).
 */
export function damping(rate: number, deltaSeconds: number): number {
  return 1 - Math.exp(-rate * Math.max(0, deltaSeconds));
}
