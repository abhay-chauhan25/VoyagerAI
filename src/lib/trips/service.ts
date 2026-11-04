import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { consumeAiQuota } from "@/lib/ai/quota";
import { CURRENCY_BY_COUNTRY } from "@/lib/atlas/currencies";
import type { ActivityCard } from "@/lib/drift/cards";
import { mapLimited } from "@/lib/places/http";
import type { InterestWeights } from "@/lib/dna/score";
import type { Database } from "@/lib/supabase/database.types";
import { composePlan, orderDay, ruleDayTitle, type Candidate } from "./compose";
import { visitState } from "./hours";
import { tripProviders } from "./providers";
import { placeScore, type Budget, type Pace, type StoredTrip } from "./queries";
import { estimatedRoute, routeSignature } from "./routing";
import type { Layout, Route, StopPlace, TravelMode } from "./schemas";
import { PACE_PLAN, stopProfile } from "./stops";

type Client = SupabaseClient<Database>;

/** Mapbox is asked about a few days at a time. */
const ROUTE_CONCURRENCY = 3;

export type CandidatePlace = Candidate & { place: StopPlace };

export function toCandidate(
  place: StopPlace,
  weights: InterestWeights,
  dwell?: number,
): CandidatePlace {
  const profile = stopProfile(place.category);
  return {
    key: place.sourceKey,
    name: place.name,
    latitude: place.latitude,
    longitude: place.longitude,
    score: placeScore(place, weights),
    dwell: dwell ?? profile.dwell,
    evening: profile.evening,
    hours: place.openingHours,
    place,
  };
}

/** A day's route: real times from the provider when it answers, otherwise labelled estimates. */
export async function routeFor(
  places: readonly StopPlace[],
  mode: TravelMode,
): Promise<Route | null> {
  if (places.length === 0) return null;
  const keys = places.map((p) => p.sourceKey);
  if (places.length === 1) {
    return {
      signature: routeSignature(keys, mode),
      mode,
      source: "estimate",
      legs: [],
      line: null,
    };
  }
  const real = await tripProviders().route(places, mode);
  if (real) return { signature: routeSignature(keys, mode), mode, source: "mapbox", ...real };
  return estimatedRoute(places, keys, mode);
}

/** Names each day: Compass when it is available and within quota, otherwise from its best place. */
async function titleDays(
  supabase: Client,
  cityName: string,
  days: readonly { stops: Candidate[] }[],
): Promise<{ title: string | null; source: "compass" | "rules" | null }[]> {
  const fallback = days.map((d) => {
    const title = ruleDayTitle(d.stops);
    return { title, source: title ? ("rules" as const) : null };
  });
  if (!days.some((d) => d.stops.length > 0) || !(await consumeAiQuota(supabase))) return fallback;
  const ai = await tripProviders().dayTitles(
    cityName,
    days.map((d, i) => ({
      day: i + 1,
      places: d.stops.map((s) => ({
        name: s.name,
        category: (s as CandidatePlace).place.category,
      })),
    })),
  );
  if (!ai.ok) return fallback;
  const byDay = new Map(ai.data.titles.map((t) => [t.day, t.title]));
  return fallback.map((f, i) => {
    const title = days[i]!.stops.length > 0 ? byDay.get(i + 1) : undefined;
    return title ? { title, source: "compass" } : f;
  });
}

export type ComposeRequest = {
  cityId: number;
  cityName: string;
  countryCode: string;
  title: string;
  startDate: string;
  days: number;
  pace: Pace;
  budget: Budget;
};

/**
 * Builds and stores a trip from the traveller's saves: groups nearby places into days, orders each
 * day around opening hours, fetches travel times, names the days, then writes everything at once.
 */
export async function composeTrip(
  supabase: Client,
  request: ComposeRequest,
  saves: readonly ActivityCard[],
  weights: InterestWeights,
): Promise<string> {
  const candidates = saves.map((card) => toCandidate(card, weights));
  const plan = composePlan(candidates, {
    days: request.days,
    perDay: PACE_PLAN[request.pace].stops,
    startDate: request.startDate,
    check: visitState,
  });
  const [routes, titles] = await Promise.all([
    mapLimited(plan, ROUTE_CONCURRENCY, (day) =>
      routeFor(
        day.stops.map((s) => s.place),
        day.mode,
      ),
    ),
    titleDays(supabase, request.cityName, plan),
  ]);

  const { data, error } = await supabase.rpc("create_trip", {
    p_trip: {
      city_id: request.cityId,
      title: request.title,
      start_date: request.startDate,
      day_count: request.days,
      pace: request.pace,
      budget: request.budget,
      currency: CURRENCY_BY_COUNTRY[request.countryCode] ?? "EUR",
    },
    p_days: plan.map((day, index) => ({
      day_index: index,
      title: titles[index]!.title,
      title_source: titles[index]!.source,
      mode: day.mode,
      route: routes[index],
    })),
    p_stops: plan.flatMap((day, index) =>
      day.stops.map((stop, position) => ({
        day_index: index,
        position,
        source_key: stop.key,
        place: stop.place,
        dwell_minutes: stop.dwell,
        price_level: stopProfile(stop.place.category).price,
      })),
    ),
  });
  if (error || !data) throw new Error(`Could not create trip (${error?.code ?? "no id"})`);
  return data;
}

/** Recomputes routes for days whose order or travel mode changed since their route was stored. */
export async function syncRoutes(supabase: Client, trip: StoredTrip): Promise<void> {
  const stale = trip.days.filter((day) => {
    const keys = trip.stops.filter((s) => s.day === day.index).map((s) => s.sourceKey);
    const wanted = keys.length ? routeSignature(keys, day.mode) : null;
    return (day.route?.signature ?? null) !== wanted;
  });
  await mapLimited(stale, ROUTE_CONCURRENCY, async (day) => {
    const places = trip.stops.filter((s) => s.day === day.index).map((s) => s.place);
    const route = await routeFor(places, day.mode);
    const { error } = await supabase
      .from("trip_days")
      .update({ route })
      .eq("trip_id", trip.id)
      .eq("day_index", day.index);
    if (error) throw new Error(`Could not store route (${error.code})`);
  });
}

export type Placed = { id: string; day: number; position: number; place: StopPlace; dwell: number };

/**
 * Final positions for every stop of a trip. Days listed in `optimise` get the best visiting order
 * (shortest travel, opening hours respected); every other day keeps the traveller's order.
 */
export function arrangeStops(
  entries: readonly Placed[],
  optimise: readonly number[],
  trip: { startDate: string; dayCount: number; modes: readonly TravelMode[] },
  weights: InterestWeights,
): Layout {
  const layout: Layout = [];
  for (let day = 0; day < trip.dayCount; day++) {
    const members = entries.filter((e) => e.day === day).sort((a, b) => a.position - b.position);
    const ids =
      optimise.includes(day) && members.length > 1
        ? orderDay(
            members.map((m) => ({ ...toCandidate(m.place, weights, m.dwell), id: m.id })),
            {
              startDate: trip.startDate,
              dayIndex: day,
              mode: trip.modes[day] ?? "walking",
              check: visitState,
            },
          ).map((c) => c.id)
        : members.map((m) => m.id);
    ids.forEach((id, position) => layout.push({ id, day, position }));
  }
  return layout;
}
