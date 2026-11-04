import "server-only";
import { generateJson, type AiResult } from "@/lib/ai/gemini";
import { fetchActivities } from "@/lib/places/overpass";
import { fetchWikipediaNearby } from "@/lib/places/wikipedia-nearby";
import { commonsPhoto, placeSummary, wikidataImage } from "@/lib/places/wikimedia";
import type { Activity, Blurb, Photo } from "@/lib/places/types";
import { serverEnv } from "@/lib/server-env";
import { fixtureProviders } from "./fixtures";
import {
  destinationIdeasSchema,
  destinationsPrompt,
  searchAnswerSchema,
  searchPrompt,
  whyLinesPrompt,
  whyLinesSchema,
  type DestinationIdeas,
  type SearchAnswer,
  type WhyLines,
} from "./prompts";

/** Everything Drift needs from outside services, behind one seam so tests can use fixtures. */
export type Providers = {
  suggestDestinations(
    profile: string,
    exclude: readonly string[],
    count: number,
  ): Promise<AiResult<DestinationIdeas>>;
  answerSearch(profile: string, query: string): Promise<AiResult<SearchAnswer>>;
  writeWhyLines(
    profile: string,
    items: { id: string; name: string; category: string }[],
  ): Promise<AiResult<WhyLines>>;
  activities(
    latitude: number,
    longitude: number,
  ): Promise<{ activities: Activity[]; skipped: number }>;
  nearbyLandmarks(
    latitude: number,
    longitude: number,
  ): Promise<{ activities: Activity[]; skipped: number }>;
  summary(
    titles: readonly string[],
    latitude: number,
    longitude: number,
  ): Promise<{ blurb: Blurb | null; photoFile: string | null }>;
  photo(fileName: string): Promise<Photo | null>;
  wikidataImage(qid: string): Promise<string | null>;
};

const realProviders: Providers = {
  suggestDestinations: (profile, exclude, count) =>
    generateJson(destinationIdeasSchema, destinationsPrompt(profile, exclude, count)),
  answerSearch: (profile, query) => generateJson(searchAnswerSchema, searchPrompt(profile, query)),
  writeWhyLines: (profile, items) => generateJson(whyLinesSchema, whyLinesPrompt(profile, items)),
  activities: fetchActivities,
  nearbyLandmarks: fetchWikipediaNearby,
  summary: placeSummary,
  photo: commonsPhoto,
  wikidataImage,
};

export function providers(): Providers {
  return serverEnv().VOYAGER_FIXTURES === "1" ? fixtureProviders : realProviders;
}
