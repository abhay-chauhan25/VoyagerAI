import "server-only";
import type { ActivityCard } from "@/lib/drift/cards";
import { visitState } from "./hours";
import type { StoredTrip } from "./queries";
import { routeSignature } from "./routing";
import { estimateLegs, scheduleDay, type OpenState } from "./schedule";
import type { Change, TravelMode } from "./schemas";
import { BUDGET_PLAN, PACE_PLAN, stopProfile, type PriceLevel } from "./stops";

/** Everything the Trip Canvas shows, computed on the server and passed to the client as plain data. */
export type StopView = {
  id: string;
  sourceKey: string;
  name: string;
  category: string;
  interests: ActivityCard["interests"];
  latitude: number;
  longitude: number;
  photo: ActivityCard["photo"];
  dataSource: ActivityCard["dataSource"];
  sourceUrl: string;
  openingHours: string | null;
  outdoor: boolean;
  dwell: number;
  priceLevel: PriceLevel;
  costAmount: number | null;
  arrive: number;
  leave: number;
  state: OpenState;
  /** Travel from this stop to the next one, if any. */
  next: { seconds: number; meters: number } | null;
};

export type DayView = {
  index: number;
  date: string;
  title: string | null;
  titleSource: "compass" | "rules" | null;
  mode: TravelMode;
  /** Real (Mapbox) times, or straight-line estimates when Mapbox wasn't available or is catching up. */
  timesSource: "mapbox" | "estimate";
  line: [number, number][] | null;
  stops: StopView[];
  busyMinutes: number;
  travelMinutes: number;
  paceLimit: number;
  pricePoints: number;
  budgetPoints: number;
  amount: number | null;
};

export type ProposalView = {
  id: string;
  request: string;
  source: "compass" | "rules";
  summary: string;
  createdAt: string;
  changes: (Change & { label: string })[];
};

export type SpareView = {
  sourceKey: string;
  name: string;
  category: string;
  photo: ActivityCard["photo"];
};

export type TripView = {
  id: string;
  title: string;
  cityId: number;
  cityName: string;
  countryCode: string;
  startDate: string;
  dayCount: number;
  pace: StoredTrip["pace"];
  budget: StoredTrip["budget"];
  currency: string;
  days: DayView[];
  spares: SpareView[];
  proposals: ProposalView[];
};

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function describeChange(change: Change, trip: StoredTrip, spares: readonly ActivityCard[]): string {
  const name = (id: string) => trip.stops.find((s) => s.id === id)?.place.name ?? "A stop";
  if (change.type === "move") return `Move ${name(change.stopId)} to Day ${change.toDay + 1}`;
  if (change.type === "remove") return `Remove ${name(change.stopId)}`;
  const spare = spares.find((s) => s.sourceKey === change.sourceKey);
  return `Add ${spare?.name ?? "a saved place"} to Day ${change.toDay + 1}`;
}

export function buildTripView(trip: StoredTrip, saves: readonly ActivityCard[]): TripView {
  const pace = PACE_PLAN[trip.pace];
  const budget = BUDGET_PLAN[trip.budget];

  const days: DayView[] = Array.from({ length: trip.dayCount }, (_, index) => {
    const stored = trip.days.find((d) => d.index === index);
    const mode = stored?.mode ?? "walking";
    const stops = trip.stops.filter((s) => s.day === index);
    const places = stops.map((s) => s.place);
    // A stored route only counts if it was computed for this exact order and mode.
    const fresh =
      stored?.route &&
      stored.route.signature ===
        routeSignature(
          places.map((p) => p.sourceKey),
          mode,
        )
        ? stored.route
        : null;
    const legs = fresh?.legs ?? estimateLegs(places, mode);
    const timed = scheduleDay(
      stops.map((s) => ({ dwell: s.dwell, hours: s.place.openingHours })),
      legs,
      trip.startDate,
      index,
      visitState,
    );
    const travelSeconds = legs.reduce((sum, leg) => sum + leg.seconds, 0);
    const amounts = stops.map((s) => s.costAmount).filter((a): a is number => a !== null);
    return {
      index,
      date: addDays(trip.startDate, index),
      title: stored?.title ?? null,
      titleSource: stored?.titleSource ?? null,
      mode,
      timesSource: fresh?.source === "mapbox" ? "mapbox" : "estimate",
      line: fresh?.line ?? null,
      stops: stops.map((s, i) => ({
        id: s.id,
        sourceKey: s.sourceKey,
        name: s.place.name,
        category: s.place.category,
        interests: s.place.interests,
        latitude: s.place.latitude,
        longitude: s.place.longitude,
        photo: s.place.photo,
        dataSource: s.place.dataSource,
        sourceUrl: s.place.sourceUrl,
        openingHours: s.place.openingHours,
        outdoor: stopProfile(s.place.category).outdoor,
        dwell: s.dwell,
        priceLevel: s.priceLevel,
        costAmount: s.costAmount,
        arrive: timed[i]!.arrive,
        leave: timed[i]!.leave,
        state: timed[i]!.state,
        next: legs[i] ?? null,
      })),
      busyMinutes: stops.reduce((sum, s) => sum + s.dwell, 0) + Math.round(travelSeconds / 60),
      travelMinutes: Math.round(travelSeconds / 60),
      paceLimit: pace.busyMinutes,
      pricePoints: stops.reduce((sum, s) => sum + s.priceLevel, 0),
      budgetPoints: budget.points,
      amount: amounts.length ? Math.round(amounts.reduce((a, b) => a + b, 0) * 100) / 100 : null,
    };
  });

  const inTrip = new Set(trip.stops.map((s) => s.sourceKey));
  return {
    id: trip.id,
    title: trip.title,
    cityId: trip.cityId,
    cityName: trip.cityName,
    countryCode: trip.countryCode,
    startDate: trip.startDate,
    dayCount: trip.dayCount,
    pace: trip.pace,
    budget: trip.budget,
    currency: trip.currency,
    days,
    spares: saves
      .filter((s) => !inTrip.has(s.sourceKey))
      .map((s) => ({ sourceKey: s.sourceKey, name: s.name, category: s.category, photo: s.photo })),
    proposals: trip.proposals.map((p) => ({
      id: p.id,
      request: p.request,
      source: p.source,
      summary: p.summary,
      createdAt: p.createdAt,
      changes: p.changes.map((c) => ({ ...c, label: describeChange(c, trip, saves) })),
    })),
  };
}
