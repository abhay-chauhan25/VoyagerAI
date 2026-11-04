import "server-only";
import type { Activity } from "@/lib/places/types";
import type { Providers } from "./providers";

/**
 * Deterministic stand-ins for Gemini, OpenStreetMap and Wikimedia, used when VOYAGER_FIXTURES=1
 * (end-to-end tests). Place names are synthetic; city names are real so grounding is exercised.
 * "Narnia" is deliberately fictional and must be dropped by grounding. A request containing
 * "simulate outage" makes the AI fail so fallbacks can be tested.
 */
const FIXTURE_ACTIVITIES: Omit<
  Activity,
  "sourceKey" | "latitude" | "longitude" | "dataSource" | "sourceUrl"
>[] = [
  {
    name: "Example Central Market",
    category: "Market",
    interests: ["Markets", "Food"],
    openingHours: "Mo-Sa 07:00-14:00",
    wikidata: "Q1",
    website: null,
  },
  {
    name: "Example City Museum",
    category: "Museum",
    interests: ["Museums", "History"],
    openingHours: "Tu-Su 10:00-18:00",
    wikidata: null,
    website: null,
  },
  {
    name: "Example Hill Viewpoint",
    category: "Viewpoint",
    interests: ["Viewpoints"],
    openingHours: null,
    wikidata: null,
    website: null,
  },
  {
    name: "Example Corner Café",
    category: "Café",
    interests: ["Coffee"],
    openingHours: "08:00-18:00",
    wikidata: null,
    website: null,
  },
  {
    name: "Example Riverside Park",
    category: "Park",
    interests: ["Nature"],
    openingHours: null,
    wikidata: null,
    website: null,
  },
  {
    name: "Example Jazz Cellar",
    category: "Music venue",
    interests: ["Music", "Nightlife"],
    openingHours: "Th-Sa 21:00-02:00",
    wikidata: null,
    website: null,
  },
  {
    name: "Example Old Fort",
    category: "Castle",
    interests: ["History", "Architecture"],
    openingHours: null,
    wikidata: null,
    website: null,
  },
  {
    name: "Example Street Kitchen",
    category: "Restaurant",
    interests: ["Food"],
    openingHours: "12:00-23:00",
    wikidata: null,
    website: null,
  },
];

const ideas = [
  {
    name: "Lisbon",
    countryCode: "PT",
    why: "Steep lanes, tiled facades and long lunches suit your slow, food-first way of travelling.",
    interests: ["Food", "Viewpoints"] as const,
  },
  {
    name: "Kyoto",
    countryCode: "JP",
    why: "Quiet temples and tiny markets reward the kind of unhurried wandering you enjoy.",
    interests: ["History", "Markets"] as const,
  },
  {
    name: "Narnia",
    countryCode: "XX",
    why: "This place is not real and must never be shown.",
    interests: ["Nature"] as const,
  },
  {
    name: "Mexico City",
    countryCode: "MX",
    why: "Street food at every corner and museums enough for a week.",
    interests: ["Food", "Museums"] as const,
  },
  {
    name: "Marrakesh",
    countryCode: "MA",
    why: "Souks to get lost in and rooftop views at dusk.",
    interests: ["Markets", "Viewpoints"] as const,
  },
];

export const fixtureProviders: Providers = {
  async suggestDestinations() {
    return {
      ok: true,
      model: "fixture",
      data: { destinations: ideas.map((i) => ({ ...i, interests: [...i.interests] })) },
    };
  },
  async answerSearch(_profile, query) {
    if (/simulate outage/i.test(query)) return { ok: false, reason: "unavailable" };
    return {
      ok: true,
      model: "fixture",
      data: {
        summary: "Warm cities with great food in spring.",
        destinations: [ideas[0], ideas[3], ideas[2]].map((i) => ({
          ...i!,
          interests: [...i!.interests],
        })),
      },
    };
  },
  async writeWhyLines(_profile, items) {
    return {
      ok: true,
      model: "fixture",
      data: {
        lines: items
          .slice(0, 3)
          .map((item) => ({ id: item.id, why: `Compass thinks you'll like ${item.name}.` })),
      },
    };
  },
  async activities(latitude, longitude) {
    return {
      skipped: 0,
      activities: FIXTURE_ACTIVITIES.map((a, index) => ({
        ...a,
        sourceKey: `osm:node/${9_000_000_001 + index}`,
        dataSource: "OpenStreetMap" as const,
        sourceUrl: `https://www.openstreetmap.org/node/${9_000_000_001 + index}`,
        latitude: latitude + (index - 4) * 0.002,
        longitude: longitude + (index % 3) * 0.002,
      })),
    };
  },
  async nearbyLandmarks() {
    return { activities: [], skipped: 0 };
  },
  async summary() {
    return {
      blurb: {
        text: "A fixture description used in tests.",
        source: "Wikivoyage",
        page: "https://en.wikivoyage.org/wiki/Main_Page",
      },
      photoFile: null,
    };
  },
  async photo() {
    return null;
  },
  async wikidataImage() {
    return null;
  },
};
