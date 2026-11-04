import { continentOf, countryName, COUNTRY_CODES } from "@/lib/atlas/countries";
import { addVisitSchema, citySearchSchema } from "@/lib/atlas/schemas";
import { atlasStats } from "@/lib/atlas/stats";

describe("atlasStats", () => {
  it("counts distinct countries, cities and continents from the rows", () => {
    const stats = atlasStats([
      { country_code: "PT", city_id: 1 },
      { country_code: "PT", city_id: 2 },
      { country_code: "PT", city_id: null },
      { country_code: "JP", city_id: 3 },
      { country_code: "BR", city_id: null },
    ]);
    expect(stats).toEqual({ countries: 3, cities: 3, continents: ["AS", "EU", "SA"] });
  });

  it("is all zeros for a new traveller", () => {
    expect(atlasStats([])).toEqual({ countries: 0, cities: 0, continents: [] });
  });

  it("does not count a continent for an unknown country code", () => {
    expect(atlasStats([{ country_code: "ZZ", city_id: null }]).continents).toEqual([]);
  });
});

describe("countries", () => {
  it("names countries in English and maps them to continents", () => {
    expect(countryName("PT")).toBe("Portugal");
    expect(continentOf("NA")).toBe("AF"); // Namibia, not North America
    expect(COUNTRY_CODES.length).toBeGreaterThan(200);
  });

  it("falls back to the code for anything malformed", () => {
    expect(countryName("pt")).toBe("pt");
    expect(countryName("<script>")).toBe("<script>");
    expect(continentOf("ZZ")).toBeUndefined();
  });
});

describe("addVisitSchema", () => {
  it("accepts a city, or a country, with an optional year", () => {
    expect(addVisitSchema.parse({ cityId: "2267057", year: "2024" })).toEqual({
      cityId: 2267057,
      year: 2024,
    });
    expect(addVisitSchema.parse({ countryCode: "IS", year: "" })).toEqual({
      countryCode: "IS",
      year: null,
    });
  });

  it("needs a city or a country", () => {
    expect(addVisitSchema.safeParse({ year: "2024" }).success).toBe(false);
  });

  it("rejects malformed ids, codes and years", () => {
    expect(addVisitSchema.safeParse({ cityId: "abc" }).success).toBe(false);
    expect(addVisitSchema.safeParse({ cityId: "-4" }).success).toBe(false);
    expect(addVisitSchema.safeParse({ countryCode: "Portugal" }).success).toBe(false);
    expect(addVisitSchema.safeParse({ countryCode: "IS", year: "1850" }).success).toBe(false);
    expect(
      addVisitSchema.safeParse({ countryCode: "IS", year: String(new Date().getFullYear() + 1) })
        .success,
    ).toBe(false);
  });
});

describe("citySearchSchema", () => {
  it("needs two to eighty characters", () => {
    expect(citySearchSchema.safeParse({ q: "Li" }).success).toBe(true);
    expect(citySearchSchema.safeParse({ q: " L " }).success).toBe(false);
    expect(citySearchSchema.safeParse({ q: "x".repeat(81) }).success).toBe(false);
  });
});
