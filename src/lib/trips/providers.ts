import "server-only";
import { generateJson, type AiResult } from "@/lib/ai/gemini";
import { storyDraftSchema, storyPrompt, type StoryDraft, type StoryTrip } from "@/lib/notes/story";
import { serverEnv } from "@/lib/server-env";
import type { Plan } from "./plan";
import {
  consensusSummaryPrompt,
  consensusSummarySchema,
  dayTitlesPrompt,
  dayTitlesSchema,
  proposalAnswerSchema,
  proposalPrompt,
  type ConsensusSummary,
  type DayTitles,
  type ProposalAnswer,
} from "./prompts";
import { mapboxRoute } from "./routing";
import { estimateLegs, type Point } from "./schedule";
import type { Route, TravelMode } from "./schemas";

/** Everything trips need from outside services, behind one seam so tests can use fixtures. */
export type TripProviders = {
  dayTitles(
    city: string,
    days: { day: number; places: { name: string; category: string }[] }[],
  ): Promise<AiResult<DayTitles>>;
  proposeChanges(profile: string, plan: Plan, request: string): Promise<AiResult<ProposalAnswer>>;
  route(points: readonly Point[], mode: TravelMode): Promise<Pick<Route, "legs" | "line"> | null>;
  consensusSummary(facts: readonly string[]): Promise<AiResult<ConsensusSummary>>;
  storyDraft(trip: StoryTrip): Promise<AiResult<StoryDraft>>;
};

const realProviders: TripProviders = {
  dayTitles: (city, days) => generateJson(dayTitlesSchema, dayTitlesPrompt(city, days)),
  proposeChanges: (profile, plan, request) =>
    generateJson(proposalAnswerSchema, proposalPrompt(profile, plan, request)),
  route: (points, mode) => mapboxRoute(points, mode, serverEnv().MAPBOX_SERVER_TOKEN),
  consensusSummary: (facts) => generateJson(consensusSummarySchema, consensusSummaryPrompt(facts)),
  storyDraft: (trip) => generateJson(storyDraftSchema, storyPrompt(trip)),
};

/**
 * Deterministic stand-ins for end-to-end tests. Requests containing "simulate outage" make the AI
 * fail so the rule-based fallback is exercised; routes are straight lines with estimated times.
 */
const fixtureProviders: TripProviders = {
  async dayTitles(_city, days) {
    return {
      ok: true,
      model: "fixture",
      data: {
        titles: days
          .filter((d) => d.places.length > 0)
          .map((d) => ({ day: d.day, title: `Around ${d.places[0]!.name}`.slice(0, 40) })),
      },
    };
  },
  async proposeChanges(_profile, plan, request) {
    if (/simulate outage/i.test(request)) return { ok: false, reason: "unavailable" };
    const first = [...plan.stops].sort((a, b) => a.day - b.day || a.position - b.position)[0];
    if (!first || plan.days < 2) {
      return { ok: true, model: "fixture", data: { summary: "Nothing to change.", changes: [] } };
    }
    return {
      ok: true,
      model: "fixture",
      data: {
        summary: "Spreads the first day out.",
        changes: [
          {
            action: "move",
            stop: "s1",
            day: first.day === 0 ? 2 : 1,
            reason: "Gives the first day more breathing room.",
          },
        ],
      },
    };
  },
  async route(points, mode) {
    return {
      legs: estimateLegs(points, mode),
      line: points.map((p) => [p.longitude, p.latitude] as [number, number]),
    };
  },
  async consensusSummary(facts) {
    return {
      ok: true,
      model: "fixture",
      data: { summary: `Balances everyone: ${facts[0] ?? "a shared plan."}`.slice(0, 300) },
    };
  },
  async storyDraft(trip) {
    // A trip titled "simulate outage" makes the AI fail, so the plain template is exercised.
    if (/simulate outage/i.test(trip.title)) return { ok: false, reason: "unavailable" };
    return {
      ok: true,
      model: "fixture",
      data: {
        title: `${trip.cityName}, day by day`,
        body: `My time in ${trip.cityName} started at ${trip.days[0]?.places[0] ?? "the centre"}. This is a draft from Compass for me to rewrite.`,
      },
    };
  },
};

export function tripProviders(): TripProviders {
  return serverEnv().VOYAGER_FIXTURES === "1" ? fixtureProviders : realProviders;
}
