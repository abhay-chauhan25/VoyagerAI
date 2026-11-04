import { formatBudget, parseTripBrief } from "@/lib/brief/parse-trip-brief";

describe("parseTripBrief", () => {
  it("reads a full wish", () => {
    const brief = parseTripBrief(
      "Three slow days in Lisbon in May, mostly food and viewpoints, about €600 each, four of us",
    );
    expect(brief).toEqual({
      destination: "Lisbon",
      days: 3,
      when: "May",
      pace: "Slow",
      paceStated: true,
      interests: ["Food", "Viewpoints"],
      budget: { amount: 600, currency: "EUR", per: "person" },
      travellers: 4,
    });
  });

  it("handles nights, weeks, weekends and multi-word places", () => {
    expect(parseTripBrief("4 nights in Buenos Aires").days).toBe(5);
    expect(parseTripBrief("two weeks around Sri Lanka").days).toBe(14);
    expect(parseTripBrief("a long weekend in Porto").days).toBe(3);
    expect(parseTripBrief("A trip to Rio de Janeiro in March").destination).toBe("Rio de Janeiro");
  });

  it("reads budgets written different ways", () => {
    expect(parseTripBrief("$1,200 total").budget).toEqual({
      amount: 1200,
      currency: "USD",
      per: "total",
    });
    expect(parseTripBrief("1.5k euros pp").budget).toEqual({
      amount: 1500,
      currency: "EUR",
      per: "person",
    });
    expect(parseTripBrief("around 900 pounds").budget).toEqual({
      amount: 900,
      currency: "GBP",
      per: "unspecified",
    });
  });

  it("reads group sizes", () => {
    expect(parseTripBrief("solo trip to Kyoto").travellers).toBe(1);
    expect(parseTripBrief("with 3 friends").travellers).toBe(4);
    expect(parseTripBrief("our honeymoon in Bali").travellers).toBe(2);
    expect(parseTripBrief("family of five").travellers).toBe(5);
  });

  it("keeps interests in the order they were written", () => {
    expect(parseTripBrief("museums, then wine, then some hiking").interests).toEqual([
      "Museums",
      "Wine",
      "Hiking",
    ]);
  });

  it("returns an empty brief for empty input", () => {
    expect(parseTripBrief("")).toEqual({
      destination: null,
      days: null,
      when: null,
      pace: "Balanced",
      paceStated: false,
      interests: [],
      budget: null,
      travellers: null,
    });
  });

  it("does not mistake the verb 'may' for a month or a sentence start for a place", () => {
    const brief = parseTripBrief("we may go somewhere warm. I want beaches");
    expect(brief.when).toBeNull();
    expect(brief.destination).toBeNull();
    expect(brief.interests).toEqual(["Beaches"]);
  });

  it("rejects out-of-range and malformed numbers instead of guessing", () => {
    expect(parseTripBrief("0 days in Rome").days).toBeNull();
    expect(parseTripBrief("400 days in Rome").days).toBeNull();
    expect(parseTripBrief("€0 budget").budget).toBeNull();
    expect(parseTripBrief("€99999999 budget").budget).toBeNull();
    expect(parseTripBrief("€abc").budget).toBeNull();
    expect(parseTripBrief("50 of us").travellers).toBeNull();
  });

  it("survives junk input", () => {
    const junk = "%%%%\u0000‮)))(((€€€ 12-12-12 ;;; <script>alert(1)</script>";
    expect(() => parseTripBrief(junk)).not.toThrow();
    expect(parseTripBrief(junk).destination).toBeNull();
    expect(() => parseTripBrief("x".repeat(10_000))).not.toThrow();
  });
});

describe("formatBudget", () => {
  it("formats each budget kind", () => {
    expect(formatBudget({ amount: 600, currency: "EUR", per: "person" })).toBe("€600 per person");
    expect(formatBudget({ amount: 1200, currency: "USD", per: "total" })).toBe("$1,200 in total");
    expect(formatBudget({ amount: 900, currency: "GBP", per: "unspecified" })).toBe("£900");
  });
});

describe("parseTripBrief day counts", () => {
  it("treats vague amounts as unknown", () => {
    expect(parseTripBrief("a few days in Rome").days).toBeNull();
    expect(parseTripBrief("a couple of days in Rome").days).toBeNull();
  });
});
