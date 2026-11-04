import { SCENES } from "@/lib/dna/scenes";
import { dnaEditSchema, onboardingSchema, parseStoredWeights } from "@/lib/dna/schemas";

const allLoved = Object.fromEntries(SCENES.map((s) => [s.id, "love"]));
const preferences = { pace: "slow", budget: "comfortable", companions: ["friends"] };

describe("onboardingSchema", () => {
  it("accepts a complete deck with preferences", () => {
    expect(onboardingSchema.safeParse({ reactions: allLoved, ...preferences }).success).toBe(true);
  });

  it("rejects a partly answered deck", () => {
    const [first] = SCENES;
    const result = onboardingSchema.safeParse({
      reactions: { [first!.id]: "love" },
      ...preferences,
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown scenes, reactions and options", () => {
    expect(
      onboardingSchema.safeParse({ reactions: { ...allLoved, extra: "love" }, ...preferences })
        .success,
    ).toBe(false);
    expect(
      onboardingSchema.safeParse({
        reactions: { ...allLoved, "night-market": "meh" },
        ...preferences,
      }).success,
    ).toBe(false);
    expect(
      onboardingSchema.safeParse({ reactions: allLoved, ...preferences, pace: "frantic" }).success,
    ).toBe(false);
    expect(
      onboardingSchema.safeParse({ reactions: allLoved, ...preferences, companions: [] }).success,
    ).toBe(false);
    expect(
      onboardingSchema.safeParse({ reactions: allLoved, ...preferences, companions: ["pets"] })
        .success,
    ).toBe(false);
    expect(
      onboardingSchema.safeParse({
        reactions: allLoved,
        ...preferences,
        companions: ["solo", "solo"],
      }).success,
    ).toBe(false);
  });

  it("rejects malformed payloads", () => {
    for (const junk of [null, "x", 42, [], { reactions: "all" }]) {
      expect(onboardingSchema.safeParse(junk).success).toBe(false);
    }
  });
});

describe("dnaEditSchema", () => {
  it("accepts weights within range for known interests", () => {
    expect(
      dnaEditSchema.safeParse({ weights: { Food: 0.75, Beaches: -1 }, ...preferences }).success,
    ).toBe(true);
  });

  it("rejects out-of-range weights and unknown interests", () => {
    expect(dnaEditSchema.safeParse({ weights: { Food: 1.5 }, ...preferences }).success).toBe(false);
    expect(dnaEditSchema.safeParse({ weights: { Skydiving: 0.5 }, ...preferences }).success).toBe(
      false,
    );
    expect(dnaEditSchema.safeParse({ weights: { Food: Number.NaN }, ...preferences }).success).toBe(
      false,
    );
  });
});

describe("parseStoredWeights", () => {
  it("passes valid stored weights through", () => {
    expect(parseStoredWeights({ Food: 0.4 })).toEqual({ Food: 0.4 });
  });

  it("refuses malformed stored weights and reports them", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(parseStoredWeights({ Food: "lots" })).toEqual({});
    expect(parseStoredWeights([1, 2])).toEqual({});
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });
});
