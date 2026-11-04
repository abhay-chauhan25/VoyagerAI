import { INTERESTS } from "@/lib/interests";
import { SCENES } from "@/lib/dna/scenes";
import {
  clampWeight,
  describeWeight,
  rankTraits,
  scoreReactions,
  type Reaction,
} from "@/lib/dna/score";

describe("the scene deck", () => {
  it("signals every interest at least once, with valid ids and strengths", () => {
    const signalled = new Set(SCENES.flatMap((scene) => Object.keys(scene.signals)));
    expect([...INTERESTS].filter((i) => !signalled.has(i))).toEqual([]);
    for (const scene of SCENES) {
      expect(scene.id).toMatch(/^[a-z0-9-]{1,40}$/);
      for (const strength of Object.values(scene.signals)) {
        expect(strength).toBeGreaterThan(0);
        expect(strength).toBeLessThanOrEqual(1);
      }
    }
    expect(new Set(SCENES.map((s) => s.id)).size).toBe(SCENES.length);
  });
});

describe("scoreReactions", () => {
  it("rewards loved scenes and penalises passed ones", () => {
    const weights = scoreReactions({ "night-market": "love", "beach-day": "pass" });
    expect(weights.Food).toBe(1);
    expect(weights.Beaches).toBe(-0.6);
  });

  it("caps strong reactions at 1 and blends mixed signals", () => {
    const weights = scoreReactions({ "summit-sunrise": "more", wildlife: "pass" });
    expect(weights.Hiking).toBe(clampWeight((1.5 * 1 - 0.6 * 0.4) / 1.4));
    // Only a 0.6-strength hint touched Viewpoints: 1.5 × 0.6, not inflated to the cap.
    expect(weights.Viewpoints).toBe(0.9);
  });

  it("keeps a weak hint from maxing out an interest", () => {
    // The night market only hints at nightlife (0.3), so loving it makes nightlife "open to", not "loves".
    expect(scoreReactions({ "night-market": "love" }).Nightlife).toBe(0.3);
  });

  it("leaves untouched interests unknown rather than zero", () => {
    expect(scoreReactions({ "night-market": "love" })).not.toHaveProperty("Beaches");
    expect(scoreReactions({})).toEqual({});
  });

  it("ignores unknown or retired scene ids", () => {
    expect(scoreReactions({ "no-such-scene": "love" } as Record<string, Reaction>)).toEqual({});
  });
});

describe("rankTraits", () => {
  it("ranks positive interests and explains them with the scenes said yes to", () => {
    const reactions: Record<string, Reaction> = {
      "night-market": "love",
      "flea-market": "more",
      "beach-day": "pass",
    };
    const traits = rankTraits(scoreReactions(reactions), reactions);
    expect(traits.map((t) => t.interest)).toEqual(["Food", "Markets", "Shopping", "Nightlife"]);
    expect(traits.find((t) => t.interest === "Markets")?.because.map((s) => s.id)).toEqual([
      "flea-market",
      "night-market",
    ]);
    expect(traits.find((t) => t.interest === "Beaches")).toBeUndefined();
  });

  it("returns nothing when there are no positive weights", () => {
    expect(rankTraits({ Food: -0.5 }, {})).toEqual([]);
  });
});

describe("weight helpers", () => {
  it("clamps and rounds to two decimals", () => {
    expect(clampWeight(1.7)).toBe(1);
    expect(clampWeight(-3)).toBe(-1);
    expect(clampWeight(0.12345)).toBe(0.12);
  });

  it("describes every band", () => {
    expect([0.9, 0.5, 0.1, -0.1, -0.8].map(describeWeight)).toEqual([
      "Loves",
      "Enjoys",
      "Open to",
      "Not fussed",
      "Skips",
    ]);
  });
});
