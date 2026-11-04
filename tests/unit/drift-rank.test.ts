import {
  pickFallbackDestinations,
  rankActivities,
  scoreActivity,
  templateWhy,
} from "@/lib/drift/rank";
import type { Activity } from "@/lib/places/types";

function activity(
  name: string,
  category: string,
  interests: Activity["interests"],
  extra: Partial<Activity> = {},
): Activity {
  return {
    sourceKey: `osm:node/${name.length}${category.length}`,
    dataSource: "OpenStreetMap",
    sourceUrl: "https://www.openstreetmap.org/node/1",
    name,
    category,
    interests,
    latitude: 0,
    longitude: 0,
    openingHours: null,
    wikidata: null,
    website: null,
    ...extra,
  };
}

const weights = { Food: 1, Markets: 0.8, Museums: 0.5, Beaches: -0.6 };

describe("scoreActivity", () => {
  it("scores by the strongest matching interest plus small bonuses", () => {
    expect(scoreActivity(activity("A", "Market", ["Markets", "Food"]), weights)).toBe(1);
    expect(
      scoreActivity(
        activity("B", "Museum", ["Museums"], { wikidata: "Q1", openingHours: "10-18" }),
        weights,
      ),
    ).toBeCloseTo(0.7);
  });

  it("scores places the traveller skips below zero", () => {
    expect(scoreActivity(activity("C", "Beach", ["Beaches"]), weights)).toBe(-0.6);
    expect(scoreActivity(activity("D", "Park", ["Nature"]), weights)).toBe(0);
  });
});

describe("rankActivities", () => {
  it("varies categories and puts skipped interests last", () => {
    const ranked = rankActivities(
      [
        activity("Market 1", "Market", ["Markets"]),
        activity("Market 2", "Market", ["Markets"]),
        activity("Market 3", "Market", ["Markets"]),
        activity("Restaurant", "Restaurant", ["Food"]),
        activity("Museum", "Museum", ["Museums"]),
        activity("Beach", "Beach", ["Beaches"]),
      ],
      weights,
      6,
    );
    // Markets (0.8) beat Museums (0.5) even after one repeat penalty (0.8 - 0.25 = 0.55), not after two.
    expect(ranked.map((a) => a.name).slice(0, 4)).toEqual([
      "Restaurant",
      "Market 1",
      "Market 2",
      "Museum",
    ]);
    expect(ranked.at(-1)?.name).toBe("Beach");
  });

  it("returns at most the requested count, and nothing for nothing", () => {
    expect(rankActivities([activity("A", "Market", ["Markets"])], weights, 5)).toHaveLength(1);
    expect(rankActivities([], weights, 5)).toEqual([]);
  });
});

describe("templateWhy", () => {
  it("speaks from the traveller's own weights", () => {
    expect(templateWhy(["Markets", "Food"], weights, "Market")).toBe(
      "You love food, and this market is close by.",
    );
    expect(templateWhy(["Museums"], weights, "Museum")).toBe(
      "You enjoy museums, and this museum is close by.",
    );
  });

  it("stays neutral when nothing matches", () => {
    expect(templateWhy(["Beaches"], weights, "Beach")).toBe("A well-known beach nearby.");
    expect(templateWhy([], {}, "Landmark")).toBe("A well-known landmark nearby.");
  });
});

describe("pickFallbackDestinations", () => {
  const cities = [
    { geoname_id: 1, name: "Tokyo", country_code: "JP", population: 9_000_000 },
    { geoname_id: 2, name: "Osaka", country_code: "JP", population: 2_700_000 },
    { geoname_id: 3, name: "London", country_code: "GB", population: 8_900_000 },
    { geoname_id: 4, name: "Paris", country_code: "FR", population: 2_100_000 },
    { geoname_id: 5, name: "Lagos", country_code: "NG", population: 9_000_000 },
    { geoname_id: 6, name: "Lima", country_code: "PE", population: 8_800_000 },
  ];

  it("takes turns across continents, one city per country", () => {
    const picked = pickFallbackDestinations(cities, new Set(), 6).map((c) => c.name);
    expect(picked.slice(0, 4).sort()).toEqual(["Lagos", "Lima", "London", "Tokyo"]);
    expect(picked).not.toContain("Osaka");
    expect(picked).toContain("Paris");
  });

  it("leaves out excluded cities and stops at the count", () => {
    const picked = pickFallbackDestinations(cities, new Set([1, 3]), 2).map((c) => c.name);
    expect(picked).toHaveLength(2);
    expect(picked).not.toContain("Tokyo");
    expect(picked).not.toContain("London");
  });
});
