import { INTERESTS, type Interest } from "@/lib/interests";
import { sceneById, type Scene } from "./scenes";

export const REACTIONS = ["pass", "love", "more"] as const;
export type Reaction = (typeof REACTIONS)[number];

/** How much each reaction counts. "More like this" is a stronger yes; a pass is a gentler no. */
const REACTION_VALUE: Record<Reaction, number> = { more: 1.5, love: 1, pass: -0.6 };

export type InterestWeights = Partial<Record<Interest, number>>;

/**
 * The signal strength an interest needs before its weight can reach full strength. Without it, one
 * scene that only hints at an interest (night market → a little nightlife) would max it out.
 */
const MIN_EVIDENCE = 1;

/** Weights live in [-1, 1] and are stored to two decimals, so equal inputs compare equal. */
export const clampWeight = (value: number) =>
  Math.round(Math.max(-1, Math.min(1, value)) * 100) / 100;

/**
 * Turns deck reactions into interest weights: for each interest, the signal-weighted average of the
 * reactions to scenes that signal it, shrunk towards zero while the evidence is thin. Interests no answered scene touches are left out (unknown, not
 * zero). Unknown scene ids are ignored, so an old answer can never break scoring.
 */
export function scoreReactions(reactions: Readonly<Record<string, Reaction>>): InterestWeights {
  const totals = new Map<Interest, { sum: number; signal: number }>();
  for (const [sceneId, reaction] of Object.entries(reactions)) {
    const scene = sceneById(sceneId);
    if (!scene) continue;
    for (const [interest, signal] of Object.entries(scene.signals) as [Interest, number][]) {
      const entry = totals.get(interest) ?? { sum: 0, signal: 0 };
      entry.sum += REACTION_VALUE[reaction] * signal;
      entry.signal += signal;
      totals.set(interest, entry);
    }
  }
  const weights: InterestWeights = {};
  for (const interest of INTERESTS) {
    const entry = totals.get(interest);
    if (entry && entry.signal > 0)
      weights[interest] = clampWeight(entry.sum / Math.max(entry.signal, MIN_EVIDENCE));
  }
  return weights;
}

export type Trait = {
  interest: Interest;
  weight: number;
  /** Scenes the traveller said yes to that point at this interest, strongest signal first. */
  because: Scene[];
};

/** Interests ranked by weight with the scenes that explain them. Only positive weights are traits. */
export function rankTraits(
  weights: InterestWeights,
  reactions: Readonly<Record<string, Reaction>>,
): Trait[] {
  return (Object.entries(weights) as [Interest, number][])
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1] || INTERESTS.indexOf(a[0]) - INTERESTS.indexOf(b[0]))
    .map(([interest, weight]) => ({
      interest,
      weight,
      because: Object.entries(reactions)
        .filter(([, reaction]) => reaction !== "pass")
        .map(([id]) => sceneById(id))
        .filter((scene): scene is Scene => Boolean(scene?.signals[interest]))
        .sort((a, b) => (b.signals[interest] ?? 0) - (a.signals[interest] ?? 0)),
    }));
}

/** Words for a weight, so the profile never shows a bare number. */
export function describeWeight(weight: number): string {
  if (weight >= 0.75) return "Loves";
  if (weight >= 0.4) return "Enjoys";
  if (weight > 0) return "Open to";
  if (weight > -0.4) return "Not fussed";
  return "Skips";
}
