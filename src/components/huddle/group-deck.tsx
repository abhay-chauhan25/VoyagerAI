"use client";

import { useState, useTransition } from "react";
import { SwipeDeck } from "@/components/deck/swipe-deck";
import { DriftCardFace, DriftCardPeek } from "@/components/drift/drift-card";
import type { ActivityCard } from "@/lib/drift/cards";
import type { Reaction } from "@/lib/dna/score";
import { swipeGroupCard } from "@/lib/huddle/actions";

type Props = { tripId: string; cards: ActivityCard[]; judgedKeys: string[] };

/**
 * The shared Group Drift deck. Each swipe is saved at once; if saving fails the card comes back on
 * top with a message, so no answer is lost silently.
 */
export function GroupDeck({ tripId, cards, judgedKeys }: Props) {
  const [remaining, setRemaining] = useState(() =>
    cards.filter((card) => !judgedKeys.includes(card.sourceKey)),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const total = cards.length;

  const answer = (card: ActivityCard, verdict: Reaction) => {
    setError(null);
    setRemaining((list) => list.filter((c) => c.sourceKey !== card.sourceKey));
    start(async () => {
      const result = await swipeGroupCard({ tripId, card, verdict });
      if (!result.ok) {
        setError(result.message);
        setRemaining((list) => [card, ...list.filter((c) => c.sourceKey !== card.sourceKey)]);
      }
    });
  };

  if (remaining.length === 0) {
    return (
      <div className="flex flex-col gap-2 rounded-card border border-dashed border-control px-5 py-6 text-ui">
        <p className="text-body">You&apos;ve swiped the whole group deck.</p>
        <p className="text-muted">
          Matches appear as the others swipe. A new deck is dealt tomorrow.
        </p>
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
