"use client";

import { useActionState, useState } from "react";
import { updateTravelDna } from "@/lib/dna/actions";
import { initialFormState } from "@/lib/auth/form-state";
import { clampWeight, describeWeight } from "@/lib/dna/score";
import {
  BUDGETS,
  BUDGET_LABELS,
  COMPANIONS,
  COMPANION_LABELS,
  PACES,
  PACE_LABELS,
} from "@/lib/dna/schemas";
import type { Interest } from "@/lib/interests";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { ChoiceGroup } from "./choice-group";

const STEP = 0.25;

export type EditorTrait = { interest: Interest; weight: number | null; because: string[] };

type Props = {
  traits: EditorTrait[];
  pace: (typeof PACES)[number];
  budget: (typeof BUDGETS)[number];
  companions: string[];
};

function Bar({ weight }: { weight: number }) {
  // A diverging bar: right of centre is a pull towards, left is a pull away.
  const width = `${Math.abs(weight) * 50}%`;
  return (
    <div aria-hidden="true" className="relative h-2 w-full rounded-full bg-raised">
      <div className="absolute top-0 bottom-0 left-1/2 w-px bg-control" />
      <div
        className={`absolute top-0 bottom-0 rounded-full transition-[width] duration-200 ease-[var(--ease-out)] ${
          weight >= 0 ? "left-1/2 bg-accent" : "right-1/2 bg-control"
        }`}
        style={{ width }}
      />
    </div>
  );
}

export function DnaEditor({ traits, pace, budget, companions }: Props) {
  const [state, action] = useActionState(updateTravelDna, initialFormState);
  const [weights, setWeights] = useState<Record<string, number | null>>(
    Object.fromEntries(traits.map((t) => [t.interest, t.weight])),
  );
  const [paceValue, setPace] = useState(pace);
  const [budgetValue, setBudget] = useState(budget);
  const [companionValues, setCompanions] = useState(companions);

  const nudge = (interest: string, delta: number) =>
    setWeights((prev) => ({ ...prev, [interest]: clampWeight((prev[interest] ?? 0) + delta) }));

  return (
    <form action={action} className="flex flex-col gap-10">
      <section aria-labelledby="interests-heading" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="interests-heading" className="text-body font-semibold">
            Interests
          </h2>
          <span className="text-meta text-muted">Strongest first. Nudge any that feel wrong.</span>
        </div>
        <ul className="flex flex-col rounded-card border border-border bg-panel">
          {traits.map(({ interest, because }) => {
            const weight = weights[interest] ?? null;
            return (
              <li
                key={interest}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-rule px-4 py-3 last:border-b-0 sm:grid-cols-[9rem_minmax(0,1fr)_7rem_auto]"
              >
                <div className="flex flex-col">
                  <span className="text-ui font-semibold">{interest}</span>
                  <span className="text-meta text-muted">
                    {weight === null ? "No signal yet" : describeWeight(weight)}
                  </span>
                </div>
                <div className="order-3 col-span-2 sm:order-none sm:col-span-1">
                  {weight === null ? (
                    <div
                      aria-hidden="true"
                      className="h-2 w-full rounded-full border border-dashed border-control"
                    />
                  ) : (
                    <Bar weight={weight} />
                  )}
                  {because.length > 0 ? (
                    <p className="pt-1.5 text-meta text-muted">From: {because.join(" · ")}</p>
                  ) : null}
                </div>
                <span className="hidden text-right text-meta text-muted tabular-nums sm:block">
                  {weight === null ? "—" : `${weight > 0 ? "+" : ""}${weight.toFixed(2)}`}
                </span>
                <div className="flex gap-1" role="group" aria-label={`Adjust ${interest}`}>
                  {weight !== null ? (
                    <input type="hidden" name={`weight.${interest}`} value={weight} />
                  ) : null}
                  <button
                    type="button"
                    aria-label={`Less ${interest}`}
                    onClick={() => nudge(interest, -STEP)}
                    disabled={weight === -1}
                    className="pressable flex size-9 items-center justify-center rounded-control border border-control text-body hover:bg-raised disabled:opacity-40"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    aria-label={`More ${interest}`}
                    onClick={() => nudge(interest, STEP)}
                    disabled={weight === 1}
                    className="pressable flex size-9 items-center justify-center rounded-control border border-control text-body hover:bg-raised disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label="Preferences" className="flex flex-col gap-8">
        <ChoiceGroup
          legend="Pace"
          name="pace"
          type="radio"
          options={PACES.map((value) => ({ value, label: PACE_LABELS[value] }))}
          selected={[paceValue]}
          onChange={(values) => setPace((values[0] as typeof paceValue | undefined) ?? paceValue)}
        />
        <ChoiceGroup
          legend="Budget"
          name="budget"
          type="radio"
          options={BUDGETS.map((value) => ({ value, label: BUDGET_LABELS[value] }))}
          selected={[budgetValue]}
          onChange={(values) =>
            setBudget((values[0] as typeof budgetValue | undefined) ?? budgetValue)
          }
        />
        <ChoiceGroup
          legend="Who you travel with"
          hint="Choose all that apply."
          name="companions"
          type="checkbox"
          options={COMPANIONS.map((value) => ({ value, label: COMPANION_LABELS[value] }))}
          selected={companionValues}
          onChange={setCompanions}
        />
      </section>

      <div className="flex flex-col gap-3">
        <FormMessage state={state} />
        <SubmitButton className="self-start" pendingLabel="Saving…">
          Save Travel DNA
        </SubmitButton>
      </div>
    </form>
  );
}
