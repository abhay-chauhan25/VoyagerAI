"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveOnboarding } from "@/lib/dna/actions";
import type { Reaction } from "@/lib/dna/score";
import {
  BUDGETS,
  BUDGET_LABELS,
  COMPANIONS,
  COMPANION_LABELS,
  PACES,
  PACE_LABELS,
} from "@/lib/dna/schemas";
import { SceneDeck, type DeckScene } from "./scene-deck";
import { ChoiceGroup } from "./choice-group";

type Pace = (typeof PACES)[number];
type Budget = (typeof BUDGETS)[number];
type Companion = (typeof COMPANIONS)[number];

export function Onboarding({ scenes }: { scenes: readonly DeckScene[] }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, Reaction>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [pace, setPace] = useState<Pace | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const deckDone = Object.keys(answers).length === scenes.length;
  const ready = deckDone && pace !== null && budget !== null && companions.length > 0;

  const submit = () => {
    if (!ready) return;
    setError(null);
    startTransition(async () => {
      const result = await saveOnboarding({ reactions: answers, pace, budget, companions });
      if (result.ok) router.push("/dna");
      else setError(result.message);
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-[40rem] flex-1 flex-col items-center gap-8 px-4 pt-4 pb-16">
      {!deckDone ? (
        <>
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-title font-semibold">What pulls at you?</h1>
            <p className="max-w-[40ch] text-ui text-muted">
              Twelve moments. Go with your gut. Swipe, tap, or use the arrow keys.
            </p>
          </div>
          <SceneDeck
            scenes={scenes}
            answers={answers}
            onAnswer={(id, reaction) => {
              setAnswers((prev) => ({ ...prev, [id]: reaction }));
              setOrder((prev) => [...prev, id]);
            }}
            onUndo={() => {
              const last = order.at(-1);
              if (!last) return;
              setOrder((prev) => prev.slice(0, -1));
              setAnswers((prev) => {
                const copy = { ...prev };
                delete copy[last];
                return copy;
              });
            }}
          />
        </>
      ) : (
        <div className="flex w-full flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-title font-semibold">Three quick ones</h1>
            <p className="text-ui text-muted">
              These shape how full your days are and what Voyager suggests.
            </p>
          </div>
          <ChoiceGroup
            legend="Your pace"
            name="pace"
            type="radio"
            options={PACES.map((value) => ({ value, label: PACE_LABELS[value] }))}
            selected={pace ? [pace] : []}
            onChange={(values) => setPace((values[0] as Pace | undefined) ?? null)}
          />
          <ChoiceGroup
            legend="Your budget"
            name="budget"
            type="radio"
            options={BUDGETS.map((value) => ({ value, label: BUDGET_LABELS[value] }))}
            selected={budget ? [budget] : []}
            onChange={(values) => setBudget((values[0] as Budget | undefined) ?? null)}
          />
          <ChoiceGroup
            legend="Who you usually travel with"
            hint="Choose all that apply."
            name="companions"
            type="checkbox"
            options={COMPANIONS.map((value) => ({ value, label: COMPANION_LABELS[value] }))}
            selected={companions}
            onChange={(values) => setCompanions(values as Companion[])}
          />
          {error ? (
            <p
              role="alert"
              className="rounded-control bg-negative-bg px-3 py-2.5 text-ui font-semibold text-negative"
            >
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={submit}
              disabled={!ready || pending}
              className="pressable min-h-12 rounded-control bg-primary px-6 text-body font-semibold text-primary-ink hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Reading your answers…" : "See my Travel DNA"}
            </button>
            {!ready ? (
              <span className="text-ui text-muted">Answer all three to continue.</span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
