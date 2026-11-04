"use client";

import { useState, useTransition } from "react";
import { judgeCard, dealNewDeck } from "@/lib/drift/actions";
import type { Card } from "@/lib/drift/cards";
import type { Reaction } from "@/lib/dna/score";
import { SwipeDeck } from "@/components/deck/swipe-deck";
import { DriftCardFace, DriftCardPeek, ExploreLink } from "./drift-card";

type Props = {
  /** The whole deck, including cards already judged, so the count stays "n of total". */
  cards: Card[];
  judgedKeys: string[];
  deckKey: string;
  emptyHint: string;
};

/**
 * A Drift deck. Each swipe is saved straight away; if saving fails the card comes back on top with
 * a message, so nothing is lost silently.
 */
export function DriftDeck({ cards, judgedKeys, deckKey, emptyHint }: Props) {
  const [remaining, setRemaining] = useState(() =>
    cards.filter((card) => !judgedKeys.includes(card.sourceKey)),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const total = cards.length;
  const top = remaining[0];

  const answer = (card: Card, verdict: Reaction) => {
    setError(null);
    setRemaining((list) => list.filter((c) => c.sourceKey !== card.sourceKey));
    startTransition(async () => {
      const result = await judgeCard({ card, verdict });
      if (!result.ok) {
        setError(result.message);
        setRemaining((list) => [card, ...list.filter((c) => c.sourceKey !== card.sourceKey)]);
      }
    });
  };

  if (!top) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-card border border-dashed border-control px-5 py-6">
        <p className="text-body">That&apos;s the whole deck.</p>
        <p className="text-ui text-muted">{emptyHint}</p>
        <form action={dealNewDeck}>
          <input type="hidden" name="deckKey" value={deckKey} />
          <button
            type="submit"
            className="pressable min-h-10 rounded-control bg-primary px-4 text-ui font-semibold text-primary-ink"
          >
            Deal a new deck
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <SwipeDeck
        items={remaining}
        keyOf={(card) => card.sourceKey}
        describe={(card) => `${card.name}. ${card.why}`}
        progress={`${total - remaining.length + 1} of ${total}`}
        onAnswer={answer}
        renderCard={(card) => <DriftCardFace card={card} priority />}
        renderPeek={(card) => <DriftCardPeek card={card} />}
      />
      {top.kind === "destination" ? <ExploreLink cityId={top.cityId} name={top.name} /> : null}
      <p aria-live="polite" className="min-h-5 text-ui">
        {error ? (
          <span className="font-semibold text-negative">{error}</span>
        ) : pending ? (
          <span className="text-muted">Saving…</span>
        ) : null}
      </p>
    </div>
  );
}
