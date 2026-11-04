import { z } from "zod";
import { INTERESTS } from "@/lib/interests";
import { REACTIONS } from "./score";
import { SCENES } from "./scenes";

export const PACES = ["slow", "balanced", "full"] as const;
export const BUDGETS = ["shoestring", "comfortable", "splurge"] as const;
export const COMPANIONS = ["solo", "partner", "friends", "family"] as const;

export const PACE_LABELS = { slow: "Slow", balanced: "Balanced", full: "Full days" } as const;
export const BUDGET_LABELS = {
  shoestring: "Shoestring",
  comfortable: "Comfortable",
  splurge: "Splurge",
} as const;
export const COMPANION_LABELS = {
  solo: "Solo",
  partner: "With a partner",
  friends: "With friends",
  family: "With family",
} as const;

const sceneIds = SCENES.map((scene) => scene.id) as [string, ...string[]];

const weights = z.partialRecord(z.enum(INTERESTS), z.number().min(-1).max(1));

const preferences = {
  pace: z.enum(PACES, { error: "Choose a pace." }),
  budget: z.enum(BUDGETS, { error: "Choose a budget." }),
  companions: z
    .array(z.enum(COMPANIONS))
    .min(1, "Choose at least one.")
    .max(COMPANIONS.length)
    .refine((list) => new Set(list).size === list.length, "Each option once."),
};

/** The onboarding submission: every scene answered, plus the three questions. */
export const onboardingSchema = z.object({
  reactions: z
    .partialRecord(z.enum(sceneIds), z.enum(REACTIONS))
    .refine((r) => Object.keys(r).length === SCENES.length, "Answer every scene."),
  ...preferences,
});

/** Editing an existing DNA: adjusted weights plus the three questions. */
export const dnaEditSchema = z.object({ weights, ...preferences });

export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type DnaEditInput = z.infer<typeof dnaEditSchema>;

/**
 * Stored weights come from the database as JSON. The app validates before every write, so a
 * malformed value means something else wrote it: report it loudly and show no weights rather than
 * trusting it.
 */
export function parseStoredWeights(value: unknown) {
  const result = weights.safeParse(value);
  if (!result.success) {
    console.error("Stored Travel DNA weights failed validation", {
      issues: result.error.issues.length,
    });
    return {};
  }
  return result.data;
}
