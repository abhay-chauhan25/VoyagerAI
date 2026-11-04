import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadSaves } from "@/lib/drift/context";
import type { ActivityCard } from "@/lib/drift/cards";
import type { InterestWeights } from "@/lib/dna/score";
import { scoreActivity } from "@/lib/drift/rank";
import type { Database } from "@/lib/supabase/database.types";
import type { Plan, PlanSpare, PlanStop } from "./plan";
import {
  routeSchema,
  stopPlaceSchema,
  changesSchema,
  type Change,
  type Route,
  type StopPlace,
  type TravelMode,
} from "./schemas";
import { stopProfile, type PriceLevel } from "./stops";

type Client = SupabaseClient<Database>;
export type Pace = Database["public"]["Enums"]["travel_pace"];
export type Budget = Database["public"]["Enums"]["budget_band"];

export type StoredStop = {
  id: string;
  day: number;
  position: number;
  sourceKey: string;
  place: StopPlace;
  dwell: number;
  priceLevel: PriceLevel;
  costAmount: number | null;
};

export type StoredDay = {
  index: number;
  title: string | null;
  titleSource: "compass" | "rules" | null;
  mode: TravelMode;
  route: Route | null;
};

export type StoredProposal = {
  id: string;
  request: string;
  source: "compass" | "rules";
  summary: string;
  changes: Change[];
  createdAt: string;
};

export type StoredTrip = {
  id: string;
  title: string;
  cityId: number;
  cityName: string;
  countryCode: string;
  startDate: string;
  dayCount: number;
  pace: Pace;
  budget: Budget;
  currency: string;
  updatedAt: string;
  days: StoredDay[];
  stops: StoredStop[];
  proposals: StoredProposal[];
};

export type TripSummary = {
  id: string;
  title: string;
  cityName: string;
  countryCode: string;
  startDate: string;
  dayCount: number;
  stopCount: number;
  cover: StopPlace["photo"];
  updatedAt: string;
};

function asPriceLevel(value: number): PriceLevel {
  return (value >= 0 && value <= 3 ? value : 1) as PriceLevel;
}

/** The traveller's trips, most recently changed first, with a cover photo from their stops. */
export async function loadTrips(supabase: Client, userId: string): Promise<TripSummary[]> {
  const { data, error } = await supabase
    .from("trips")
    .select(
      "id, title, start_date, day_count, updated_at, city:cities(name, country_code), stops:trip_stops(place, day_index, position)",
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Could not load trips (${error.code})`);
  return data.map((row) => {
    const ordered = [...row.stops].sort(
      (a, b) => a.day_index - b.day_index || a.position - b.position,
    );
    const cover =
      ordered.map((s) => stopPlaceSchema.safeParse(s.place)).find((p) => p.success && p.data.photo)
        ?.data?.photo ?? null;
    return {
      id: row.id,
      title: row.title,
      cityName: row.city?.name ?? "",
      countryCode: row.city?.country_code ?? "",
      startDate: row.start_date,
      dayCount: row.day_count,
      stopCount: row.stops.length,
      cover,
      updatedAt: row.updated_at,
    };
  });
}

/** One trip with its days, stops and pending proposals; null if it doesn't exist or isn't theirs. */
export async function loadTrip(
  supabase: Client,
  userId: string,
  tripId: string,
): Promise<StoredTrip | null> {
  const { data, error } = await supabase
    .from("trips")
    .select(
      "id, title, city_id, start_date, day_count, pace, budget, currency, updated_at, city:cities(name, country_code), days:trip_days(day_index, title, title_source, mode, route), stops:trip_stops(id, day_index, position, source_key, place, dwell_minutes, price_level, cost_amount), proposals(id, request, source, summary, changes, status, created_at)",
    )
    .eq("id", tripId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Could not load trip (${error.code})`);
  if (!data) return null;

  let invalid = 0;
  const stops: StoredStop[] = data.stops.flatMap((s) => {
    const place = stopPlaceSchema.safeParse(s.place);
    if (!place.success) {
      invalid += 1;
      return [];
    }
    return [
      {
        id: s.id,
        day: s.day_index,
        position: s.position,
        sourceKey: s.source_key,
        place: place.data,
        dwell: s.dwell_minutes,
        priceLevel: asPriceLevel(s.price_level),
        costAmount: s.cost_amount === null ? null : Number(s.cost_amount),
      },
    ];
  });
  if (invalid > 0) console.error("Trip stops failed validation", { invalid });

  const days: StoredDay[] = data.days
    .map((d) => {
      const route = d.route === null ? null : routeSchema.safeParse(d.route);
      if (route && !route.success) console.error("Stored route failed validation");
      return {
        index: d.day_index,
        title: d.title,
        titleSource: (d.title_source as StoredDay["titleSource"]) ?? null,
        mode: d.mode,
        route: route?.success ? route.data : null,
      };
    })
    .sort((a, b) => a.index - b.index);

  const proposals: StoredProposal[] = data.proposals
    .filter((p) => p.status === "pending")
    .flatMap((p) => {
      const changes = changesSchema.safeParse(p.changes);
      if (!changes.success) {
        console.error("Stored proposal failed validation");
        return [];
      }
      return [
        {
          id: p.id,
          request: p.request,
          source: p.source as StoredProposal["source"],
          summary: p.summary,
          changes: changes.data,
          createdAt: p.created_at,
        },
      ];
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    id: data.id,
    title: data.title,
    cityId: data.city_id,
    cityName: data.city?.name ?? "",
    countryCode: data.city?.country_code ?? "",
    startDate: data.start_date,
    dayCount: data.day_count,
    pace: data.pace,
    budget: data.budget,
    currency: data.currency,
    updatedAt: data.updated_at,
    days,
    stops: stops.sort((a, b) => a.day - b.day || a.position - b.position),
    proposals,
  };
}

/** Saved places (loved or "more like this") in one city, newest first, one per place. */
export async function loadCitySaves(
  supabase: Client,
  userId: string,
  cityId: number,
): Promise<ActivityCard[]> {
  const saves = await loadSaves(supabase, userId);
  const seen = new Set<string>();
  return saves.flatMap(({ verdict, card }) => {
    if (verdict === "pass" || card.kind !== "activity" || card.cityId !== cityId) return [];
    if (seen.has(card.sourceKey)) return [];
    seen.add(card.sourceKey);
    return [card];
  });
}

/** Cities where the traveller has saved places, with how many, for the Compose picker. */
export async function loadComposableCities(
  supabase: Client,
  userId: string,
): Promise<{ cityId: number; cityName: string; count: number }[]> {
  const saves = await loadSaves(supabase, userId);
  const byCity = new Map<number, { cityName: string; keys: Set<string> }>();
  for (const { verdict, card } of saves) {
    if (verdict === "pass" || card.kind !== "activity") continue;
    const entry = byCity.get(card.cityId) ?? { cityName: card.cityName, keys: new Set() };
    entry.keys.add(card.sourceKey);
    byCity.set(card.cityId, entry);
  }
  return [...byCity.entries()]
    .map(([cityId, e]) => ({ cityId, cityName: e.cityName, count: e.keys.size }))
    .sort((a, b) => b.count - a.count || a.cityName.localeCompare(b.cityName));
}

export function placeScore(place: StopPlace, weights: InterestWeights): number {
  return scoreActivity({ ...place, wikidata: null }, weights);
}

/** The trip as the change logic sees it. */
export function toPlan(
  trip: StoredTrip,
  spares: readonly ActivityCard[],
  weights: InterestWeights,
): Plan {
  const stops: PlanStop[] = trip.stops.map((s) => ({
    id: s.id,
    day: s.day,
    position: s.position,
    sourceKey: s.sourceKey,
    name: s.place.name,
    category: s.place.category,
    outdoor: stopProfile(s.place.category).outdoor,
    score: placeScore(s.place, weights),
    latitude: s.place.latitude,
    longitude: s.place.longitude,
  }));
  const inTrip = new Set(trip.stops.map((s) => s.sourceKey));
  const spareList: PlanSpare[] = spares
    .filter((c) => !inTrip.has(c.sourceKey))
    .map((c) => ({
      sourceKey: c.sourceKey,
      name: c.name,
      category: c.category,
      outdoor: stopProfile(c.category).outdoor,
      score: placeScore(c, weights),
      latitude: c.latitude,
      longitude: c.longitude,
    }));
  return { days: trip.dayCount, startDate: trip.startDate, stops, spares: spareList };
}
