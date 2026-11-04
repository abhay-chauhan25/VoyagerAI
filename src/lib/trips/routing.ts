import "server-only";
import { z } from "zod";
import { fetchJson, UpstreamError } from "@/lib/places/http";
import type { Route, TravelMode } from "./schemas";
import { estimateLegs, type Point } from "./schedule";

const DIRECTIONS_URL = "https://api.mapbox.com/directions/v5/mapbox";
const TIMEOUT_MS = 8_000;
/** Mapbox Directions accepts up to 25 waypoints per request. */
const MAX_WAYPOINTS = 25;

const directionsSchema = z.object({
  code: z.literal("Ok"),
  routes: z
    .array(
      z.object({
        legs: z.array(z.object({ duration: z.number().min(0), distance: z.number().min(0) })),
        geometry: z.object({
          coordinates: z.array(z.tuple([z.number(), z.number()]).rest(z.number())),
        }),
      }),
    )
    .min(1),
});

/** The order and mode a route was computed for; a different signature means it is stale. */
export function routeSignature(keys: readonly string[], mode: TravelMode): string {
  return `${mode}:${keys.join(",")}`;
}

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

/** Turns a Directions answer into Voyager's route; null when it does not match the stops asked for. */
export function parseDirections(
  json: unknown,
  stopCount: number,
): Pick<Route, "legs" | "line"> | null {
  const parsed = directionsSchema.safeParse(json);
  if (!parsed.success) return null;
  const route = parsed.data.routes[0]!;
  if (route.legs.length !== stopCount - 1) return null;
  return {
    legs: route.legs.map((leg) => ({
      seconds: Math.round(leg.duration),
      meters: Math.round(leg.distance),
    })),
    line: route.geometry.coordinates.slice(0, 6000).map(([lng, lat]) => [round5(lng), round5(lat)]),
  };
}

/**
 * Real travel times and the street path between a day's stops from Mapbox Directions. Returns null
 * when there is no token or Mapbox can't answer; callers then use labelled straight-line estimates.
 */
export async function mapboxRoute(
  points: readonly Point[],
  mode: TravelMode,
  token: string | undefined,
): Promise<Pick<Route, "legs" | "line"> | null> {
  if (!token || points.length < 2 || points.length > MAX_WAYPOINTS) return null;
  const coords = points.map((p) => `${round5(p.longitude)},${round5(p.latitude)}`).join(";");
  const params = new URLSearchParams({
    geometries: "geojson",
    overview: "full",
    steps: "false",
    access_token: token,
  });
  try {
    const json = await fetchJson(
      "mapbox-directions",
      `${DIRECTIONS_URL}/${mode}/${coords}?${params}`,
      {
        timeoutMs: TIMEOUT_MS,
      },
    );
    const route = parseDirections(json, points.length);
    if (!route) console.error("Mapbox Directions answer did not match the request");
    return route;
  } catch (error) {
    // Only the status is logged: the request URL carries the token.
    if (error instanceof UpstreamError)
      console.error("Mapbox Directions failed", { status: error.status });
    else throw error;
    return null;
  }
}

/** Straight-line estimates for a day, labelled as such. */
export function estimatedRoute(
  points: readonly Point[],
  keys: readonly string[],
  mode: TravelMode,
): Route {
  return {
    signature: routeSignature(keys, mode),
    mode,
    source: "estimate",
    legs: estimateLegs(points, mode),
    line: null,
  };
}
