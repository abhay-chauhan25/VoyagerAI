import { buildQuery, parseOverpass } from "@/lib/places/overpass";
import { classify, overpassFilters } from "@/lib/places/osm-tags";
import {
  cleanCommonsUrl,
  commonsFileName,
  distanceKm,
  isAboutTheTown,
  plainText,
  summaryTitles,
} from "@/lib/places/wikimedia";
import { classifyDescription, parseNearby } from "@/lib/places/wikipedia-nearby";

describe("OpenStreetMap tags", () => {
  it("classifies places Voyager suggests", () => {
    expect(classify({ tourism: "museum" })).toEqual({
      category: "Museum",
      interests: ["Museums", "History"],
    });
    expect(classify({ amenity: "cafe", cuisine: "coffee_shop" })).toMatchObject({
      category: "Café",
    });
  });

  it("ignores everything else", () => {
    expect(classify({ amenity: "parking" })).toBeNull();
    expect(classify({})).toBeNull();
  });

  it("builds one bounded query over every rule", () => {
    const query = buildQuery(38.72, -9.14, 4000);
    expect(query).toContain("(around:4000,38.72000,-9.14000)");
    expect(query).toContain('["tourism"~"^(museum|gallery|artwork|viewpoint)$"]');
    expect(overpassFilters().length).toBeGreaterThan(5);
  });
});

describe("parseOverpass", () => {
  it("turns named, located, recognised elements into activities", () => {
    const { activities, skipped } = parseOverpass({
      elements: [
        {
          type: "node",
          id: 1,
          lat: 38.7,
          lon: -9.1,
          tags: {
            name: "Museu X",
            tourism: "museum",
            wikidata: "Q42",
            website: "https://example.com",
            opening_hours: "Tu-Su 10:00-18:00",
          },
        },
        {
          type: "way",
          id: 2,
          center: { lat: 38.71, lon: -9.12 },
          tags: { "name:en": "Old Market", name: "Mercado", amenity: "marketplace" },
        },
      ],
    });
    expect(skipped).toBe(0);
    expect(activities[0]).toMatchObject({
      sourceKey: "osm:node/1",
      dataSource: "OpenStreetMap",
      wikidata: "Q42",
      website: "https://example.com/",
    });
    expect(activities[1]).toMatchObject({
      sourceKey: "osm:way/2",
      name: "Old Market",
      sourceUrl: "https://www.openstreetmap.org/way/2",
    });
  });

  it("counts and skips unusable elements", () => {
    const { activities, skipped } = parseOverpass({
      elements: [
        { type: "node", id: 3, lat: 1, lon: 1, tags: { tourism: "museum" } }, // no name
        { type: "node", id: 4, tags: { name: "Floating", tourism: "museum" } }, // no location
        { type: "node", id: 5, lat: 1, lon: 1, tags: { name: "Car park", amenity: "parking" } },
        { type: "node", id: -1, lat: 1, lon: 1 },
        "garbage",
        {
          type: "node",
          id: 6,
          lat: 1,
          lon: 1,
          tags: { name: "X", tourism: "museum", website: "javascript:alert(1)", wikidata: "nope" },
        },
      ],
    });
    expect(skipped).toBe(5);
    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({ website: null, wikidata: null });
  });

  it("rejects a response of the wrong shape", () => {
    expect(() => parseOverpass({ remark: "runtime error" })).toThrow(/unexpected shape/);
    expect(() => parseOverpass(null)).toThrow();
  });
});

describe("Wikimedia helpers", () => {
  it("accepts only Commons-hosted files and strips tracking", () => {
    expect(
      cleanCommonsUrl(
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/80/A.jpg/960px-A.jpg?utm_source=x",
      ),
    ).toBe("https://thumb.wikimedia.org/wikipedia/commons/thumb/8/80/A.jpg/960px-A.jpg");
    expect(
      cleanCommonsUrl("https://upload.wikimedia.org/wikipedia/en/4/4a/NonFree.jpg"),
    ).toBeNull();
    expect(cleanCommonsUrl("http://upload.wikimedia.org/wikipedia/commons/a/ab/A.jpg")).toBeNull();
    expect(cleanCommonsUrl("https://evil.example.com/wikipedia/commons/a/ab/A.jpg")).toBeNull();
    expect(cleanCommonsUrl("not a url")).toBeNull();
  });

  it("extracts the file name from original and thumbnail URLs", () => {
    expect(
      commonsFileName(
        "https://upload.wikimedia.org/wikipedia/commons/8/80/Colonial_Oaxaca.jpg?utm_source=y",
      ),
    ).toBe("Colonial_Oaxaca.jpg");
    expect(
      commonsFileName(
        "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a4/Puerta_%282%29.jpg/960px-Puerta_%282%29.jpg",
      ),
    ).toBe("Puerta_(2).jpg");
    expect(
      commonsFileName("https://upload.wikimedia.org/wikipedia/commons/8/80/%E0%A4%A.jpg"),
    ).toBeNull();
  });

  it("turns credit HTML into plain text", () => {
    expect(plainText('<a href="//x">Jane &amp; Co</a>&nbsp; <b>2020</b>')).toBe("Jane & Co 2020");
  });

  it("tells a town from the region of the same name", () => {
    expect(isAboutTheTown("City in Oaxaca, Mexico")).toBe(true);
    expect(isAboutTheTown("Prefecture and commune in Nouvelle-Aquitaine, France")).toBe(true);
    expect(isAboutTheTown("State of Mexico")).toBe(false);
    expect(isAboutTheTown("Province of Spain")).toBe(false);
    expect(isAboutTheTown(undefined)).toBe(true);
  });

  it("tries the most specific titles first", () => {
    expect(summaryTitles("Portland", "Oregon")).toEqual([
      "Portland (city)",
      "Portland",
      "Portland (Oregon)",
      "Portland City",
    ]);
    expect(summaryTitles("Lisbon", "Lisbon")).toEqual(["Lisbon (city)", "Lisbon", "Lisbon City"]);
  });

  it("measures distances", () => {
    expect(distanceKm(38.72, -9.14, 41.15, -8.61)).toBeGreaterThan(270);
    expect(distanceKm(38.72, -9.14, 41.15, -8.61)).toBeLessThan(280);
  });
});

describe("Wikipedia nearby places", () => {
  it("classifies places from their short descriptions", () => {
    expect(classifyDescription("History museum in Bordeaux, France")).toMatchObject({
      category: "Museum",
    });
    expect(classifyDescription("Opera house in Bordeaux, France")).toMatchObject({
      category: "Arts venue",
    });
    expect(classifyDescription("Bordeaux wine")).toMatchObject({ category: "Winery" });
  });

  it("leaves out things that aren't places to visit", () => {
    for (const description of [
      "Tram stop in Bordeaux, France",
      "Civil parish in Lisbon, Portugal",
      "Private international school",
      undefined,
    ]) {
      expect(classifyDescription(description)).toBeNull();
    }
  });

  it("parses located, classifiable pages and counts the rest", () => {
    const { activities, skipped } = parseNearby({
      query: {
        pages: [
          {
            pageid: 10,
            title: "Musée d'Aquitaine",
            description: "History museum in Bordeaux",
            coordinates: [{ lat: 44.8, lon: -0.57 }],
            pageprops: { wikibase_item: "Q3329" },
          },
          {
            pageid: 11,
            title: "Victoire tram stop",
            description: "Tram stop",
            coordinates: [{ lat: 44.8, lon: -0.57 }],
          },
          { pageid: 12, title: "Place des Quinconces", description: "City square in Bordeaux" },
        ],
      },
    });
    expect(skipped).toBe(2);
    expect(activities[0]).toMatchObject({
      sourceKey: "wikipedia:10",
      dataSource: "Wikipedia",
      wikidata: "Q3329",
    });
  });

  it("treats an empty answer as no places and rejects garbage", () => {
    expect(parseNearby({})).toEqual({ activities: [], skipped: 0 });
    expect(() => parseNearby({ query: { pages: "x" } })).toThrow();
  });
});
